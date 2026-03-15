import { findByName, findByStoreName, findByProps } from "@vendetta/metro";
import { after, unpatchAll } from "@vendetta/patcher";

const SelectedChannelStore = findByStoreName("SelectedChannelStore");
const RestAPI = findByProps("getAPIBaseURL", "get", "post");
const BioText = findByName("BioText", false);

after("default", BioText, ([props], res) => {
  console.log("[LastMsg] props:", JSON.stringify(Object.keys(props)));
  console.log("[LastMsg] userId:", props.userId);
  console.log("[LastMsg] channelId from store:", SelectedChannelStore?.getChannelId?.());
  console.log("[LastMsg] all props values:", JSON.stringify(props));
  return res;
});

export const onUnload = () => {
  unpatchAll();
};
