// HAKO — Overlay de célébration léger (création du voyage)

import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn, ReduceMotion } from 'react-native-reanimated';

import { Colors, Spacing, Typography } from '@/constants/theme';

const CELEBRATION_EMOJI = '🎉';
const CELEBRATION_LABEL = 'C’est parti !';

export function CelebrationOverlay() {
  return (
    <View style={styles.overlay}>
      <Animated.Text
        entering={ZoomIn.springify().reduceMotion(ReduceMotion.System)}
        style={styles.emoji}
      >
        {CELEBRATION_EMOJI}
      </Animated.Text>
      <Text style={styles.label}>{CELEBRATION_LABEL}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  emoji: { ...Typography.emoji },
  label: { ...Typography.displayValue, color: Colors.textInverted },
});
