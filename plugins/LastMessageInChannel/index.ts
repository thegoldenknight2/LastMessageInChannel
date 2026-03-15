import { after } from "@vendetta/patcher";
import { find, findByName, findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";

const { FormText } = Forms;

const MessageStore = findByProps("getMessages");
const SelectedChannelStore = findByProps("getChannelId");

let unpatch = null;
const DISCORD_EPOCH = 1420070400000n;

function getLastMessageDate(userId, channelId) {
    if (!MessageStore || !channelId) return "Unknown (No channel context)";

    const collection = MessageStore.getMessages(channelId);
    if (!collection) return "Unknown (No messages loaded)";

    const messages = collection._array ?? collection.toArray?.() ?? [];
    if (messages.length === 0) return "Unknown (Empty channel)";

    const lastMsg = messages
        .slice()
        .reverse()
        .find(m => m.author?.id === userId || m.authorId === userId);

    if (!lastMsg) return "No recent messages found";

    let ts;
    if (lastMsg.timestamp) {
        ts = new Date(lastMsg.timestamp).getTime();
    } else {
        const snowflake = BigInt(lastMsg.id);
        ts = Number((snowflake >> 22n) + DISCORD_EPOCH);
    }

    return new Date(ts).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

export default {
    onLoad() {
        // ENHANCEMENT 1: Precision targeting. 
        // Discord updates often, so we look for specific Profile component names.
        let ProfileModule = findByName("UserProfile", false) 
            || findByName("UserProfilePopout", false) 
            || find(m => m?.default?.name === "UserProfile" || m?.type?.name === "UserProfile");

        if (!ProfileModule) {
            console.warn("[LastMessageInChannel] ❌ Failed to find UserProfile component.");
            return;
        }

        const patchTarget = ProfileModule.default ? ProfileModule : { default: ProfileModule };

        unpatch = after("default", patchTarget, ([props], returnValue) => {
            try {
                // Ensure we actually have a user to look up
                const user = props?.user;
                if (!user?.id) return returnValue;

                const channelId = SelectedChannelStore?.getChannelId?.();
                const date = getLastMessageDate(user.id, channelId);

                const testText = React.createElement(FormText, {
                    style: {
                        color: "#ffffff",
                        fontSize: 15,
                        fontWeight: "bold",
                        padding: 12,
                        marginTop: 10,
                        textAlign: "center",
                        backgroundColor: "#ff000090", // Softer red for visibility
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#ff0000",
                    },
                    numberOfLines: 1,
                }, `🧪 Last Message: ${date}`);

                // ENHANCEMENT 2: Safe UI Injection.
                // React children can be an array, an object, or undefined. This handles all three safely.
                if (returnValue && returnValue.props) {
                    const currentChildren = returnValue.props.children;
                    
                    if (Array.isArray(currentChildren)) {
                        currentChildren.push(testText);
                    } else if (currentChildren) {
                        returnValue.props.children = [currentChildren, testText];
                    } else {
                        returnValue.props.children = testText;
                    }
                }

                return returnValue;
            } catch (err) {
                // ENHANCEMENT 3: Graceful failure. 
                // Prevents Discord from crashing if the layout unexpectedly changes.
                console.error("[LastMessageInChannel] ❌ Patch error:", err);
                return returnValue; 
            }
        });
    },

    onUnload() {
        if (unpatch) unpatch();
        unpatch = null;
    }
};
             
