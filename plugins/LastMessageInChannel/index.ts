import { findByStoreName, findByName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { ReactNative } from "@vendetta/metro/common";

// 1. Grab Discord's internal memory stores
const MessageStore = findByStoreName("MessageStore");
const SelectedChannelStore = findByStoreName("SelectedChannelStore");
const { Text, View, StyleSheet } = ReactNative;

let unpatchProfile: () => void;

export default {
    onLoad: () => {
        // 2. Find the User Profile component (Note: Discord updates can change this name)
        const UserProfile = findByName("UserProfile", false); 
        
        if (!UserProfile) {
            console.log("[LastMessageInChannel] Could not find UserProfile component.");
            return;
        }

        // 3. Inject our custom code right after the Profile renders
        unpatchProfile = after("default", UserProfile, (args, res) => {
            const user = args[0]?.user;
            if (!user) return;

            // Get the channel you are currently looking at
            const channelId = SelectedChannelStore.getChannelId();
            if (!channelId) return;

            // Get the cached messages for this channel
            const messages = MessageStore.getMessages(channelId);
            if (!messages || !messages._array) return;

            // Filter messages to find ones sent by the user whose profile we opened
            const userMessages = messages._array.filter((m: any) => m.author?.id === user.id);
            
            // Get the most recent one
            const lastMessage = userMessages[userMessages.length - 1];

            if (lastMessage) {
                // Format the timestamp nicely
                const dateOptions: Intl.DateTimeFormatOptions = { 
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                };
                const formattedDate = new Date(lastMessage.timestamp).toLocaleDateString(undefined, dateOptions);

                // Create the text element to inject into the UI
                const lastMessageElement = React.createElement(
                    Text, 
                    { style: styles.textStyle }, 
                    `Last seen here: ${formattedDate}`
                );

                // Safely push this new text element into the profile's children array
                // (Checking if res.props.children exists and is an array)
                if (res?.props?.children && Array.isArray(res.props.children)) {
                    res.props.children.push(lastMessageElement);
                }
            }
        });
    },
    
    onUnload: () => {
        // Always clean up the patch when the plugin is turned off
        if (unpatchProfile) unpatchProfile();
    }
}

// Basic styling for the injected text
const styles = StyleSheet.create({
    textStyle: {
        color: "#A3A6AA", // Discord's muted text color
        fontSize: 12,
        marginTop: 4,
        textAlign: "center"
    }
});
                        
