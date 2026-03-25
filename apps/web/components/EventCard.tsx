import React from "react";
import { TouchableOpacity, Text, View } from "react-native";
import { router } from "expo-router";
import type { EventWithDetails } from "shared";
import { Card } from "./Card";

interface EventCardProps {
  event: EventWithDetails;
  onPress?: () => void;
}

export function EventCard({ event, onPress }: EventCardProps) {
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const attendeeCount = event.attendee_count || 0;
  const isUnlimitedCapacity = event.capacity == null;
  const capacityValue = event.capacity ?? 0;
  const isFull = !isUnlimitedCapacity && attendeeCount >= capacityValue;
  const hostName =
    event.host?.display_name || event.host?.email.split("@")[0] || "host";

  return (
    <TouchableOpacity
      onPress={onPress ?? (() => router.push(`/event/${event.id}`))}
      activeOpacity={0.7}
    >
      <Card
        className="rounded-lg bg-white p-4"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <View className="flex-row items-start justify-between mb-2">
          <Text className="text-xl font-semibold text-osu-dark flex-1" numberOfLines={2}>
            {event.title}
          </Text>
          {isFull && (
            <View className="ml-3 px-2 py-1 rounded border border-osu-scarlet">
              <Text className="text-xs font-semibold text-osu-scarlet">FULL</Text>
            </View>
          )}
        </View>

        <Text className="text-sm text-gray-500 mb-3" numberOfLines={1}>
          {formatDate(startDate)} • {formatTime(startDate)} -{" "}
          {startDate.toDateString() !== endDate.toDateString()
            ? `${formatDate(endDate)} `
            : ""}
          {formatTime(endDate)}
        </Text>

        <Text className="text-base text-gray-700 mb-3" numberOfLines={1}>
          📍 {event.location_text}
        </Text>

        <View className="flex-row items-center justify-between pt-2 border-t border-gray-200">
          <Text className="text-sm text-gray-500" numberOfLines={1}>
            by {hostName}
          </Text>
          <Text className="text-sm font-semibold text-osu-scarlet">
            {isUnlimitedCapacity
              ? `${attendeeCount} attending`
              : `${attendeeCount}/${capacityValue} attending`}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}
