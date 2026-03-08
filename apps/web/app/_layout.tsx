import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import "../global.css";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { registerForPushNotifications } from "../lib/notifications";
import * as Notifications from "expo-notifications";
import { Modal, Platform, Pressable, Text, View } from "react-native";

const SAFETY_REMINDER_TITLE = "Safety Reminder";
const SAFETY_REMINDER_MESSAGE =
  "PopIn connects OSU students. Everyone is verified with an @osu.edu email. Always meet in public campus spaces.";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSafetyReminder, setShowSafetyReminder] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // expo-notifications is not fully supported on web; guard setup to avoid runtime crashes.
    if (Platform.OS === "web") return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user?.id) {
        registerForPushNotifications(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user?.id) {
        registerForPushNotifications(session.user.id);
      }

      if (event === "SIGNED_IN") {
        setShowSafetyReminder(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const inApp = segments[0] === "(app)";

    if (!session && inApp) {
      router.replace("/");
    } else if (session && !inApp) {
      router.replace("/(app)/(tabs)/feed");
    }
  }, [session, segments, loading]);

  return (
    <>
      <Slot />
      <Modal
        visible={showSafetyReminder}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSafetyReminder(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "center",
            paddingHorizontal: 20,
          }}
        >
          <View className="bg-white rounded-2xl p-6">
            <Text className="text-xl font-bold text-osu-dark mb-3">{SAFETY_REMINDER_TITLE}</Text>
            <Text className="text-base text-gray-700 leading-6">{SAFETY_REMINDER_MESSAGE}</Text>

            <Pressable
              className="mt-6 bg-osu-scarlet rounded-xl py-3 items-center"
              onPress={() => setShowSafetyReminder(false)}
            >
              <Text className="text-white font-semibold">Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
