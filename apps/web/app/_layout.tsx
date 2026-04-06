import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import "../global.css";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { registerForPushNotifications } from "../lib/notifications";
import GuestGateModal from "../components/GuestGateModal";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestGate, setGuestGate] = useState<{ visible: boolean; routeKey: string | null }>({
    visible: false,
    routeKey: null,
  });
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
        // Guest trying to access a protected route → show gate modal
        const routeKey = segs[1] === "(tabs)" ? segs[2] : segs[1];
        setGuestGate({ visible: true, routeKey: routeKey ?? null });
      }
    } else {
      if (!inApp) {
        // Authenticated user on login page → send to feed
        router.replace("/(app)/(tabs)/feed");
      }
    }
  }, [session, segments, loading]);

  const handleGuestGateConfirm = () => {
    setGuestGate({ visible: false, routeKey: null });
    router.replace("/");
  };

  const handleGuestGateDismiss = () => {
    setGuestGate({ visible: false, routeKey: null });
    router.replace("/(app)/(tabs)/feed");
  };

  return (
    <>
      <Slot />
      <Analytics />
      <GuestGateModal
        visible={guestGate.visible}
        routeKey={guestGate.routeKey}
        onConfirm={handleGuestGateConfirm}
        onDismiss={handleGuestGateDismiss}
      />
    </>
  );
}
