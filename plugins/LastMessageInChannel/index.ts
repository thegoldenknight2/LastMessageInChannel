import { findByProps } from "@vendetta/metro";
import { instead, after } from "@vendetta/patcher";
import { React } from "@vendetta/metro/common";

const { View, Text } = findByProps("View", "Text") ?? require("react-native");
const UserStore = findByProps("getUser", "getCurrentUser");
const ChannelStore = findByProps("getChannel", "getDMFromUserId");
const SelectedChannelStore = findByProps("getChannelId", "getVoiceChannelId");
const RestAPI = findByProps("getAPIBaseURL", "get", "post");

const cache = {};

async function fetchLastMessage(userId, channelId) {
  const key = `${userId}:${channelId}`;
  if (cache[key]) return cache[key];

  try {
    const res = await RestAPI.get({
      url: `/channels/${channelId}/messages/search?author_id=${userId}&limit=1`,
    });

    const messages = res?.body?.messages?.[0];
    const lastMsg = messages?.[0];

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

let unpatch;

export default {
  onLoad() {
    const UserProfileSection = findByProps("PRIMARY_INFO", "UserProfileSections");
    const UserPopout = findByProps("UserPopoutContainer") 
      ?? findByProps("renderHeader", "renderBio");

    // We patch the user popout component
    unpatch = after("default", UserPopout, (args, res) => {
      const userId = args?.[0]?.user?.id ?? args?.[0]?.userId;
      const channelId = SelectedChannelStore.getChannelId();

      if (!userId || !channelId) return res;

      const [lastSeen, setLastSeen] = React.useState(null);

      React.useEffect(() => {
        fetchLastMessage(userId, channelId).then((date) => {
          if (date) setLastSeen(date);
        });
      }, [userId, channelId]);

      if (!lastSeen || !res?.props?.children) return res;

      const label = React.createElement(
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

      // Inject into the popout's children
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
