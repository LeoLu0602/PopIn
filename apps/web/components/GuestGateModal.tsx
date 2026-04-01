import { Modal, View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PrimaryButton, SecondaryButton } from "./Button";

const MESSAGES: Record<string, string> = {
  create: "Sign in to create and manage your own events.",
  "my-events": "Sign in to view and manage your events.",
  "my-profile": "Sign in to view and edit your profile.",
  "edit-event": "Sign in to make changes to this event.",
};

const DEFAULT_MESSAGE = "Sign in to unlock the full experience.";

interface Props {
  visible: boolean;
  routeKey: string | null;
  onConfirm: () => void;
  onDismiss: () => void;
}

export default function GuestGateModal({ visible, routeKey, onConfirm, onDismiss }: Props) {
  const message = (routeKey && MESSAGES[routeKey]) ?? DEFAULT_MESSAGE;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            padding: 28,
            width: "100%",
            maxWidth: 400,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#FEF2F2",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons name="lock-closed" size={28} color="#BB0000" />
            </View>

            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: "#111827",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              Sign in to continue
            </Text>

            <Text
              style={{
                fontSize: 15,
                color: "#6B7280",
                textAlign: "center",
                lineHeight: 22,
              }}
            >
              {message}
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            <PrimaryButton title="Go to login" onPress={onConfirm} />
            <SecondaryButton title="Maybe later" onPress={onDismiss} />
          </View>
        </View>
      </View>
    </Modal>
  );
}