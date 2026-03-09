import { useState, useEffect } from "react";
import { View, Text, ScrollView, RefreshControl, Alert, TouchableOpacity } from "react-native";
import { supabase } from "../../../lib/supabase";
import type { EventWithDetails } from "shared";
import { EventCard } from "../../../components/EventCard";

type TopTab = "hosting" | "joined";
type TimeFilter = "now" | "upcoming" | "past";

const TOP_TABS: Array<{ value: TopTab; label: string }> = [
  { value: "hosting", label: "Hosting" },
  { value: "joined", label: "Joined" },
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
      .filter((e) => new Date(e.start_time) <= now && getEndTime(e) >= now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }
  if (filter === "upcoming") {
    return events
      .filter((e) => new Date(e.start_time) > now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }
  // past
  return events
    .filter((e) => getEndTime(e) < now)
    .sort((a, b) => getEndTime(b).getTime() - getEndTime(a).getTime());
}

export default function MyEventsScreen() {
  const [hostingEvents, setHostingEvents] = useState<EventWithDetails[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<EventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [topTab, setTopTab] = useState<TopTab>("joined");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("upcoming");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  const fetchMyEvents = async () => {
    if (!userId) return;

    setLoading(true);

    const [hostingResult, memberResult] = await Promise.all([
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
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 16 }}
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
          visibleEvents.map((event) => (
            <View key={event.id} className="mx-4 mb-4">
              <EventCard event={event} />
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
