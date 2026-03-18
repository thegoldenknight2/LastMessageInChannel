import { find } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms } from "@vendetta/ui/components";

const { FormRow } = Forms;

// Find required Discord modules
const UserProfileScreen = find(m => m?.type?.render?.name === "UserProfileHeader");
const ChannelStore = find(m => m.getChannel && m.getChannels);
const MessageStore = find(m => m.getMessages && m.getMessage);
const GuildStore = find(m => m.getGuild && m.getGuilds);

let patches = [];

export default {
  onLoad: () => {
    // Patch the profile render to add our row
    patches.push(
      before("render", UserProfileScreen.type, (args) => {
        const props = args[0];
        const userId = props.userId; // User ID from profile
        const guildId = props.guildId; // Current guild ID

        if (!userId || !guildId) return; // Not in a guild context

        // Find the latest message from this user in the guild
        const lastMessage = getLatestUserMessageInGuild(userId, guildId);
        if (!lastMessage) return;

        // Store the timestamp to be used in the injected component
        props.__lastMessageTimestamp = lastMessage.timestamp;
      })
    );

    // Inject our row into the profile's info section
    patches.push(
      after("render", UserProfileScreen.type, (_, ret) => {
        const props = ret.props;
        if (!props.__lastMessageTimestamp) return ret;

        // Find the section where we want to insert our row
        const infoSection = findInTree(ret, (n) => n?.type?.name === "UserProfileInfo");
        if (!infoSection) return ret;

        // Append our row
        infoSection.props.children.push(
          React.createElement(FormRow, {
            label: "Last Message",
            subLabel: formatTimestamp(props.__lastMessageTimestamp),
            icon: getAssetIDByName("ic_message_24px"),
          })
        );

        return ret;
      })
    );
  },
  onUnload: () => {
    patches.forEach(p => p());
  },
};

// Helper: Find the latest message from a user in a guild
function getLatestUserMessageInGuild(userId, guildId) {
  const guild = GuildStore.getGuild(guildId);
  if (!guild) return null;

  let latest = null;

  // Iterate over all channels in the guild
  for (const channel of Object.values(guild.channels)) {
    const messages = MessageStore.getMessages(channel.id);
    if (!messages) continue;

    for (const message of messages) {
      if (message.author.id === userId) {
        const ts = new Date(message.timestamp);
        if (!latest || ts > new Date(latest.timestamp)) {
          latest = message;
        }
      }
    }
  }

  return latest;
}

// Helper: Format timestamp nicely
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

// Utility: Recursively search a React tree for a node matching a predicate
function findInTree(tree, filter) {
  if (!tree) return null;
  if (filter(tree)) return tree;

  if (Array.isArray(tree)) {
    for (const item of tree) {
      const found = findInTree(item, filter);
      if (found) return found;
    }
  } else if (tree.props && tree.props.children) {
    const found = findInTree(tree.props.children, filter);
    if (found) return found;
  }

  return null;
            }
