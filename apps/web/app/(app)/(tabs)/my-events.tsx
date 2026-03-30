import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, Alert, TouchableOpacity } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../../lib/supabase";
import type { EventWithDetails } from "shared";
import { EventCard } from "../../../components/EventCard";
import { triggerBadgeRefresh } from "../../../lib/notifBadge";

type TopTab = "hosting" | "joined";
type TimeFilter = "now" | "upcoming" | "past";

const TOP_TABS: Array<{ value: TopTab; label: string }> = [
  { value: "hosting", label: "Host" },
  { value: "joined", label: "Join" },
];

const TIME_FILTERS: Array<{ value: TimeFilter; label: string }> = [
  { value: "now", label: "Now" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
];

const EMPTY_STATES: Record<TopTab, Record<TimeFilter, { message: string; sub: string }>> = {
  hosting: {
    now: { message: "You're not hosting anything right now", sub: "Create an event from the Create tab" },
    upcoming: { message: "No upcoming events to host", sub: "Create one from the Create tab" },
    past: { message: "No past hosted events", sub: "Events you've hosted will appear here" },
  },
  joined: {
    now: { message: "No events happening right now", sub: "Check Upcoming for what's next" },
    upcoming: { message: "No upcoming events", sub: "Browse events in the Feed" },
    past: { message: "No past events yet", sub: "Events you've attended will appear here" },
  },
};

function getEndTime(event: EventWithDetails): Date {
  const start = new Date(event.start_time);
  return (event as any).end_time
    ? new Date((event as any).end_time)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000);
}

