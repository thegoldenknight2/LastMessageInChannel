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
    if (!MessageStore || !channelId) return null;

    const collection = MessageStore.getMessages(channelId);
    if (!collection) return null;

    const messages = collection._array ?? collection.toArray?.() ?? [];
    if (messages.length === 0) return null;

    const lastMsg = messages
        .slice()
        .reverse()
        .find(m => m.author?.id === userId || m.authorId === userId);

    if (!lastMsg) return null;

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
        // Smart finder that already worked for you ("modal")
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
        console.log(`[LastMessageInChannel] 🎉 SUCCESS — Found profile module: ${compName}`);

        // Patch using the MODULE (this is what fixes the "default is not a function" crash)
        unpatch = after("default", ProfileModule, ([props], returnValue) => {
            console.log("[LastMessageInChannel] Patch running on profile...");

            const user = props?.user;
            if (!user?.id) return returnValue;

            const channelId = SelectedChannelStore?.getChannelId?.();
            if (!channelId) return returnValue;

            const date = getLastMessageDate(user.id, channelId);
            if (!date) return returnValue;

            const lastMessageText = React.createElement(FormText, {
                style: {
                    color: "#00ffaa",
                    fontSize: 15,
                    fontWeight: "600",
                    padding: 12,
                    marginTop: 8,
                    textAlign: "center",
                    backgroundColor: "rgba(0, 255, 170, 0.15)",
                    borderRadius: 8,
                },
                numberOfLines: 1,
            }, `✅ Last message sent on ${date}`);

            const children = React.Children.toArray(returnValue.props.children ?? []);
            children.push(lastMessageText);
            returnValue.props.children = children;

            console.log("[LastMessageInChannel] ✅ Text successfully added to profile!");
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
        }, "LastMessageInChannel\n✅ Fixed & ready\nOpen any profile → look for green box at bottom")
};
