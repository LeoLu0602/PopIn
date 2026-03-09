import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import "../global.css";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { registerForPushNotifications } from "../lib/notifications";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);

      if (session?.user?.id) {
        registerForPushNotifications(session.user.id);
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

  return <Slot />;
}
