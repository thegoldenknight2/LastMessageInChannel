import { findByName, findByProps } from "@vendetta/metro";
import { findByStoreName } from "@vendetta/metro";
import { after, unpatchAll } from "@vendetta/patcher";

const SelectedChannelStore = findByStoreName("SelectedChannelStore");
const RestAPI = findByProps("getAPIBaseURL", "get", "post");
const BioText = findByName("BioText", false);

const cache: Record<string, string> = {};

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

after("default", BioText, ([props], res) => {
  if (!res?.props || !props.userId) return res;

  const userId = props.userId;
  const channelId = SelectedChannelStore?.getChannelId?.();
  if (!channelId) return res;

  const key = `${userId}:${channelId}`;

  if (!cache[key]) {
    // Fetch and cache, will show on next render
    RestAPI.get({
      url: `/channels/${channelId}/messages/search?author_id=${userId}&limit=1`,
    }).then((res: any) => {
      const lastMsg = res?.body?.messages?.[0]?.[0];
      if (lastMsg) {
        cache[key] = formatDate(lastMsg.timestamp);
      }
    }).catch(() => {});
    return res;
  }

  const extraLine = `\n\nLast message in channel: ${cache[key]}`;
  const children = res.props.children;

  if (typeof children === "string") {
    if (!children.includes(extraLine.trim()))
      res.props.children += extraLine;
  } else if (Array.isArray(children)) {
    if (!children.join("").includes(extraLine.trim()))
      children.push(extraLine);
  } else {
    res.props.children = [children, extraLine];
  }

  return res;
});

export const onUnload = () => {
  unpatchAll();
};
