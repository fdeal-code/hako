import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, Radii, Spacing } from '@/constants/theme';

export type CategoryButtonProps = {
  label:    string;
  emoji:    string;
  selected: boolean;
  onPress:  () => void;
};

export function CategoryButton({ label, emoji, selected, onPress }: CategoryButtonProps) {
  return (
    <TouchableOpacity
      style={[s.btn, selected && s.btnSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={s.emoji}>{emoji}</Text>
      <Text style={[s.label, selected && s.labelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    padding:         Spacing.sm2,
    borderRadius:    Radii.sm,
    backgroundColor: Colors.surface,
    borderWidth:     1,
    borderColor:     Colors.border,
    gap:             6,
    minWidth:        72,
  },
  btnSelected: {
    backgroundColor: Colors.surface,
    borderWidth:     2,
    borderColor:     Colors.primary,
  },
  emoji: {
    fontSize:  24,
    textAlign: 'center',
  },
  label: {
    fontSize:   12,
    fontWeight: '500',
    color:      Colors.textPrimary,
    textAlign:  'center',
  },
  labelSelected: {
    fontWeight: '700',
  },
});
