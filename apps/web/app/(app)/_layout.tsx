import { Stack } from 'expo-router';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AppLayout() {
    return (
        <>
            <StatusBar style="dark" />
            <Stack
                screenOptions={{
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
                <Stack.Screen
                    name="(tabs)"
                    options={{
                        headerShown: false,
                    }}
                />
                <Stack.Screen
                    name="event/[id]"
                    options={{
                        title: 'Event Details',
                        headerBackVisible: false,
                        headerLeft: () => (
                            <TouchableOpacity
                                onPress={() => router.replace('/(app)/(tabs)/feed')}
                                style={{ paddingHorizontal: 6, paddingVertical: 4 }}
                                accessibilityRole="button"
                                accessibilityLabel="Back to feed"
                            >
                                <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                            </TouchableOpacity>
                        ),
                    }}
                />
                <Stack.Screen
                    name="edit-event"
                    options={{
                        title: 'Edit Event',
                    }}
                />
                <Stack.Screen
                    name="profile/[id]"
                    options={{
                        title: 'Profile',
                    }}
                />
            </Stack>
        </>
    );
}
