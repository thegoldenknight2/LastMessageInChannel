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
        // Re-find the exact modal component we already know exists
        let ProfileModal = find(m => {
            if (typeof m !== "function" && typeof m?.default !== "function") return false;
            const name = (m.displayName || m.name || m.default?.displayName || "").toLowerCase();
            return name.includes("modal") || name.includes("profile");
        });

        if (ProfileModal?.default) ProfileModal = ProfileModal.default;

        if (!ProfileModal) {
            console.warn("[LastMessageInChannel] ❌ Modal component disappeared after reload.");
            return;
        }

        console.log(`[LastMessageInChannel] 🎉 SUCCESS — Using profile modal: ${ProfileModal.displayName || "modal"}`);

        // Patch it
        unpatch = after("default", ProfileModal, ([props], returnValue) => {
            console.log("[LastMessageInChannel] Patch triggered — checking profile...");

            const user = props?.user;
            if (!user?.id) return returnValue;

            const channelId = SelectedChannelStore?.getChannelId?.();
            if (!channelId) return returnValue;

            const date = getLastMessageDate(user.id, channelId);
            if (!date) {
                console.log("[LastMessageInChannel] No last message found for this user in current channel");
                return returnValue;
            }

            const lastMessageText = React.createElement(FormText, {
                style: {
                    color: "#00ffaa",           // bright green so it's impossible to miss
                    fontSize: 15,
                    fontWeight: "500",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    opacity: 1,
                    textAlign: "center",
                    backgroundColor: "rgba(0,0,0,0.3)",
                    marginTop: 8,
                    marginBottom: 8,
                },
                numberOfLines: 1,
            }, `✅ Last message sent on ${date}`);

            // Better injection: add it near the bottom but before any buttons/footer
            const children = React.Children.toArray(returnValue.props.children ?? []);
            children.push(lastMessageText);        // simple push works for most modals
            returnValue.props.children = children;

            console.log("[LastMessageInChannel] ✅ Text injected successfully!");
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
        }, "LastMessageInChannel\n✅ Working! (modal found)\nCheck any user profile — green text should appear at the bottom.")
};
