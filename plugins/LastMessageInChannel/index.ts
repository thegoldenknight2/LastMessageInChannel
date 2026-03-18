import { find, findByProps, findByTypeName } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { before, after } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms } from "@vendetta/ui/components";

const { FormRow } = Forms;

// Find required Discord stores
const ChannelStore = findByProps("getChannel", "getChannels");
const MessageStore = findByProps("getMessages", "getMessage");
const GuildStore = findByProps("getGuild", "getGuilds");

// Try to find the user profile component - it may be named differently
let UserProfileComponent = findByTypeName("UserProfile") || 
                          findByTypeName("UserProfileScreen") || 
                          find(m => m?.type?.render?.name === "UserProfileHeader") ||
                          find(m => m?.default?.render?.name === "UserProfileHeader");

// If still not found, try a more generic approach: look for a component that renders user info
if (!UserProfileComponent) {
    // Look for a component that likely contains the user profile (has userId prop)
    UserProfileComponent = find(m => m?.render && m?.defaultProps?.userId !== undefined);
}

// Fallback: patch the entire profile modal if necessary
if (!UserProfileComponent) {
    console.error("[UserDetails] Could not find UserProfile component. Plugin will not work.");
}

let patches = [];

export default {
    onLoad: () => {
        if (!UserProfileComponent) return;

        patches.push(
            before("render", UserProfileComponent, (args) => {
                const props = args[0];
                const userId = props.userId;
                const guildId = props.guildId;

                if (!userId || !guildId) return;

                const lastMessage = getLatestUserMessageInGuild(userId, guildId);
                if (lastMessage) {
                    props.__lastMessageTimestamp = lastMessage.timestamp;
                }
            })
        );

        patches.push(
            after("render", UserProfileComponent, (_, ret) => {
                const props = ret?.props;
                if (!props?.__lastMessageTimestamp) return ret;

                // Find the section where we want to insert our row
                const infoSection = findInTree(ret, n => 
                    n?.type?.name === "UserProfileInfo" || 
                    n?.type?.displayName === "UserProfileInfo"
                );

                if (!infoSection || !infoSection.props?.children) return ret;

                // Insert our row
                infoSection.props.children.push(
                    React.createElement(FormRow, {
                        label: "Last Message",
                        subLabel: formatTimestamp(props.__lastMessageTimestamp),
                        icon: getAssetIDByName("ic_message_24px"),
                    })
                );

                return ret;
            })
        );

        console.log("[UserDetails] Plugin loaded successfully.");
    },
    onUnload: () => {
        patches.forEach(p => p());
        patches = [];
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
        const messages = MessageStore.getMessages(channel.id)?.toArray?.() || [];
        for (const msg of messages) {
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
