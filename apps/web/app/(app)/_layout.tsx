import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";

export default function AppLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          tabBarShowIcon: false,
          tabBarActiveTintColor: "#BB0000",
          tabBarInactiveTintColor: "#999",
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: "#E5E5E5",
            ...(Platform.OS === "web"
              ? {
                  height: 58,
                  width: "100%",
                  maxWidth: 960,
                  alignSelf: "center",
                }
              : {}),
          },
          tabBarLabelStyle: {
            fontSize: 13,
            fontWeight: "600",
            marginBottom: 2,
          },
          tabBarItemStyle: {
            paddingVertical: 6,
          },
          sceneStyle: {
            width: "100%",
            maxWidth: 960,
            alignSelf: "center",
            paddingHorizontal: 16,
            paddingTop: 8,
          },
          headerStyle: {
            backgroundColor: "#BB0000",
            ...(Platform.OS === "web"
              ? {
                  width: "100%",
                  maxWidth: 960,
                  alignSelf: "center",
                }
              : {}),
          },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: {
            fontWeight: "bold",
          },
          headerTitleAlign: "center",
        }}
      >
        <Tabs.Screen
          name="feed"
          options={{
            title: "Feed",
            tabBarLabel: "Feed",
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: "Create Event",
            tabBarLabel: "Create",
          }}
        />
        <Tabs.Screen
          name="my-events"
          options={{
            title: "My Events",
            tabBarLabel: "My Events",
          }}
        />
        <Tabs.Screen
          name="feedback"
          options={{
            title: "Feedback",
            tabBarLabel: "Feedback",
          }}
        />
        <Tabs.Screen
          name="my-profile"
          options={{
            title: "My Profile",
            tabBarLabel: "Profile",
          }}
        />
        <Tabs.Screen
          name="event/[id]"
          options={{
            href: null,
            title: "Event Details",
          }}
        />
        <Tabs.Screen
          name="edit-event"
          options={{
            href: null,
            title: "Edit Event",
          }}
        />
        <Tabs.Screen
          name="profile/[id]"
          options={{
            href: null,
            title: "Profile",
          }}
        />
      </Tabs>
    </>
  );
}
