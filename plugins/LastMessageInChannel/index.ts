import { after } from "@vendetta/patcher";
import { find, findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";

const { FormText } = Forms;

const MessageStore = findByProps("getMessages");
const SelectedChannelStore = findByProps("getChannelId");

let unpatch = null;

const DISCORD_EPOCH = 1420070400000n;

function getLastMessageDate(userId, channelId) {
    if (!MessageStore || !channelId) return "Unknown (no store)";

    const collection = MessageStore.getMessages(channelId);
    if (!collection) return "Unknown (no messages)";

    const messages = collection._array ?? collection.toArray?.() ?? [];
    if (messages.length === 0) return "Unknown (empty channel)";

    const lastMsg = messages
        .slice()
        .reverse()
        .find(m => m.author?.id === userId || m.authorId === userId);

    if (!lastMsg) return "Unknown (no message from user)";

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
        let ProfileModule = find(m => {
            if (typeof m !== "function" && typeof m?.default !== "function") return false;
            const name = (m.displayName || m.name || m.default?.displayName || "").toLowerCase();
            return name.includes("modal") || name.includes("profile");
        });

        if (!ProfileModule) {
            console.warn("[LastMessageInChannel] ❌ No profile module found.");
            return;
        }

        const compName = ProfileModule.displayName || ProfileModule.name || ProfileModule.default?.displayName || "modal";
        console.log(`[LastMessageInChannel] 🎉 FOUND MODULE: ${compName}`);

        const patchTarget = ProfileModule.default ? ProfileModule : { default: ProfileModule };

        unpatch = after("default", patchTarget, ([props], returnValue) => {
            console.log("[LastMessageInChannel] 🔥 PATCH TRIGGERED");

            const user = props?.user;
            if (!user?.id) {
                console.log("[LastMessageInChannel] No user in props");
                return returnValue;
            }

            const channelId = SelectedChannelStore?.getChannelId?.();
            console.log(`[LastMessageInChannel] Current channel: ${channelId || "none"}`);

            const date = getLastMessageDate(user.id, channelId);

            const displayText = `Last message sent on ${date}`;

            const testText = React.createElement(FormText, {
                style: {
                    color: "#ff0000",                    // bright red
                    fontSize: 16,
                    fontWeight: "700",
                    padding: 14,
                    marginTop: 12,
                    marginBottom: 12,
                    textAlign: "center",
                    backgroundColor: "#ff000030",       // red background
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: "#ff0000",
                },
                numberOfLines: 1,
            }, `🧪 ${displayText}`);

            const children = React.Children.toArray(returnValue.props.children ?? []);
            children.push(testText);
            returnValue.props.children = children;

            console.log(`[LastMessageInChannel] ✅ TEXT INJECTED: ${displayText}`);
            return returnValue;
        });
    },

    onUnload() {
        if (unpatch) unpatch();
        unpatch = null;
    },

    Settings: () =>
        React.createElement(FormText, {
            style: { padding: 16, color: "#b9bbbe", fontSize: 15 },
        }, "LastMessageInChannel — TEST MODE\nOpen any profile now.\nYou MUST see a big red box at the bottom.")
};
