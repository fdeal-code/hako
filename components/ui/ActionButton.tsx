import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Spacing } from '@/constants/theme';

export type ActionButtonVariant = 'primary' | 'secondary' | 'danger';

export type ActionButtonProps = {
  label:    string;
  onPress:  () => void;
  variant?: ActionButtonVariant;
  disabled?: boolean;
  loading?:  boolean;
  icon?:     string;
};

const ICON_COLOR: Record<ActionButtonVariant, string> = {
  primary:   Colors.textInverted,
  secondary: Colors.textSecondary,
  danger:    '#DC2626',
};

export function ActionButton({
  label, onPress, variant = 'primary', disabled, loading, icon,
}: ActionButtonProps) {
  return (
    <TouchableOpacity
      style={[s.btn, s[variant], (disabled || loading) && s.disabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? Colors.textInverted : Colors.textPrimary}
        />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon as any}
              size={18}
              color={ICON_COLOR[variant]}
            />
          )}
          <Text style={[s.label, s[`${variant}Label` as keyof typeof s] as any]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection:  'row',
    height:          56,
    borderRadius:    Radii.md,
    alignItems:     'center',
    justifyContent: 'center',
    gap:             Spacing.sm,
  },
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: 'rgba(220,38,38,0.08)',
    borderWidth:     1,
    borderColor:     'rgba(220,38,38,0.3)',
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize:   16,
    fontWeight: '600',
  },
  primaryLabel: {
    color: Colors.textInverted,
  },
  secondaryLabel: {
    color: Colors.textSecondary,
  },
  dangerLabel: {
    color: '#DC2626',
  },
});
