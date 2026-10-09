// HAKO — AnimatedPressable : bouton avec micro-animation au toucher
// S'enfonce légèrement (ressort) puis revient ; retour haptique optionnel.
// Respecte « Réduire les animations » du téléphone. Remplace
// TouchableOpacity partout où un retour tactile vivant compte.

import { ReactNode } from 'react';
import { GestureResponderEvent, Insets, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Motion } from '@/constants/theme';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export type HapticKind = 'selection' | 'light' | 'medium' | 'success';

function fireHaptic(kind: HapticKind) {
  if (kind === 'selection') void Haptics.selectionAsync();
  else if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else void Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
}

export interface AnimatedPressableProps
  extends Pick<PressableProps, 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityState' | 'accessibilityHint' | 'testID' | 'onLongPress'> {
  children: ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Échelle au toucher (Motion.pressScale par défaut) */
  scaleTo?: number;
  /** Retour haptique au tap (aucun par défaut) */
  haptic?: HapticKind;
  hitSlop?: number | Insets;
}

export function AnimatedPressable({
  children, onPress, style, disabled = false, scaleTo = Motion.pressScale, haptic, hitSlop, ...a11y
}: AnimatedPressableProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressableBase
      {...a11y}
      hitSlop={hitSlop}
      disabled={disabled}
      style={[style, animatedStyle]}
      onPressIn={() => { if (!reduceMotion) scale.set(withSpring(scaleTo, Motion.spring)); }}
      onPressOut={() => { scale.set(withSpring(1, Motion.spring)); }}
      onPress={e => {
        if (haptic) fireHaptic(haptic);
        onPress?.(e);
      }}
    >
      {children}
    </AnimatedPressableBase>
  );
}
