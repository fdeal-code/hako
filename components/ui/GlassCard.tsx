import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, Radii } from '@/constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  dark?: boolean;
}

export function GlassCard({
  children,
  style,
  intensity = 40,
  dark = false,
}: GlassCardProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <BlurView
        intensity={intensity}
        tint={dark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: dark
              ? Colors.glass.backgroundDark
              : Colors.glass.background,
            borderColor: dark
              ? 'rgba(255,255,255,0.15)'
              : Colors.glass.border,
          },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radii.lg,
  },
});
