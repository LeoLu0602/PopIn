import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import * as Location from "expo-location";
import { supabase } from "../../../lib/supabase";
import type { EventWithDetails } from "shared";
import { EventCard } from "../../../components/EventCard";

type FilterType = "all" | "next3hours" | "today";
type SortType = "distance" | "time";

type Coordinates = {
  latitude: number;
  longitude: number;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const distanceInMeters = (from: Coordinates, to: Coordinates): number => {
  const earthRadius = 6371000;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return earthRadius * centralAngle;
};

const compareByStartTime = (a: EventWithDetails, b: EventWithDetails) =>
  new Date(a.start_time).getTime() - new Date(b.start_time).getTime();

export default function FeedScreen() {
  const [events, setEvents] = useState<EventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("time");
  const [userId, setUserId] = useState<string | null>(null);
  const [userCoordinates, setUserCoordinates] = useState<Coordinates | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  useEffect(() => {
    const loadLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setUserCoordinates(null);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    };

    loadLocation().catch((error) => {
      console.error("Failed to get user location", error);
      setUserCoordinates(null);
    });
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("events")
      .select(
        `
        *,
        host:profiles!events_host_id_fkey(id, email, display_name),
        event_members(user_id)
      `,
      )
      .eq("status", "active")
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true });

    const now = new Date();

    if (filter === "next3hours") {
      const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      query = query.lte("start_time", threeHoursLater.toISOString());
    } else if (filter === "today") {
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte("start_time", endOfDay.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      Alert.alert("Error", "Failed to load events");
      console.error(error);
    } else {
      const eventsWithDetails: EventWithDetails[] = (data || []).map(
        (event: any) => ({
          ...event,
          host: event.host,
          attendee_count: event.event_members?.length || 0,
          is_joined: userId
            ? event.event_members?.some((m: any) => m.user_id === userId)
            : false,
        }),
      );
      if (sortBy === "distance" && userCoordinates) {
        const geocodedEvents = await Promise.all(
          eventsWithDetails.map(async (event) => {
            try {
              const geocoded = await Location.geocodeAsync(event.location_text);
              if (geocoded.length === 0) {
                return { event, distance: Number.POSITIVE_INFINITY };
              }

              const { latitude, longitude } = geocoded[0];
              const distance = distanceInMeters(userCoordinates, {
                latitude,
                longitude,
              });

              return { event, distance };
            } catch {
              return { event, distance: Number.POSITIVE_INFINITY };
            }
          }),
        );

        const sortedByDistanceThenTime = geocodedEvents
          .sort((a, b) => {
            if (a.distance === b.distance) {
              return compareByStartTime(a.event, b.event);
            }
            return a.distance - b.distance;
          })
          .map(({ event }) => event);

        setEvents(sortedByDistanceThenTime);
      } else {
        setEvents([...eventsWithDetails].sort(compareByStartTime));
      }
    }

    setLoading(false);
  }, [filter, userId, sortBy, userCoordinates]);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents])
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View className="flex-1 bg-osu-light">
      <View className="bg-white px-4 py-3 border-b border-gray-200">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row"
        >
          <TouchableOpacity
            onPress={() => setFilter("all")}
            className={`mr-2 px-4 py-2 rounded-lg ${
              filter === "all" ? "bg-osu-scarlet" : "bg-gray-100"
            }`}
          >
            <Text
              className={`font-semibold ${filter === "all" ? "text-white" : "text-osu-dark"}`}
            >
              All Events
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFilter("next3hours")}
            className={`mr-2 px-4 py-2 rounded-lg ${
              filter === "next3hours" ? "bg-osu-scarlet" : "bg-gray-100"
            }`}
          >
            <Text
              className={`font-semibold ${filter === "next3hours" ? "text-white" : "text-osu-dark"}`}
            >
              Next 3 Hours
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFilter("today")}
            className={`mr-2 px-4 py-2 rounded-lg ${
              filter === "today" ? "bg-osu-scarlet" : "bg-gray-100"
            }`}
          >
            <Text
              className={`font-semibold ${filter === "today" ? "text-white" : "text-osu-dark"}`}
            >
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSortBy("time")}
            className={`mr-2 px-4 py-2 rounded-lg ${
              sortBy === "time" ? "bg-osu-scarlet" : "bg-gray-100"
            }`}
          >
            <Text
              className={`font-semibold ${sortBy === "time" ? "text-white" : "text-osu-dark"}`}
            >
              By Time
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSignOut}
            className="px-4 py-2 rounded-lg bg-gray-100"
          >
            <Text className="font-semibold text-osu-dark">Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchEvents}
            tintColor="#BB0000"
          />
        }
      >
        {events.length === 0 && !loading && (
          <View className="items-center justify-center py-12">
            <Text className="text-gray-500 text-lg">No events found</Text>
            <Text className="text-gray-400 mt-2">Try a different filter</Text>
          </View>
        )}

        {events.map((event) => (
          <View key={event.id} className="mb-4">
            <EventCard event={event} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
