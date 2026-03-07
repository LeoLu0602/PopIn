import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  Modal,
  Pressable,
  Platform,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { uploadEventPhoto } from "../../../lib/storage";
import { getPostHog } from "../../../lib/posthog";
import { PrimaryButton, SecondaryButton } from "../../../components/Button";

type RequiredField = "title" | "location";
type PickerTarget = "startDate" | "startTime" | "endDate" | "endTime";

type FieldErrors = Partial<Record<RequiredField, string>>;

const formatDate = (date: Date): string =>
  date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

const formatTime = (date: Date): string =>
  date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000;

export default function CreateEventScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditMode = !!editId;

  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const [title, setTitle] = useState("");
  const [startDateTime, setStartDateTime] = useState(oneHourLater);
  const [endDateTime, setEndDateTime] = useState(twoHoursLater);
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [removePhotoRequested, setRemovePhotoRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(isEditMode);
  const [userId, setUserId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [eventPhoto, setEventPhoto] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);

  const [activePicker, setActivePicker] = useState<PickerTarget | null>(null);
  const [pickerValue, setPickerValue] = useState(oneHourLater);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (endDateTime <= startDateTime) {
      setEndDateTime(new Date(startDateTime.getTime() + DEFAULT_EVENT_DURATION_MS));
    }
  }, [startDateTime, endDateTime]);

  const getPickerTitle = (target: PickerTarget): string => {
    switch (target) {
      case "startDate":
        return "Select Start Date";
      case "startTime":
        return "Select Start Time";
      case "endDate":
        return "Select End Date";
      case "endTime":
        return "Select End Time";
      default:
        return "Select";
    }
  };

  const getPickerMode = (target: PickerTarget): "date" | "time" =>
    target === "startDate" || target === "endDate" ? "date" : "time";

  const pickerDisplay = Platform.OS === "ios" ? "spinner" : "default";

  const getPickerMinimumDate = (target: PickerTarget): Date | undefined => {
    if (target === "startDate") return new Date();
    if (target === "startTime") {
      return isSameDay(startDateTime, new Date()) ? new Date() : undefined;
    }
    if (target === "endDate") return startDateTime;
    if (target === "endTime") {
      return isSameDay(endDateTime, startDateTime) ? startDateTime : undefined;
    }
    return undefined;
  };

  const openPicker = (target: PickerTarget) => {
    setActivePicker(target);
    if (target === "startDate" || target === "startTime") {
      setPickerValue(startDateTime);
      return;
    }
    setPickerValue(endDateTime);
  };

  const closePicker = () => {
    setActivePicker(null);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  useEffect(() => {
    if (!isEditMode || !editId) return;

    (supabase
      .from("events")
      .select("title, start_time, end_time, location_text, capacity, description, image_url")
      .eq("id", editId)
      .single() as any
    ).then(({ data, error }: { data: any; error: any }) => {
      if (error || !data) {
        Alert.alert("Error", "Failed to load event");
        router.back();
        return;
      }
      setTitle(data.title);
      setStartDateTime(new Date(data.start_time));
      setEndDateTime(new Date(data.end_time));
      setLocation(data.location_text);
      setCapacity(data.capacity ? String(data.capacity) : "");
      setDescription(data.description || "");
      setExistingImageUrl(data.image_url || null);
      setEditLoading(false);
    });
  }, [editId]);

  const pickEventPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Photo library access is required.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    setEventPhoto({
      uri: asset.uri,
      base64: asset.base64!,
      mimeType: asset.mimeType ?? "image/jpeg",
    });
    setRemovePhotoRequested(false);
  };


  const validateRequiredFields = (): FieldErrors => {
    const errors: FieldErrors = {};

    if (!title.trim()) errors.title = "Title is required";
    if (!location.trim()) errors.location = "Location is required";

    return errors;
  };

  const getInputClassName = (field: RequiredField) =>
    `bg-white border rounded-md px-4 py-3 text-base text-osu-dark ${
      fieldErrors[field] ? "border-red-500" : "border-gray-300"
    }`;

  const renderRequiredLabel = (label: string) => (
    <Text className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">
      {label} <Text className="text-red-500">*</Text>
    </Text>
  );

  const checkStartWithin48Hours = (date: Date) => {
    if (date.getTime() - new Date().getTime() > FORTY_EIGHT_HOURS_MS) {
      Alert.alert(
        "Start Time Too Far",
        "Please set the start time within 48 hours from now.",
      );
    }
  };

  const handlePickerValueChange = (
    _event: DateTimePickerEvent,
    selected?: Date,
  ) => {
    if (selected) {
      setPickerValue(selected);
    }
  };

  const applyPickerSelection = () => {
    if (!activePicker) return;

    if (activePicker === "startDate") {
      const updated = new Date(startDateTime);
      updated.setFullYear(
        pickerValue.getFullYear(),
        pickerValue.getMonth(),
        pickerValue.getDate(),
      );
      setStartDateTime(updated);
      checkStartWithin48Hours(updated);
      closePicker();
      return;
    }

    if (activePicker === "startTime") {
      const updated = new Date(startDateTime);
      updated.setHours(pickerValue.getHours(), pickerValue.getMinutes(), 0, 0);
      setStartDateTime(updated);
      checkStartWithin48Hours(updated);
      closePicker();
      return;
    }

    if (activePicker === "endDate") {
      const updated = new Date(endDateTime);
      updated.setFullYear(
        pickerValue.getFullYear(),
        pickerValue.getMonth(),
        pickerValue.getDate(),
      );
      if (updated <= startDateTime) {
        setEndDateTime(new Date(startDateTime.getTime() + DEFAULT_EVENT_DURATION_MS));
        closePicker();
        return;
      }
      setEndDateTime(updated);
      closePicker();
      return;
    }

    const updated = new Date(endDateTime);
    updated.setHours(pickerValue.getHours(), pickerValue.getMinutes(), 0, 0);
    if (updated <= startDateTime) {
      setEndDateTime(new Date(startDateTime.getTime() + DEFAULT_EVENT_DURATION_MS));
      closePicker();
      return;
    }
    setEndDateTime(updated);
    closePicker();
  };

  const handleReview = () => {
    const requiredFieldErrors = validateRequiredFields();
    setFieldErrors(requiredFieldErrors);

    if (Object.keys(requiredFieldErrors).length > 0) {
      return;
    }

    const trimmedCapacity = capacity.trim();
    const capacityNum = trimmedCapacity ? parseInt(trimmedCapacity, 10) : null;
    if (trimmedCapacity && (capacityNum == null || isNaN(capacityNum) || capacityNum < 2)) {
      Alert.alert("Error", "Capacity must be at least 2 (you as the host + at least 1 attendee), or leave blank for unlimited");
      return;
    }

    if (endDateTime <= startDateTime) {
      Alert.alert("Error", "End time must be after start time");
      return;
    }

    if (startDateTime < new Date()) {
      Alert.alert("Error", "Start time must be in the future");
      return;
    }

    if (startDateTime.getTime() - new Date().getTime() > FORTY_EIGHT_HOURS_MS) {
      Alert.alert("Error", "Start time must be within 48 hours from now");
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    const trimmedCapacity = capacity.trim();
    const capacityNum = trimmedCapacity ? parseInt(trimmedCapacity, 10) : null;

    setLoading(true);

    if (isEditMode && editId) {
      let nextImageUrl: string | null | undefined = undefined;
      if (eventPhoto && userId) {
        try {
          nextImageUrl = await uploadEventPhoto(
            userId,
            eventPhoto.base64,
            eventPhoto.mimeType,
          );
        } catch {
          Alert.alert("Error", "Failed to upload event photo");
          setLoading(false);
          return;
        }
      }
      if (removePhotoRequested) {
        nextImageUrl = null;
      }

      const updatePayload: Record<string, any> = {
        title: title.trim(),
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        location_text: location.trim(),
        capacity: capacityNum,
        description: description.trim() || null,
      };

      if (nextImageUrl !== undefined) {
        updatePayload.image_url = nextImageUrl;
      }

      const { error } = await (supabase.from("events") as any)
        .update(updatePayload)
        .eq("id", editId);

      setLoading(false);

      if (error) {
        Alert.alert("Error", "Failed to save changes");
        console.error(error);
      } else {
        if (userId) {
          supabase.functions
            .invoke("send-push", { body: { type: "update", event_id: editId, actor_id: userId } })
            .then(({ error: fnError }) => {
              if (fnError) console.warn("[push] update notify error:", fnError);
              else console.log("[push] update notification sent");
            })
            .catch((err) => console.warn("[push] update notify failed:", err));
        }
        setShowConfirm(false);
        if (Platform.OS === "web") {
          globalThis.alert?.("Event updated successfully.");
          router.replace(`/event/${editId}`);
        } else {
          Alert.alert("Saved", "Event updated successfully.", [
            { text: "OK", onPress: () => router.replace(`/event/${editId}`) },
          ]);
        }
      }
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert("Error", "You must be logged in to create an event");
        setLoading(false);
        return;
      }

      let imageUrl: string | null = null;
      if (eventPhoto) {
        try {
          imageUrl = await uploadEventPhoto(user.id, eventPhoto.base64, eventPhoto.mimeType);
        } catch {
          Alert.alert("Error", "Failed to upload event photo");
          setLoading(false);
          return;
        }
      }

      // @ts-expect-error - Supabase type inference issue
      const { data: eventData, error } = await supabase.from("events").insert({
        host_id: user.id,
        title: title.trim(),
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        location_text: location.trim(),
        capacity: capacityNum,
        description: description.trim() || null,
        image_url: imageUrl,
        status: "active" as const,
      }).select("id").single();

      if (!error && eventData) {
        // @ts-expect-error - Supabase type inference issue
        await supabase.from("event_members").insert({
          event_id: (eventData as any).id,
          user_id: user.id,
        });
      }

      setLoading(false);

      if (error) {
        Alert.alert("Error", "Failed to create event");
        console.error(error);
      } else {
        getPostHog().capture('event_created', {
          event_id: (eventData as any)?.id,
          event_title: title.trim(),
          event_start_time: startDateTime.toISOString(),
          event_location: location.trim(),
          creator_id: user.id,
        });
        setShowConfirm(false);
        Alert.alert("Success", "Event created successfully!");
        const resetNow = new Date();
        setTitle("");
        setStartDateTime(new Date(resetNow.getTime() + 60 * 60 * 1000));
        setEndDateTime(new Date(resetNow.getTime() + 2 * 60 * 60 * 1000));
        setLocation("");
        setCapacity("");
        setDescription("");
        setEventPhoto(null);
        router.replace("/(app)/(tabs)/feed");
      }
    }
  };

  if (editLoading) {
    return (
      <View className="flex-1 bg-osu-light items-center justify-center">
        <ActivityIndicator size="large" color="#BB0000" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={80}
      >
        <View className="p-4" style={{ width: "100%", maxWidth: 920, alignSelf: "center" }}>
          <View className="p-0 overflow-hidden bg-white">
            <View className="p-5 pb-4">
              <Text className="text-3xl font-bold text-osu-dark">
                {isEditMode ? "Edit Event" : "Create New Event"}
              </Text>
            </View>

            <View className="px-5 py-4 border-b border-gray-200">
            {renderRequiredLabel("Title")}
            <TextInput
              className={getInputClassName("title")}
              placeholder="Event name"
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                if (fieldErrors.title && value.trim()) {
                  setFieldErrors((prev) => ({ ...prev, title: undefined }));
                }
              }}
            />
            {fieldErrors.title && (
              <Text className="text-red-500 text-sm mt-1">{fieldErrors.title}</Text>
            )}
            </View>

            <View className="px-5 py-4 border-b border-gray-200">
            {renderRequiredLabel("Start Date")}
            <Pressable
              className="bg-white border border-gray-300 rounded-md px-4 py-3"
              onPress={() => openPicker("startDate")}
            >
              <Text className="text-base">{formatDate(startDateTime)}</Text>
            </Pressable>
            </View>

            <View className="px-5 py-4 border-b border-gray-200">
            {renderRequiredLabel("Start Time")}
            <Pressable
              className="bg-white border border-gray-300 rounded-md px-4 py-3"
              onPress={() => openPicker("startTime")}
            >
              <Text className="text-base">{formatTime(startDateTime)}</Text>
            </Pressable>
            </View>

            <View className="px-5 py-4 border-b border-gray-200">
            {renderRequiredLabel("End Date")}
            <Pressable
              className="bg-white border border-gray-300 rounded-md px-4 py-3"
              onPress={() => openPicker("endDate")}
            >
              <Text className="text-base">{formatDate(endDateTime)}</Text>
            </Pressable>
            </View>

            <View className="px-5 py-4 border-b border-gray-200">
            {renderRequiredLabel("End Time")}
            <Pressable
              className="bg-white border border-gray-300 rounded-md px-4 py-3"
              onPress={() => openPicker("endTime")}
            >
              <Text className="text-base">{formatTime(endDateTime)}</Text>
            </Pressable>
            </View>

            <View className="px-5 py-4 border-b border-gray-200">
            {renderRequiredLabel("Location")}
            <TextInput
              className={getInputClassName("location")}
              placeholder="e.g., Thompson Library, Room 150"
              value={location}
              onChangeText={(value) => {
                setLocation(value);
                if (fieldErrors.location && value.trim()) {
                  setFieldErrors((prev) => ({ ...prev, location: undefined }));
                }
              }}
            />
            {fieldErrors.location && (
              <Text className="text-red-500 text-sm mt-1">{fieldErrors.location}</Text>
            )}
            </View>

            <View className="px-5 py-4 border-b border-gray-200">
              <Text className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Capacity (Optional)</Text>
            <TextInput
              className="bg-white border border-gray-300 rounded-md px-4 py-3 text-base text-osu-dark"
              placeholder="Leave blank for unlimited"
              value={capacity}
              onChangeText={setCapacity}
              keyboardType="number-pad"
            />
            </View>

            <View className="px-5 py-4 border-b border-gray-200">
              <Text className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">
              Description (Optional)
            </Text>
            <TextInput
              className="bg-white border border-gray-300 rounded-md px-4 py-3 text-base text-osu-dark"
              placeholder="Tell people about your event..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            </View>

            <View className="px-5 py-4 border-b border-gray-200">
              <Text className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">
              Event Photo (Optional)
            </Text>
            <TouchableOpacity
              onPress={pickEventPhoto}
              className="bg-white border border-gray-300 rounded-md overflow-hidden"
            >
              {eventPhoto ? (
                <Image
                  source={{ uri: eventPhoto.uri }}
                  style={{ width: "100%", aspectRatio: 16 / 9 }}
                  resizeMode="cover"
                />
              ) : existingImageUrl ? (
                <Image
                  source={{ uri: existingImageUrl }}
                  style={{ width: "100%", aspectRatio: 16 / 9 }}
                  resizeMode="cover"
                />
              ) : (
                <View className="items-center justify-center py-8">
                  <Text className="text-gray-400 text-sm">Tap to add a photo</Text>
                </View>
              )}
            </TouchableOpacity>
            {(eventPhoto || existingImageUrl) && (
              <TouchableOpacity
                onPress={() => {
                  setEventPhoto(null);
                  setExistingImageUrl(null);
                  setRemovePhotoRequested(true);
                }}
                className="mt-1"
              >
                <Text className="text-red-500 text-sm">Remove photo</Text>
              </TouchableOpacity>
            )}
            </View>

            <View className="px-5 pt-6">
              <PrimaryButton
                title={isEditMode ? "Review Changes" : "Review Event"}
                onPress={handleReview}
                loading={false}
              />
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>

      <Modal
        visible={activePicker !== null}
        transparent
        animationType="fade"
        onRequestClose={closePicker}
      >
        <View style={{ flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 16 }}>
          <View className="bg-white rounded-2xl p-5">
            {activePicker && (
              <>
                <Text className="text-lg font-bold text-osu-dark mb-4">
                  {getPickerTitle(activePicker)}
                </Text>
                <DateTimePicker
                  value={pickerValue}
                  mode={getPickerMode(activePicker)}
                  display={pickerDisplay}
                  minimumDate={getPickerMinimumDate(activePicker)}
                  onChange={handlePickerValueChange}
                  {...(Platform.OS === "ios"
                    ? { themeVariant: "light" as const, textColor: "#111827" }
                    : {})}
                />
                <View className="mt-5 flex-row">
                  <Pressable
                    className="flex-1 border border-osu-scarlet rounded-xl py-3 mr-2 items-center"
                    onPress={closePicker}
                  >
                    <Text className="text-osu-scarlet font-semibold">Cancel</Text>
                  </Pressable>
                  <Pressable
                    className="flex-1 bg-osu-scarlet rounded-xl py-3 ml-2 items-center"
                    onPress={applyPickerSelection}
                  >
                    <Text className="text-white font-semibold">Done</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showConfirm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfirm(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}>
          <View className="bg-white rounded-t-3xl" style={{ maxHeight: "90%" }}>
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            >
              <Text className="text-xl font-bold text-osu-dark mb-5">
                {isEditMode ? "Review Changes" : "Review Your Event"}
              </Text>

              <View className="mb-3">
                <Text className="text-xs font-semibold text-gray-400 uppercase mb-0.5">Title</Text>
                <Text className="text-base text-osu-dark">{title.trim()}</Text>
              </View>

              <View className="mb-3">
                <Text className="text-xs font-semibold text-gray-400 uppercase mb-0.5">Start</Text>
                <Text className="text-base text-osu-dark">
                  {formatDate(startDateTime)} • {formatTime(startDateTime)}
                </Text>
              </View>

              <View className="mb-3">
                <Text className="text-xs font-semibold text-gray-400 uppercase mb-0.5">End</Text>
                <Text className="text-base text-osu-dark">
                  {formatDate(endDateTime)} • {formatTime(endDateTime)}
                </Text>
              </View>

              <View className="mb-3">
                <Text className="text-xs font-semibold text-gray-400 uppercase mb-0.5">Location</Text>
                <Text className="text-base text-osu-dark">{location.trim()}</Text>
              </View>

              <View className="mb-3">
                <Text className="text-xs font-semibold text-gray-400 uppercase mb-0.5">Capacity</Text>
                <Text className="text-base text-osu-dark">
                  {capacity.trim() ? capacity.trim() : "Unlimited"}
                </Text>
              </View>

              {description.trim() ? (
                <View className="mb-3">
                  <Text className="text-xs font-semibold text-gray-400 uppercase mb-0.5">Description</Text>
                  <Text className="text-base text-osu-dark">{description.trim()}</Text>
                </View>
              ) : null}

              {eventPhoto && (
                <View className="mb-3">
                  <Text className="text-xs font-semibold text-gray-400 uppercase mb-0.5">Photo</Text>
                  <Image
                    source={{ uri: eventPhoto.uri }}
                    style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 8, marginTop: 4 }}
                    resizeMode="cover"
                  />
                </View>
              )}
            </ScrollView>

            <View className="flex-row px-6 pt-2 pb-10" style={{ gap: 12 }}>
              <View className="flex-1">
                <SecondaryButton
                  title="Edit"
                  onPress={() => setShowConfirm(false)}
                  disabled={loading}
                />
              </View>
              <View className="flex-1">
                <PrimaryButton
                  title={isEditMode ? "Save Changes" : "Confirm & Create"}
                  onPress={handleConfirm}
                  loading={loading}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
