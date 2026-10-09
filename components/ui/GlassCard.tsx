// GlassCard — card bento du dashboard (DA V2 : opaque, fini le blur)
// 3 variants :
//  - 'light'        : crème + bordure fine sombre (défaut)
//  - 'dark'         : noire, contenu clair (card PLANNING)
//  - 'accentDashed' : bordure pointillée orange (états vides, ex. VOS ENVIES)
//  - 'accent'       : orange plein (tuile « On t'aide »)
// Le nom est conservé pour limiter le churn dans les écrans.

import React from "react";
import {
  Image,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { Colors, Radii, Shadows, Spacing } from "@/constants/theme";
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';

export type GlassCardVariant = 'light' | 'dark' | 'accentDashed' | 'accent';

export interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  flex?: number;
  minHeight?: number;
  height?: number;
  backgroundImageUri?: string;
  noPadding?: boolean;
  variant?: GlassCardVariant;
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
  variant = 'light',
}: GlassCardProps) {
  const outerStyle: ViewStyle[] = [
    styles.outer,
    variantStyles[variant],
    height !== undefined
      ? { height, ...(flex !== undefined ? { flex, flexBasis: 0 } : {}) }
      : { flex: flex ?? 1, flexBasis: 0, minHeight: minHeight ?? 130 },
    ...(style ? [style] : []),
  ];

  const content = (
    <>
      {backgroundImageUri && (
        <Image
          source={{ uri: backgroundImageUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}
      <View style={noPadding ? styles.fillNoPadding : styles.fill}>
        {children}
      </View>
    </>
  );

  if (onPress) {
    return (
      <AnimatedPressable style={outerStyle} onPress={onPress} accessibilityRole="button">
        {content}
      </AnimatedPressable>
    );
  }

  return <View style={outerStyle}>{content}</View>;
}

const variantStyles: Record<GlassCardVariant, ViewStyle> = {
  light: {
    backgroundColor: Colors.background,
    borderColor: Colors.primary,
  },
  dark: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  accentDashed: {
    backgroundColor: Colors.background,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
  },
  accent: {
    backgroundColor: Colors.accent,
    borderColor: Colors.primary,
  },
};

const styles = StyleSheet.create({
  // Tuile du dashboard V2 : coins 30, ombre (0,10,30,0.10), padding 20
  outer: {
    borderRadius: Radii.pill,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadows.md,
  },
  fill: {
    flex: 1,
    padding: Spacing.md2,
    justifyContent: 'space-between',
  },
  fillNoPadding: {
    flex: 1,
  },
});
