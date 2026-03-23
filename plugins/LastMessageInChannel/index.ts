import { findByName, findByStoreName, findByProps } from "@vendetta/metro";
import { after, unpatchAll } from "@vendetta/patcher";

const SelectedChannelStore = findByStoreName("SelectedChannelStore");
const ChannelStore = findByStoreName("ChannelStore");
const RestAPI = findByProps("get", "post", "put");
const BioText = findByName("BioText", false);

const cache: Record<string, string | null> = {};
const pending = new Set<string>();

// Try every possible way to get channelId
function getChannelId(): string | null {
  return (
    SelectedChannelStore?.getChannelId?.() ??
    SelectedChannelStore?.getCurrentlySelectedChannelId?.() ??
    SelectedChannelStore?.getLastSelectedChannelId?.() ??
    null
  );
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  const readable = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (days === 0) return `${readable} (Today)`;
  if (days === 1) return `${readable} (Yesterday)`;
  return `${readable} (${days} days ago)`;
}

after("default", BioText, ([props], res) => {
  if (!res?.props || !props.userId) return res;

  const userId: string = props.userId;
  
  // Also try guildId from props directly
  const channelId = getChannelId();
  const channel = channelId ? ChannelStore?.getChannel?.(channelId) : null;
  const guildId: string | null = channel?.guild_id ?? null;

  if (!channelId) return res;

  const key = `${userId}:${channelId}`;

  if (!(key in cache)) {
    if (!pending.has(key)) {
      pending.add(key);

      const url = guildId
        ? `/guilds/${guildId}/messages/search?author_id=${userId}&channel_id=${channelId}&limit=1`
        : `/channels/${channelId}/messages/search?author_id=${userId}&limit=1`;

      RestAPI.get({ url })
        .then((r: any) => {
          const msgs = r?.body?.messages;
          const lastMsg = Array.isArray(msgs) && msgs.length > 0 ? msgs[0][0] : null;
          cache[key] = lastMsg ? formatDate(lastMsg.timestamp) : null;
          pending.delete(key);
        })
        .catch(() => {
          // Don't cache on error so it retries next open
          pending.delete(key);
        });
    }
    return res;
  }

  if (!cache[key]) return res;

  const extraLine = `\n\nLast message here: ${cache[key]}`;
  const children = res.props.children;

  if (typeof children === "string") {
    if (!children.includes("Last message here:"))
      res.props.children += extraLine;
  } else if (Array.isArray(children)) {
    if (!children.join("").includes("Last message here:"))
      children.push(extraLine);
  } else {
    res.props.children = [children, extraLine];
  }

  return res;
});

export const onUnload = () => unpatchAll();
