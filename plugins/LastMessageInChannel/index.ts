import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { React } from "@vendetta/metro/common";

const { View, Text } = findByProps("Text", "View");
const SelectedChannelStore = findByProps("getChannelId", "getVoiceChannelId");
const RestAPI = findByProps("getAPIBaseURL", "get", "post");

const cache: Record<string, string> = {};

async function fetchLastMessage(userId: string, channelId: string): Promise<string | null> {
  const key = `${userId}:${channelId}`;
  if (cache[key]) return cache[key];

  try {
    const res = await RestAPI.get({
      url: `/channels/${channelId}/messages/search?author_id=${userId}&limit=1`,
    });

    const lastMsg = res?.body?.messages?.[0]?.[0];

    if (lastMsg) {
      const date = new Date(lastMsg.timestamp);
      const formatted = `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}/${date.getFullYear()}`;
      cache[key] = formatted;
      return formatted;
    }

    return null;
  } catch (e) {
    return null;
  }
}

function LastMessageLabel({ userId, channelId }: { userId: string; channelId: string }) {
  const [lastSeen, setLastSeen] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchLastMessage(userId, channelId).then((date) => {
      if (date) setLastSeen(date);
    });
  }, [userId, channelId]);

  if (!lastSeen) return null;

  return React.createElement(
    View,
    { style: { paddingHorizontal: 16, paddingTop: 8 } },
    React.createElement(
      Text,
      {
        style: {
          color: "#b5bac1",
          fontSize: 12,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
      },
      `Last message in channel: ${lastSeen}`
    )
  );
}

let unpatch: (() => void) | undefined;

export default {
  onLoad() {
    const UserPopout =
      findByProps("UserPopoutContainer") ?? findByProps("renderHeader", "renderBio");

    unpatch = after("default", UserPopout, (args, res) => {
      const userId = args?.[0]?.user?.id ?? args?.[0]?.userId;
      const channelId = SelectedChannelStore.getChannelId();

      if (!userId || !channelId || !res?.props) return res;

      const label = React.createElement(LastMessageLabel, { userId, channelId });

      if (Array.isArray(res.props.children)) {
        res.props.children.push(label);
      } else {
        res.props.children = [res.props.children, label];
      }

      return res;
    });
  },

  onUnload() {
    unpatch?.();
  },
};
