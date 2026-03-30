import { Tabs, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { getUnreadNotificationCount } from '../../../lib/notifications';
import { registerBadgeRefresh } from '../../../lib/notifBadge';
import { Pressable, Text, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import type { Session } from '@supabase/supabase-js';

const SAFETY_DISMISSED_KEY_PREFIX = 'safety-reminder-dismissed:';

const hasDismissedSafetyReminder = (userId: string): boolean => {
    try {
        return globalThis.sessionStorage?.getItem(`${SAFETY_DISMISSED_KEY_PREFIX}${userId}`) === '1';
    } catch {
        return false;
    }
};

const markSafetyReminderDismissed = (userId: string) => {
    try {
        globalThis.sessionStorage?.setItem(`${SAFETY_DISMISSED_KEY_PREFIX}${userId}`, '1');
    } catch {}
};

const clearSafetyReminderDismissedFlags = () => {
    try {
        const storage = globalThis.sessionStorage;
        if (!storage) return;
        const keysToRemove: string[] = [];
        for (let i = 0; i < storage.length; i += 1) {
            const key = storage.key(i);
            if (key?.startsWith(SAFETY_DISMISSED_KEY_PREFIX)) keysToRemove.push(key);
        }
        keysToRemove.forEach((key) => storage.removeItem(key));
    } catch {}
};

const renderTabIcon = (
    name: React.ComponentProps<typeof MaterialIcons>['name'],
    color: string,
    label: string,
) => (
    <View
        style={{
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
        }}
    >
        <MaterialIcons name={name} size={24} color={color} />
        <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: '500' }}>{label}</Text>
    </View>
);

export default function TabsLayout() {
    const [notifCount, setNotifCount] = useState(0);
    const [showBanner, setShowBanner] = useState(false);
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
        return () => subscription.unsubscribe();
    }, []);

    const requireAuth = (e: { preventDefault: () => void }) => {
        if (!session) {
            e.preventDefault();
            router.push('/');
        }
    };

    const refreshBadge = () => {
        getUnreadNotificationCount().then(setNotifCount);
    };

    useEffect(() => {
        refreshBadge();
        registerBadgeRefresh(refreshBadge);
    }, []);

    useEffect(() => {
        let isMounted = true;

        const syncBannerWithCurrentUser = async () => {
            const { data } = await supabase.auth.getUser();
            const userId = data.user?.id;
            if (!isMounted) return;
            if (!userId) {
                setShowBanner(false);
                return;
            }
            setShowBanner(!hasDismissedSafetyReminder(userId));
        };

        void syncBannerWithCurrentUser();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            const userId = session?.user?.id;
            if (!userId) {
                clearSafetyReminderDismissedFlags();
                setShowBanner(false);
                return;
            }
            setShowBanner(!hasDismissedSafetyReminder(userId));
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const dismissBanner = async () => {
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;
        if (userId) {
            markSafetyReminderDismissed(userId);
        }
        setShowBanner(false);
    };

    return (
        <View style={{ flex: 1 }}>
            {showBanner && (
                <View
                    style={{
                        backgroundColor: '#FFFBEB',
                        borderBottomWidth: 1,
                        borderBottomColor: '#FDE68A',
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                    }}
                >
                    <MaterialIcons name="warning-amber" size={16} color="#D97706" />
                    <View style={{ flex: 1, marginHorizontal: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#92400E' }}>
                            Safety Reminder
                        </Text>
                        <Text style={{ fontSize: 12, color: '#78350F', lineHeight: 16 }}>
                            Be cautious when meeting people through PopIn. Events starting with [Testing] and hosted by popin-team are for testing only.
                        </Text>
                    </View>
                    <Pressable
                        onPress={dismissBanner}
                        accessibilityRole="button"
                        accessibilityLabel="Close safety reminder"
                        style={{ padding: 4 }}
                    >
                        <MaterialIcons name="close" size={16} color="#92400E" />
                    </Pressable>
                </View>
            )}
            <Tabs
                screenOptions={{
                tabBarShowLabel: false,
                tabBarHideOnKeyboard: true,
                tabBarActiveTintColor: '#BB0000',
                tabBarInactiveTintColor: '#5F6368',
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopWidth: 0,
                    height: 72,
                    paddingTop: 4,
                    paddingBottom: 6,
                    elevation: 0,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                },
                tabBarItemStyle: {
                    flex: 1,
                    flexDirection: 'column',
                    paddingTop: 4,
                    paddingBottom: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                },
                tabBarIconStyle: {
                    margin: 0,
                    width: 28,
                    height: 28,
                    alignSelf: 'center',
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '500',
                    marginTop: 2,
                },
                sceneStyle: {},
                headerShown: false,
            }}
        >
            <Tabs.Screen
                name="feed"
                options={{
                    title: 'Feed',
                    tabBarIcon: ({ color, focused }) =>
                        renderTabIcon(focused ? 'home-filled' : 'home', color, 'Feed'),
                }}
            />
            <Tabs.Screen
                name="create"
                options={{
                    title: 'Create Event',
                    tabBarIcon: ({ color }) =>
                        renderTabIcon('add-box', color, 'Create'),
                }}
                listeners={{ tabPress: requireAuth }}
            />
            <Tabs.Screen
                name="my-events"
                options={{
                    title: 'My Events',
                    tabBarIcon: ({ color, focused }) =>
                        renderTabIcon(focused ? 'event' : 'event-note', color, 'My Events'),
                    tabBarBadge: notifCount > 0 ? (notifCount > 9 ? '9+' : notifCount) : undefined,
                    tabBarBadgeStyle: { backgroundColor: '#BB0000', fontSize: 10 },
                }}
                listeners={{ tabPress: requireAuth }}
            />
            <Tabs.Screen
                name="feedback"
                options={{
                    title: 'Feedback',
                    tabBarIcon: ({ color, focused }) =>
                        renderTabIcon(focused ? 'forum' : 'feedback', color, 'Feedback'),
                }}
            />
            <Tabs.Screen
                name="my-profile"
                options={{
                    title: 'My Profile',
                    tabBarIcon: ({ color }) =>
                        renderTabIcon('account-circle', color, 'Profile'),
                }}
                listeners={{ tabPress: requireAuth }}
            />
            </Tabs>
        </View>
    );
}
