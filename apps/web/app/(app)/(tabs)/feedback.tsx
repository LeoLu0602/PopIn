import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { PrimaryButton } from "../../../components/Button";
import { Card } from "../../../components/Card";

const EMOJIS = [
  { value: 1, emoji: "😶", label: "Not great" },
  { value: 2, emoji: "😕", label: "Meh" },
  { value: 3, emoji: "🙂", label: "Decent" },
  { value: 4, emoji: "😄", label: "Good" },
  { value: 5, emoji: "🤩", label: "Love it" },
];

const RETURN_OPTIONS: Array<{ value: "yes" | "maybe" | "no"; label: string }> =
  [
    { value: "yes", label: "Definitely" },
    { value: "maybe", label: "Maybe" },
    { value: "no", label: "Probably not" },
  ];

function getQ3Prompt(wouldReturn: "yes" | "maybe" | "no" | null): string {
  switch (wouldReturn) {
    case "yes":
      return "Awesome! Anything we could do to make it even better?";
    case "maybe":
      return "Got it — what would push you from 'maybe' to 'definitely'?";
    case "no":
      return "Thanks for being honest. What held you back?";
    default:
      return "Any other thoughts for us?";
  }
}

function useAutoResize(initialHeight = 80) {
  const [height, setHeight] = useState(initialHeight);
  const onContentSizeChange = useCallback(
    (e: { nativeEvent: { contentSize: { height: number } } }) => {
      setHeight(Math.max(initialHeight, e.nativeEvent.contentSize.height));
    },
    [initialHeight],
  );
  return { height, onContentSizeChange };
}

export default function FeedbackScreen() {
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(null);
  const [wouldReturn, setWouldReturn] = useState<
    "yes" | "maybe" | "no" | null
  >(null);
  const [openFeedback, setOpenFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { height: textAreaHeight, onContentSizeChange } = useAutoResize(80);

  const canSubmit = rating !== null && wouldReturn !== null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // @ts-expect-error - Supabase type inference issue
    const { error } = await supabase.from("feedback").insert({
      user_id: user?.id || null,
      rating,
      would_return: wouldReturn,
      open_feedback: openFeedback.trim() || null,
    });

    setLoading(false);

    if (error) {
      console.error(error);
      setSubmitError("Something went wrong. Please try again.");
    } else {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <ScrollView
        className="flex-1 bg-osu-light"
        contentContainerStyle={{
          padding: 16,
          flex: 1,
          justifyContent: "center",
        }}
      >
        <Card>
          <Text className="text-2xl font-bold text-osu-dark mb-3 text-center">
            🎉 Thank you!
          </Text>
          <Text className="text-gray-600 text-center mb-6">
            Thanks for the feedback! This really helps us build something OSU
            students actually want to use.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace("/(app)/(tabs)/feed")}
            style={{
              backgroundColor: "#BB0000",
              borderRadius: 12,
              minHeight: 50,
              paddingHorizontal: 18,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text className="text-white text-base font-semibold">
              Back to Feed
            </Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <ScrollView
        className="flex-1 bg-osu-light"
        contentContainerStyle={{ padding: 16 }}
      >
        <Card>
          <Text className="text-2xl font-bold text-osu-dark mb-2">
            Feedback
          </Text>
          <Text className="text-gray-600 mb-6">Help us improve PopIn!</Text>

          {/* Q1: Rating */}
          <Text className="text-osu-dark font-semibold mb-4">
            How would you rate PopIn so far?
          </Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            {EMOJIS.map(({ value, emoji, label }) => (
              <TouchableOpacity
                key={value}
                onPress={() => setRating(value)}
                style={{
                  alignItems: "center",
                  padding: 8,
                  borderRadius: 12,
                  backgroundColor: rating === value ? "#FFF0F0" : "transparent",
                  borderWidth: 2,
                  borderColor: rating === value ? "#BB0000" : "transparent",
                  flex: 1,
                  marginHorizontal: 2,
                }}
              >
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: rating === value ? "#BB0000" : "#6B7280",
                    marginTop: 2,
                    textAlign: "center",
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: "#E5E7EB",
              marginVertical: 20,
            }}
          />

          {/* Q2: Would return */}
          <Text className="text-osu-dark font-semibold mb-4">
            Would you use PopIn again?
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            {RETURN_OPTIONS.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                onPress={() => setWouldReturn(value)}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: wouldReturn === value ? "#BB0000" : "#D1D5DB",
                  backgroundColor:
                    wouldReturn === value ? "#FFF0F0" : "#F9FAFB",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: wouldReturn === value ? "#BB0000" : "#374151",
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: "#E5E7EB",
              marginVertical: 20,
            }}
          />

          {/* Q3: Open text */}
          <Text className="text-osu-dark font-semibold mb-3">
            {getQ3Prompt(wouldReturn)}
          </Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base"
            value={openFeedback}
            onChangeText={setOpenFeedback}
            onContentSizeChange={onContentSizeChange}
            multiline
            style={{ height: textAreaHeight, textAlignVertical: "top" }}
          />
          <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 6 }}>
            Optional — feel free to skip
          </Text>

          {submitError && (
            <Text style={{ color: "#BB0000", fontSize: 13, marginTop: 16, textAlign: "center" }}>
              {submitError}
            </Text>
          )}

          <View style={{ marginTop: 12 }}>
            <PrimaryButton
              title="Submit Feedback"
              onPress={handleSubmit}
              loading={loading}
              disabled={!canSubmit}
            />
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
