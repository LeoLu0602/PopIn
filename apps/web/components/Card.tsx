import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, className = "", style }: CardProps) {
  return (
    <View className={`bg-white rounded-xl p-5 shadow-sm ${className}`} style={style}>
      {children}
    </View>
  );
}
