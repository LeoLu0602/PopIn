import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";

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
          },
          tabBarLabelStyle: {
            fontSize: 13,
            fontWeight: "600",
            marginBottom: 2,
          },
          sceneStyle: {
            width: "100%",
            maxWidth: 960,
            alignSelf: "center",
          },
          headerStyle: {
            backgroundColor: "#BB0000",
          },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: {
            fontWeight: "bold",
          },
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
