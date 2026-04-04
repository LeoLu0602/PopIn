import React from "react";
import { TouchableOpacity, Text, View } from "react-native";
import { router } from "expo-router";
import type { EventTag, EventWithDetails } from "shared";
import { Card } from "./Card";

interface EventCardProps {
  event: EventWithDetails;
  onPress?: () => void;
}

const TAG_COLORS: Partial<
  Record<EventTag, { backgroundColor: string; textColor: string }>
> = {
  social: { backgroundColor: "#FFE4E6", textColor: "#BE123C" },
  professional: { backgroundColor: "#F1F5F9", textColor: "#334155" },
  academic: { backgroundColor: "#E0E7FF", textColor: "#4338CA" },
  cultural: { backgroundColor: "#FEF3C7", textColor: "#B45309" },
  performance: { backgroundColor: "#FAE8FF", textColor: "#A21CAF" },
  movie: { backgroundColor: "#F4F4F5", textColor: "#3F3F46" },
  sports: { backgroundColor: "#FFEDD5", textColor: "#C2410C" },
  fitness: { backgroundColor: "#ECFCCB", textColor: "#4D7C0F" },
  gaming: { backgroundColor: "#EDE9FE", textColor: "#6D28D9" },
  volunteering: { backgroundColor: "#D1FAE5", textColor: "#047857" },
  religious: { backgroundColor: "#FEF9C3", textColor: "#A16207" },
  political: { backgroundColor: "#FEE2E2", textColor: "#B91C1C" },
  music: { backgroundColor: "#FCE7F3", textColor: "#BE185D" },
  art: { backgroundColor: "#CFFAFE", textColor: "#0E7490" },
  tech: { backgroundColor: "#E0F2FE", textColor: "#0369A1" },
  business: { backgroundColor: "#DBEAFE", textColor: "#1D4ED8" },
  health: { backgroundColor: "#DCFCE7", textColor: "#15803D" },
  career: { backgroundColor: "#CCFBF1", textColor: "#0F766E" },
  study: { backgroundColor: "#F3E8FF", textColor: "#7E22CE" },
  free_food: { backgroundColor: "#FFEDD5", textColor: "#C2410C" },
  free_merch: { backgroundColor: "#FEF3C7", textColor: "#B45309" },
  networking: { backgroundColor: "#CFFAFE", textColor: "#0E7490" },
  hiring: { backgroundColor: "#FEE2E2", textColor: "#B91C1C" },
  beginner_friendly: { backgroundColor: "#ECFCCB", textColor: "#4D7C0F" },
  outdoor: { backgroundColor: "#DCFCE7", textColor: "#15803D" },
  online: { backgroundColor: "#E0F2FE", textColor: "#0369A1" },
  drop_in: { backgroundColor: "#F5F5F4", textColor: "#57534E" },
};

const DEFAULT_TAG_COLOR = {
  backgroundColor: "#F3F4F6",
  textColor: "#374151",
};

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
  const visibleTags = (event.tags || []).slice(0, 4);
  const extraTagCount = Math.max((event.tags || []).length - visibleTags.length, 0);
  const hostName =
    event.host?.display_name || event.host?.email.split("@")[0] || "host";

  const formatTagLabel = (tag: string) =>
    tag
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

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

        {visibleTags.length > 0 && (
          <View className="flex-row flex-wrap mb-3">
            {visibleTags.map((tag) => (
              <View
                key={`${event.id}-${tag}`}
                className="rounded-full px-2 py-1 mr-2 mb-2"
                style={{
                  backgroundColor: (TAG_COLORS[tag as EventTag] || DEFAULT_TAG_COLOR).backgroundColor,
                }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: (TAG_COLORS[tag as EventTag] || DEFAULT_TAG_COLOR).textColor }}
                >
                  {formatTagLabel(tag)}
                </Text>
              </View>
            ))}
            {extraTagCount > 0 && (
              <View className="bg-gray-100 border border-gray-200 rounded-full px-2 py-1 mr-2 mb-2">
                <Text className="text-xs text-gray-700 font-medium">+{extraTagCount}</Text>
              </View>
            )}
          </View>
        )}

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
