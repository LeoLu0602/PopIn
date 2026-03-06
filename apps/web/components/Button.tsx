import React from "react";
import { TouchableOpacity, Text, ActivityIndicator } from "react-native";

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  loading?: boolean;
}

export function PrimaryButton({
  onPress,
  title,
  disabled,
  loading,
}: Omit<ButtonProps, "variant">) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`items-center justify-center ${
        disabled || loading ? "opacity-50" : ""
      }`}
      style={{
        backgroundColor: "#BB0000",
        borderRadius: 12,
        minHeight: 50,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: "#A50000",
        shadowColor: "#7A0000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text className="text-white text-base font-semibold tracking-wide">{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function SecondaryButton({
  onPress,
  title,
  disabled,
  loading,
}: Omit<ButtonProps, "variant">) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`items-center justify-center ${
        disabled || loading ? "opacity-50" : ""
      }`}
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        minHeight: 50,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: "#D1D5DB",
      }}
    >
      {loading ? (
        <ActivityIndicator color="#6B7280" />
      ) : (
        <Text className="text-gray-700 text-base font-semibold tracking-wide">
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
