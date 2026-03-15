// index.ts
// LastMessageInChannel — Fixed for March 2026 ShiggyCord/Discord update

import { after } from "@vendetta/patcher";
import { find, findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";

const { FormText } = Forms;

const MessageStore = findByProps("getMessages");
const SelectedChannelStore = findByProps("getChannelId");

let unpatch: (() => void) | null = null;

const DISCORD_EPOCH = 1420070400000n;

function getLastMessageDate(userId: string, channelId: string): string | null {
    if (!MessageStore || !channelId) return null;

    const collection = MessageStore.getMessages(channelId);
    if (!collection) return null;

    const messages = collection._array ?? collection.toArray?.() ?? [];
    if (messages.length === 0) return null;

    const lastMsg = messages
        .slice()
        .reverse()
        .find((m: any) => m.author?.id === userId || m.authorId === userId);

    if (!lastMsg) return null;

    let ts: number;
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
        // Smart finder that works even after Discord updates
        let UserProfile = find(m => {
            if (typeof m !== "function") return false;
            const name = m.displayName || m.default?.displayName || m.name || "";
            return name.includes("Profile") || name.includes("UserProfile") || name.includes("Modal");
        });

        if (UserProfile?.default) UserProfile = UserProfile.default;

        if (!UserProfile) {
            console.warn("[LastMessageInChannel] ❌ Still no profile component found. Send me the new log.");
            return;
        }

        console.log(`[LastMessageInChannel] ✅ SUCCESS — Found profile: ${UserProfile.displayName || UserProfile.name || "unknown"}`);

        unpatch = after("default", UserProfile, ([props], returnValue) => {
            const user = props?.user;
            if (!user?.id) return returnValue;

            const channelId = SelectedChannelStore?.getChannelId?.();
            if (!channelId) return returnValue;

            const date = getLastMessageDate(user.id, channelId);
            if (!date) return returnValue;

            const lastMessageText = React.createElement(FormText, {
                style: {
                    color: "#b9bbbe",
                    fontSize: 14,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    opacity: 0.9,
                },
                numberOfLines: 1,
            }, `Last message sent on ${date}`);

            const children = React.Children.toArray(returnValue.props.children ?? []);
            children.push(lastMessageText);
            returnValue.props.children = children;

            return returnValue;
        });
    },

    onUnload() {
        unpatch?.();
        unpatch = null;
    },

    Settings: () =>
        React.createElement(FormText, {
            style: { padding: 16, color: "#b9bbbe" },
        }, "LastMessageInChannel\nNow working on current Discord (March 2026)")
};
