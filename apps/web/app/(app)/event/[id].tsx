import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, ScrollView, Alert, ActivityIndicator, TouchableOpacity, Image, Platform } from "react-native";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { requestFeedRefresh } from "../../../lib/feedRefresh";
import type { EventWithDetails } from "shared";
import { PrimaryButton, SecondaryButton } from "../../../components/Button";
import { getPostHog, buildEventProps } from "../../../lib/posthog";

function notifyPush(type: "join" | "update" | "cancel", eventId: string, actorId: string) {
  supabase.functions
    .invoke("send-push", { body: { type, event_id: eventId, actor_id: actorId } })
    .then(({ error }) => {
      if (error) console.warn(`[push] ${type} notify error:`, error);
      else console.log(`[push] ${type} notification sent`);
    })
    .catch((err) => console.warn(`[push] ${type} notify failed:`, err));
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  // Refs to prevent duplicate analytics fires
  const detailOpenedFired = useRef(false);
  // const attendedFired = useRef(false);
  const joinClickedInFlight = useRef(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  const fetchEvent = async () => {
    setLoading(true);

    const { data, error } = (await supabase
      .from("events")
      .select(
        `
        *,
        host:profiles!events_host_id_fkey(id, email, display_name, hosted_count),
        event_members(user_id)
      `,
      )
      .eq("id", id)
      .single()) as any;

    if (error) {
      Alert.alert("Error", "Failed to load event");
      console.error(error);
      router.back();
    } else {
      const eventWithDetails: EventWithDetails = {
        ...data,
        host: data.host,
        attendee_count: data.event_members?.length || 0,
        is_joined: userId
          ? data.event_members?.some((m: any) => m.user_id === userId)
          : false,
      };
      setEvent(eventWithDetails);

      // Fire detail_opened once when the screen first loads
      if (!detailOpenedFired.current) {
        detailOpenedFired.current = true;
        getPostHog().capture("detail_opened", buildEventProps(data));
      }

      // attended: event has ended AND user is still a participant
      // const hasEnded = new Date(data.end_time) < new Date();
      // const isParticipant = userId
      //   ? data.event_members?.some((m: any) => m.user_id === userId)
      //   : false;
      // if (hasEnded && isParticipant && !attendedFired.current) {
      //   attendedFired.current = true;
      //   getPostHog().capture("attended", buildEventProps(data));
      // }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (id && userId) {
      fetchEvent();
    }
  }, [id, userId]);

  // Re-fetch whenever this screen comes back into focus (e.g. returning from edit)
  useFocusEffect(
    useCallback(() => {
      if (id && userId) {
        fetchEvent();
      }
    }, [id, userId])
  );

  const handleJoin = async () => {
    if (!event || !userId) return;
    // Prevent duplicate fires if user taps rapidly
    if (joinClickedInFlight.current) return;

    if (event.capacity != null && event.attendee_count! >= event.capacity) {
      Alert.alert("Event Full", "This event has reached its capacity");
      return;
    }

    joinClickedInFlight.current = true;
    // Fire join_clicked before the async call so it captures intent
    getPostHog().capture("join_clicked", buildEventProps(event));

    setActionLoading(true);

    // @ts-expect-error - Supabase type inference issue
    const { error } = await supabase.from("event_members").insert({
      event_id: event.id,
      user_id: userId,
    });

    setActionLoading(false);
    joinClickedInFlight.current = false;

    if (error) {
      if (error.code === "23505") {
        Alert.alert("Already Joined", "You have already joined this event");
      } else {
        Alert.alert("Error", "Failed to join event");
        console.error(error);
      }
    } else {
      // Notify the host that someone joined (fire-and-forget)
      notifyPush("join", event.id, userId);
      Alert.alert("Success", "You have joined the event!");
      fetchEvent();
    }
  };

  const handleLeave = async () => {
    if (!event || !userId) return;

    setActionLoading(true);

    const { error } = await supabase
      .from("event_members")
      .delete()
      .eq("event_id", event.id)
      .eq("user_id", userId);

    setActionLoading(false);

    if (error) {
      Alert.alert("Error", "Failed to leave event");
      console.error(error);
    } else {
      Alert.alert("Success", "You have left the event");
      fetchEvent();
    }
  };

  const executeCancelEvent = async () => {
    if (!event || !userId) return;

    setActionLoading(true);
    try {
      const { error } = await supabase.rpc("cancel_event", {
        p_event_id: event.id,
      } as any);

      if (error) throw error;

      notifyPush("cancel", event.id, userId);
      requestFeedRefresh();
      if (Platform.OS === "web") {
        globalThis.alert?.("Your event has been canceled.");
        router.back();
      } else {
        Alert.alert("Event Canceled", "Your event has been canceled.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      console.error("[cancel] error:", err);
      Alert.alert("Error", `Failed to cancel event: ${err?.message ?? "unknown error"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelEvent = () => {
    if (!event || !userId) return;

    if (Platform.OS === "web") {
      const confirmed = globalThis.confirm?.(
        "Are you sure you want to cancel this event? All attendees will be notified.",
      );
      if (confirmed) {
        void executeCancelEvent();
      }
      return;
    }

    Alert.alert(
      "Cancel Event",
      "Are you sure you want to cancel this event? All attendees will be notified.",
      [
        { text: "Keep Event", style: "cancel" },
        {
          text: "Cancel Event",
          style: "destructive",
          onPress: () => {
            void executeCancelEvent();
          },
        },
      ],
    );
  };

  if (!id) return null;

  if (loading) {
    return (
      <View className="flex-1 bg-osu-light items-center justify-center">
        <ActivityIndicator size="large" color="#BB0000" />
      </View>
    );
  }

  if (!event) {
    return (
      <View className="flex-1 bg-osu-light items-center justify-center">
        <Text className="text-gray-500">Event not found</Text>
      </View>
    );
  }

  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);

  const formatDateTime = (date: Date) => {
    return date.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDateLabel = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTimeLabel = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const isFull =
    event.capacity != null && event.attendee_count! >= event.capacity;
  const isHost = userId === event.host_id;
  const attendeeCount = event.attendee_count || 0;
  const spotsLeft =
    event.capacity != null ? Math.max(event.capacity - attendeeCount, 0) : null;
  const isFirstTimeHost = (event.host?.hosted_count ?? 0) <= 1;
  const scarcityCopy =
    attendeeCount === 0
      ? "Be the first to join 💪"
      : spotsLeft === null
        ? `${attendeeCount} attending`
        : spotsLeft === 1
          ? "1 spot left"
          : `${spotsLeft} spots left`;

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-4" style={{ width: "100%", maxWidth: 920, alignSelf: "center" }}>
        <View className="p-0 overflow-hidden">
          <View className="p-5 pb-4">
            <Text className="text-3xl font-bold text-osu-dark mb-2">
              {event.title}
            </Text>
            <View className="flex-row items-center">
              {isFull && (
                <Text className="text-osu-scarlet font-semibold text-xs mr-2">FULL</Text>
              )}
              <Text className="text-gray-700 text-xs font-medium">{scarcityCopy}</Text>
            </View>
          </View>

          {event.image_url ? (
            <View className="px-5 py-4">
              <Image
                source={{ uri: event.image_url }}
                style={{ width: "100%", aspectRatio: 16 / 9 }}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View className="items-center justify-center py-10">
              <Text className="text-gray-500 text-sm">No photo yet</Text>
            </View>
          )}

          <View className="p-5">
            <View className="pb-4 border-b border-gray-200">
              <Text className="text-xs uppercase tracking-wide text-gray-500 font-semibold">When</Text>
              <Text className="text-osu-dark font-medium mt-1">{formatDateLabel(startDate)}</Text>
              <View className="flex-row items-center mt-2">
                <Text className="text-gray-700 font-medium">{formatTimeLabel(startDate)}</Text>
                <Text className="text-gray-400 mx-2">-</Text>
                <Text className="text-gray-700 font-medium">{formatTimeLabel(endDate)}</Text>
              </View>
            </View>

            <View className="py-4 border-b border-gray-200">
              <Text className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Where</Text>
              <Text className="text-osu-dark font-medium mt-1">@ {event.location_text}</Text>
            </View>

            <View className="py-4 border-b border-gray-200">
              <Text className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Host</Text>
              <TouchableOpacity onPress={() => router.push(`/profile/${event.host_id}`)}>
                <Text className="text-osu-scarlet font-semibold mt-1">
                  {event.host?.display_name || event.host?.email.split("@")[0]}
                </Text>
              </TouchableOpacity>
              {isFirstTimeHost && (
                <Text className="text-gray-500 text-xs mt-1">First-time host</Text>
              )}
            </View>

            {event.description && (
              <View className="py-4 border-b border-gray-200">
                <Text className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">Description</Text>
                <Text className="text-osu-dark leading-6">{event.description}</Text>
              </View>
            )}

            <View className="pt-6 mt-2">
              {!isHost ? (
                <View style={{ gap: 10 }}>
                  {event.is_joined ? (
                    <PrimaryButton
                      title="Leave Event"
                      onPress={handleLeave}
                      loading={actionLoading}
                    />
                  ) : (
                    <>
                      <PrimaryButton
                        title="Join Event"
                        onPress={handleJoin}
                        disabled={isFull}
                        loading={actionLoading}
                      />
                      <Text className="text-gray-400 text-xs text-center">
                        You can leave anytime
                      </Text>
                    </>
                  )}
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <PrimaryButton
                    title="Edit Event"
                    onPress={() => router.push(`/(app)/edit-event?editId=${event.id}`)}
                    loading={false}
                  />
                  <SecondaryButton
                    title="Cancel Event"
                    onPress={handleCancelEvent}
                    loading={actionLoading}
                  />
                  <Text className="text-gray-500 text-xs text-center mt-1">You are hosting this event</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
