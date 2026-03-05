import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';

const renderTabIcon = (
    name: React.ComponentProps<typeof MaterialIcons>['name'],
    color: string,
) => (
    <View
        style={{
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
        }}
    >
        <MaterialIcons
            name={name}
            size={28}
            color={color}
            style={{ transform: [{ translateY: 5 }] }}
        />
    </View>
);

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarShowLabel: false,
                tabBarHideOnKeyboard: true,
                tabBarActiveTintColor: '#BB0000',
                tabBarInactiveTintColor: '#5F6368',
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopWidth: 0,
                    height: 66,
                    paddingTop: 0,
                    paddingBottom: 0,
                    elevation: 0,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                },
                tabBarItemStyle: {
                    flex: 1,
                    paddingTop: 4,
                    paddingBottom: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                },
                tabBarIconStyle: {
                    margin: 0,
                    width: 32,
                    height: 32,
                    alignSelf: 'center',
                },
                sceneStyle: {},
                headerStyle: {
                    backgroundColor: '#BB0000',
                },
                headerTintColor: '#FFFFFF',
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
                headerTitleAlign: 'center',
            }}
        >
            <Tabs.Screen
                name="feed"
                options={{
                    title: 'Feed',
                    tabBarIcon: ({ color, focused }) =>
                        renderTabIcon(focused ? 'home-filled' : 'home', color),
                }}
            />
            <Tabs.Screen
                name="create"
                options={{
                    title: 'Create Event',
                    tabBarIcon: ({ color, focused }) =>
                        renderTabIcon(focused ? 'add-box' : 'add-box', color),
                }}
            />
            <Tabs.Screen
                name="my-events"
                options={{
                    title: 'My Events',
                    tabBarIcon: ({ color, focused }) =>
                        renderTabIcon(focused ? 'event' : 'event-note', color),
                }}
            />
            <Tabs.Screen
                name="feedback"
                options={{
                    title: 'Feedback',
                    tabBarIcon: ({ color, focused }) =>
                        renderTabIcon(focused ? 'forum' : 'feedback', color),
                }}
            />
            <Tabs.Screen
                name="my-profile"
                options={{
                    title: 'My Profile',
                    tabBarIcon: ({ color, focused }) =>
                        renderTabIcon(
                            focused ? 'account-circle' : 'account-circle',
                            color,
                        ),
                }}
            />
        </Tabs>
    );
}
