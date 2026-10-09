import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Colors, Motion, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';

// Pastille de filtre — composant « Filtre » des maquettes V2 :
// actif = noir / texte blanc, inactif = crème + contour noir fin.
export type FilterButtonProps = {
  label:   string;
  active:  boolean;
  onPress: () => void;
  count?:  number;
};

export function FilterButton({ label, active, onPress, count }: FilterButtonProps) {
  return (
    <AnimatedPressable
      style={[s.btn, active && s.btnActive]}
      onPress={onPress}
      scaleTo={Motion.pressScaleSmall}
      haptic="selection"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[s.label, active && s.labelActive]}>
        {label}{count != null ? ` · ${count}` : ''}
      </Text>
    </AnimatedPressable>
  );
}

const s = StyleSheet.create({
  btn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.sm2,
    borderRadius:      Radii.pill,
    borderWidth:       1,
    borderColor:       Colors.primary,
    backgroundColor:   Colors.background,
    ...Shadows.md,
  },
  btnActive: {
    backgroundColor: Colors.primary,
  },
  label: {
    ...Typography.filter,
    color: Colors.textPrimary,
  },
  labelActive: {
    color: Colors.white,
  },
});