function applyTimeFilter(events: EventWithDetails[], filter: TimeFilter): EventWithDetails[] {
  const now = new Date();

  if (filter === "now") {
    return events
      .filter((e) => (e as any).status !== "canceled" && new Date(e.start_time) <= now && getEndTime(e) >= now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }
  if (filter === "upcoming") {
    return events
      .filter((e) => new Date(e.start_time) > now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }
  // past: active events where end_time < now, OR cancelled events where start_time < now
  return events
    .filter((e) =>
      (e as any).status === "canceled"
        ? new Date(e.start_time) < now
        : getEndTime(e) < now
    )
    .sort((a, b) => getEndTime(b).getTime() - getEndTime(a).getTime());
}

export default function MyEventsScreen() {
  const [hostingEvents, setHostingEvents] = useState<EventWithDetails[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<EventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [topTab, setTopTab] = useState<TopTab>("joined");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("upcoming");
  // Map of eventId -> notification type for unread notifications
  const [unreadMap, setUnreadMap] = useState<Map<string, "event_updated" | "event_cancelled">>(new Map());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (userId) fetchMyEvents();
      return () => {
        // Refresh badge when leaving My Events (notifications may have been read)
        triggerBadgeRefresh();
      };
    }, [userId])
  );

  const fetchMyEvents = async () => {
    if (!userId) return;

    setLoading(true);

    const [hostingResult, memberResult, notifResult] = await Promise.all([
      supabase
        .from("events")
        .select(
          `*, host:profiles!events_host_id_fkey(id, email, display_name), event_members(user_id)`,
        )
        .eq("host_id", userId),
      supabase
        .from("event_members")
        .select(
          `event_id, events(*, host:profiles!events_host_id_fkey(id, email, display_name), event_members(user_id))`,
        )
        .eq("user_id", userId),
      supabase
        .from("event_notifications")
        .select("event_id, type")
        .eq("user_id", userId)
        .eq("read", false),
    ]);

    if (hostingResult.error) {
      Alert.alert("Error", "Failed to load hosting events");
      console.error(hostingResult.error);
    } else {
      setHostingEvents(
        (hostingResult.data || []).map((event: any) => ({
          ...event,
          host: event.host,
          attendee_count: event.event_members?.length || 0,
          is_joined: false,
        })),
      );
    }

    if (memberResult.error) {
      Alert.alert("Error", "Failed to load joined events");
      console.error(memberResult.error);
    } else {
      setJoinedEvents(
        (memberResult.data || [])
          .filter((m: any) => m.events && m.events.host_id !== userId)
          .map((m: any) => ({
            ...m.events,
            host: m.events.host,
            attendee_count: m.events.event_members?.length || 0,
            is_joined: true,
          })),
      );
    }

    if (!notifResult.error && notifResult.data) {
      const map = new Map<string, "event_updated" | "event_cancelled">();
      for (const n of notifResult.data as any[]) {
        // Cancelled takes priority over updated
        if (!map.has(n.event_id) || n.type === "event_cancelled") {
          map.set(n.event_id, n.type);
        }
      }
      setUnreadMap(map);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (userId) fetchMyEvents();
  }, [userId]);

  const allEvents = topTab === "hosting" ? hostingEvents : joinedEvents;
  const visibleEvents = applyTimeFilter(allEvents, timeFilter);
  const empty = EMPTY_STATES[topTab][timeFilter];

  return (
    <View className="flex-1 bg-gray-100">
      {/* Primary tab bar */}
      <View className="px-4 pt-3 pb-2 items-center">
        <View className="flex-row items-center rounded-full border border-gray-300 p-1">
          {TOP_TABS.map((tab, index) => {
            const isActive = topTab === tab.value;
            return (
              <TouchableOpacity
                key={tab.value}
                onPress={() => setTopTab(tab.value)}
                className={`px-5 py-2 rounded-full ${isActive ? "bg-osu-scarlet" : "bg-transparent"}`}
                style={{ marginRight: index < TOP_TABS.length - 1 ? 4 : 0 }}
              >
                <Text className={`font-semibold ${isActive ? "text-white" : "text-gray-700"}`}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Secondary time filter */}
      <View className="px-4 pb-3 items-center">
        <View className="flex-row items-center">
          {TIME_FILTERS.map((f, index) => {
            const isActive = timeFilter === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                onPress={() => setTimeFilter(f.value)}
                className={`px-3 py-1 rounded-full ${isActive ? "bg-gray-200" : "bg-transparent"}`}
                style={{ marginRight: index < TIME_FILTERS.length - 1 ? 2 : 0 }}
              >
                <Text
                  className={`text-sm ${isActive ? "text-gray-800 font-medium" : "text-gray-400"}`}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 88 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchMyEvents} tintColor="#BB0000" />
        }
      >
        {visibleEvents.length === 0 && !loading ? (
          <View className="bg-white rounded-xl p-6 items-center mx-4">
            <Text className="text-gray-500">{empty.message}</Text>
            <Text className="text-gray-400 text-sm mt-1">{empty.sub}</Text>
          </View>
        ) : (
          visibleEvents.map((event) => {
            const notifType = unreadMap.get(event.id);
            const isCanceled = (event as any).status === "canceled";
            const hasUnreadCancellation = notifType === "event_cancelled";
            // isUpdated is notification-based (disappears after read)
            const isUpdated = !isCanceled && notifType === "event_updated";
            const isHostTab = topTab === "hosting";
            // Grey out only after the attendee has opened the event (notification read)
            // For host tab, always grey out cancelled events
            const shouldGrayOut = isCanceled && (isHostTab || !hasUnreadCancellation);

            return (
              <View
                key={event.id}
                className="mx-4 mb-4"
                style={shouldGrayOut ? { opacity: 0.6 } : undefined}
              >
                {/* Status pill — permanent based on event.status */}
                {isCanceled && (
                  <View className="flex-row justify-end mb-1">
                    {isHostTab ? (
                      <View className="bg-gray-100 border border-gray-300 px-2 py-0.5 rounded-full">
                        <Text style={{ color: "#6B7280", fontSize: 10, fontWeight: "600" }}>
                          Cancelled
                        </Text>
                      </View>
                    ) : (
                      <View className="bg-red-600 px-2 py-0.5 rounded-full">
                        <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "600" }}>
                          ✕ Cancelled
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Updated pill — notification-based (disappears after read) */}
                {isUpdated && (
                  <View className="flex-row justify-end mb-1">
                    <View className="bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                      <Text style={{ color: "#BB0000", fontSize: 10, fontWeight: "600" }}>
                        Updated →
                      </Text>
                    </View>
                  </View>
                )}

                <View
                  style={
                    isCanceled
                      ? {
                          borderLeftWidth: 4,
                          borderLeftColor: isHostTab ? "#D1D5DB" : "#DC2626",
                          borderRadius: 8,
                        }
                      : isUpdated
                        ? { borderLeftWidth: 4, borderLeftColor: "#BB0000", borderRadius: 8 }
                        : undefined
                  }
                >
                  <EventCard event={event} />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
