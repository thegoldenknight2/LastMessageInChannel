import { find, findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { before, after } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms } from "@vendetta/ui/components";

const { FormRow } = Forms;

// Stores
const ChannelStore = findByProps("getChannel", "getChannels");
const MessageStore = findByProps("getMessages", "getMessage");
const GuildStore = findByProps("getGuild", "getGuilds");

// Attempt to find the user profile component
let UserProfileComponent;

// Strategy 1: Look for components with typical profile names
const possibleNames = [
    "UserProfile",
    "UserProfileScreen",
    "UserProfileHeader",
    "UserProfileModal",
    "ProfilePanel"
];

for (const name of possibleNames) {
    UserProfileComponent = find(m => m?.name === name || m?.displayName === name);
    if (UserProfileComponent) break;
}

// Strategy 2: Look for a component that has a userId prop in defaultProps
if (!UserProfileComponent) {
    UserProfileComponent = find(m => m?.defaultProps?.userId !== undefined);
}

// Strategy 3: Look for a component that takes userId as a prop in its render
if (!UserProfileComponent) {
    UserProfileComponent = find(m => {
        if (!m?.render) return false;
        // Check if the render function's source contains 'userId' (crude but sometimes works)
        const renderStr = m.render.toString();
        return renderStr.includes('userId') && renderStr.includes('guildId');
    });
}

// If still not found, log a warning
if (!UserProfileComponent) {
    console.warn("[UserDetails] Could not find UserProfile component. Plugin will not work.");
} else {
    console.log("[UserDetails] Found profile component:", UserProfileComponent.name || UserProfileComponent.displayName);
}

let patches = [];

export default {
    onLoad: () => {
        if (!UserProfileComponent) {
            console.log("[UserDetails] No profile component found, skipping patches.");
            return;
        }

        // Patch before render to capture userId and guildId and find last message
        patches.push(
            before("render", UserProfileComponent, (args) => {
                try {
                    const props = args[0];
                    const userId = props?.userId;
                    const guildId = props?.guildId;

                    if (!userId || !guildId) return;

                    const lastMessage = getLatestUserMessageInGuild(userId, guildId);
                    if (lastMessage) {
                        props.__lastMessageTimestamp = lastMessage.timestamp;
                        console.log(`[UserDetails] Found last message for user ${userId} at ${lastMessage.timestamp}`);
                    }
                } catch (e) {
                    console.error("[UserDetails] Error in before patch:", e);
                }
            })
        );

        // Patch after render to inject the row
        patches.push(
            after("render", UserProfileComponent, (_, ret) => {
                try {
                    const props = ret?.props;
                    if (!props?.__lastMessageTimestamp) return ret;

                    // Find the info section where we can insert our row
                    const infoSection = findInTree(ret, n => 
                        n?.type?.name === "UserProfileInfo" || 
                        n?.type?.displayName === "UserProfileInfo" ||
                        (n?.type?.toString && n.type.toString().includes("UserProfileInfo"))
                    );

                    if (!infoSection || !infoSection.props?.children) {
                        console.log("[UserDetails] Could not find UserProfileInfo section");
                        return ret;
                    }

                    // Insert the row
                    infoSection.props.children.push(
                        React.createElement(FormRow, {
                            label: "Last Message",
                            subLabel: formatTimestamp(props.__lastMessageTimestamp),
                            icon: getAssetIDByName("ic_message_24px"),
                        })
                    );

                    console.log("[UserDetails] Injected last message row");
                } catch (e) {
                    console.error("[UserDetails] Error in after patch:", e);
                }
                return ret;
            })
        );

        console.log("[UserDetails] Plugin loaded successfully.");
    },
    onUnload: () => {
        patches.forEach(p => p());
        patches = [];
        console.log("[UserDetails] Plugin unloaded.");
    },
};

// Helper: Find latest message from user in guild
function getLatestUserMessageInGuild(userId, guildId) {
    if (!GuildStore || !MessageStore || !ChannelStore) return null;

    const guild = GuildStore.getGuild(guildId);
    if (!guild) return null;

    let latest = null;
    const channels = Object.values(guild.channels || {});

    for (const channel of channels) {
        const messages = MessageStore.getMessages(channel.id);
        // messages might be a collection, convert to array
        const messagesArray = messages?.toArray?.() || [];
        for (const msg of messagesArray) {
            if (msg.author?.id === userId) {
                const ts = new Date(msg.timestamp);
                if (!latest || ts > new Date(latest.timestamp)) {
                    latest = msg;
                }
            }
        }
    }
    return latest;
}

// Format timestamp
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}

// Recursively find a node in React tree
function findInTree(tree, filter) {
    if (!tree) return null;
    if (filter(tree)) return tree;

    if (Array.isArray(tree)) {
        for (const item of tree) {
            const found = findInTree(item, filter);
            if (found) return found;
        }
    } else if (tree?.props?.children) {
        const found = findInTree(tree.props.children, filter);
        if (found) return found;
    } else if (tree?.children) {
        const found = findInTree(tree.children, filter);
        if (found) return found;
    }

    return null;
                      }
