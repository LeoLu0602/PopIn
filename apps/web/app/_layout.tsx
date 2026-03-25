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

    const segs = segments as string[];
    const inApp = segs[0] === "(app)";
    // Routes accessible without login
    const isGuestAllowed =
      (segs[0] === "(app)" && segs[1] === "(tabs)" && segs[2] === "feed") ||
      (segs[0] === "(app)" && segs[1] === "event") ||
      (segs[0] === "(app)" && segs[1] === "participants") ||
      (segs[0] === "(app)" && segs[1] === "profile") ||
      (segs[0] === "(app)" && segs[1] === "(tabs)" && segs[2] === "feedback");

    if (!session) {
      if (!inApp) {
        // Only auto-redirect to feed on the very first visit.
        // If the guest has already seen the feed (flag is set), they intentionally
        // navigated to the login page — let them stay.
        const alreadyRedirected =
          globalThis.sessionStorage?.getItem("guest-feed-redirect") === "1";
        if (!alreadyRedirected) {
          globalThis.sessionStorage?.setItem("guest-feed-redirect", "1");
          router.replace("/(app)/(tabs)/feed");
        }
      } else if (!isGuestAllowed) {
        // Guest trying to access a protected route → redirect to login
        router.replace("/");
      }
    } else {
      if (!inApp) {
        // Authenticated user on login page → send to feed
        router.replace("/(app)/(tabs)/feed");
      }
    }
  }, [session, segments, loading]);

  return <Slot />;
}
