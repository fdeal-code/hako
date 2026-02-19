import { BlurView } from "expo-blur";
import React from "react";
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

export interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  flex?: number;
  minHeight?: number;
  height?: number;
  backgroundImageUri?: string;
  noPadding?: boolean;
}

export function GlassCard({
  children,
  style,
  onPress,
  flex,
  minHeight,
  height,
  backgroundImageUri,
  noPadding = false,
}: GlassCardProps) {
  const outerStyle: ViewStyle[] = [
    styles.outer,
    height !== undefined
      ? { height }
      : { flex: flex ?? 1, flexBasis: 0, minHeight: minHeight ?? 130 },
    ...(style ? [style] : []),
  ];

  const content = (
    <>
      {backgroundImageUri && (
        <Image
          source={{ uri: backgroundImageUri }}
          style={[StyleSheet.absoluteFill, { opacity: 0.55 }]}
          resizeMode="cover"
        />
      )}
      <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
      <View style={noPadding ? styles.fillNoPadding : styles.fill}>
        {children}
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={outerStyle} onPress={onPress} activeOpacity={0.85}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={outerStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  fillNoPadding: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
