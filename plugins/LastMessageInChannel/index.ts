import { findByName, findByStoreName, findByProps } from "@vendetta/metro";
import { after, unpatchAll } from "@vendetta/patcher";

const SelectedChannelStore = findByStoreName("SelectedChannelStore");
const RestAPI = findByProps("getAPIBaseURL", "get", "post");
const BioText = findByName("BioText", false);

const cache: Record<string, string | null> = {};
const pending = new Set<string>();

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
  const channelId: string = SelectedChannelStore?.getChannelId?.();
  if (!channelId) return res;

  const key = `${userId}:${channelId}`;

  if (!(key in cache)) {
    if (!pending.has(key)) {
      pending.add(key);
      RestAPI.get({
        url: `/channels/${channelId}/messages/search?author_id=${userId}&limit=1`,
      }).then((r: any) => {
        const lastMsg = r?.body?.messages?.[0]?.[0];
        cache[key] = lastMsg ? formatDate(lastMsg.timestamp) : null;
        pending.delete(key);
      }).catch(() => {
        cache[key] = null;
        pending.delete(key);
      });
    }
    return res;
  }

  if (!cache[key]) return res;

  const extraLine = `\n\nLast message in channel: ${cache[key]}`;
  const children = res.props.children;

  const alreadyAdded = typeof children === "string"
    ? children.includes("Last message in channel:")
    : Array.isArray(children)
    ? children.join("").includes("Last message in channel:")
    : false;

  if (alreadyAdded) return res;

  if (typeof children === "string") {
    res.props.children += extraLine;
  } else if (Array.isArray(children)) {
    children.push(extraLine);
  } else {
    res.props.children = [children, extraLine];
  }

  return res;
});

export const onUnload = () => {
  unpatchAll();
};
