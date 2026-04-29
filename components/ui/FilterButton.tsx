import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, Radii, Spacing } from '@/constants/theme';

export type FilterButtonProps = {
  label:   string;
  active:  boolean;
  onPress: () => void;
  count?:  number;
};

export function FilterButton({ label, active, onPress, count }: FilterButtonProps) {
  return (
    <TouchableOpacity
      style={[s.btn, active && s.btnActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[s.label, active && s.labelActive]}>
        {label}{count != null ? ` (${count})` : ''}
      </Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    paddingHorizontal: Spacing.md2,
    paddingVertical:   8,
    borderRadius:      Radii.full,
    backgroundColor:   Colors.surface,
  },
  btnActive: {
    backgroundColor: Colors.primary,
  },
  label: {
    fontSize:   14,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },
  labelActive: {
    color: Colors.textInverted,
  },
});
