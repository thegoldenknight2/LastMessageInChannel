import { findByStoreName, findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { React } from "@vendetta/metro/common";

const MessageStore = findByStoreName("MessageStore");
const { Text, View, StyleSheet } = findByProps("Text", "View", "StyleSheet");

let unpatchProfile;

export default {
    onLoad: () => {
        const UserProfile = findByProps("getUserProfile");
        
        unpatchProfile = after("getUserProfile", UserProfile, (args, res) => {
            if (!res) return;

            // This is where your custom logic for the last message goes
            console.log("Profile opened!");
        });
    },
    onUnload: () => {
        if (unpatchProfile) unpatchProfile();
    }
};
