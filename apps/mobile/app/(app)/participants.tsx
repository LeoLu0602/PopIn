import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../lib/supabase";
import type { EventParticipant } from "shared";

export default function ParticipantsScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;

    const fetchParticipants = async () => {
      const { data, error } = await (supabase
        .from("event_members")
        .select(
          "user_id, profile:profiles!event_members_user_id_fkey(id, email, display_name, avatar_url)",
        )
        .eq("event_id", eventId) as any);

      if (!error) {
        setParticipants((data as EventParticipant[]) ?? []);
      }
      setLoading(false);
    };

    fetchParticipants();
  }, [eventId]);

  if (loading) {
    return (
      <View className="flex-1 bg-osu-light items-center justify-center">
        <ActivityIndicator size="large" color="#BB0000" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-osu-light">
      <View className="p-4 gap-2">
        {participants.length === 0 ? (
          <Text className="text-gray-500 text-center mt-8">
            No participants yet
          </Text>
        ) : (
          participants.map((p) => {
            const displayName =
              p.profile?.display_name ||
              p.profile?.email?.split("@")[0] ||
              "Unknown";
            const initials = displayName.trim().slice(0, 1).toUpperCase();
            return (
              <TouchableOpacity
                key={p.user_id}
                className="flex-row items-center bg-white rounded-xl px-4 py-3"
                style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
                onPress={() => router.push(`/(app)/profile/${p.user_id}`)}
                activeOpacity={0.7}
              >
                {p.profile?.avatar_url ? (
                  <Image
                    source={{ uri: p.profile.avatar_url }}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <View className="w-10 h-10 rounded-full bg-osu-scarlet items-center justify-center">
                    <Text className="text-white font-bold text-base">
                      {initials}
                    </Text>
                  </View>
                )}
                <Text className="ml-3 text-osu-dark font-medium text-base">
                  {displayName}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
