/**
 * NavButton — bouton de navigation flottant (tab bar & dashboard)
 * DA V2 : opaque (fini le blur/gradient), 3 variants :
 *  - 'light'  : crème + bordure fine sombre (défaut)
 *  - 'dark'   : noir, contenu crème (pill Home active)
 *  - 'accent' : orange, contenu blanc (FAB +)
 *
 * Specs : 64×64 round | pill (icône + label) même hauteur, radius 99.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Motion, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';

/* ─── Tokens ──────────────────────────────────────────────────── */
const SIZE = 64; // diamètre du bouton rond

export type NavButtonVariant = 'light' | 'dark' | 'accent';

interface VariantSpec {
  background: string;
  border: string;
  content: string; // couleur icône + label
}

const VARIANTS: Record<NavButtonVariant, VariantSpec> = {
  light:  { background: Colors.background, border: Colors.borderDark, content: Colors.textPrimary },
  dark:   { background: Colors.primary,    border: Colors.primary,    content: Colors.background },
  accent: { background: Colors.accent,     border: Colors.accent,     content: Colors.white },
};

/* ─── Props ───────────────────────────────────────────────────── */
export interface NavButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;          // si fourni → pill (icône + texte)
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
  variant?: NavButtonVariant;
}

/* ─── Composant ───────────────────────────────────────────────── */
export function NavButton({
  icon,
  label,
  onPress,
  style,
  iconSize = 24,
  variant = 'light',
}: NavButtonProps) {
  const isPill = !!label;
  const spec = VARIANTS[variant];

  return (
    <AnimatedPressable
      onPress={onPress}
      style={style}
      scaleTo={Motion.pressScaleSmall}
      haptic={variant === 'accent' ? 'light' : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.base,
          isPill ? styles.pill : styles.circle,
          { backgroundColor: spec.background, borderColor: spec.border },
        ]}
      >
        <Ionicons name={icon} size={iconSize} color={spec.content} />
        {isPill && <Text style={[styles.label, { color: spec.content }]}>{label}</Text>}
      </View>
    </AnimatedPressable>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  base: {
    height: SIZE,
    borderRadius: Radii.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm + 2,
    ...Shadows.md,
  },
  circle: {
    width: SIZE,
  },
  pill: {
    paddingHorizontal: Spacing.lg,
  },
  label: {
    ...Typography.button,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
