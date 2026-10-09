// HAKO — AnimatedCard : carte qui apparaît en glissant (décalée selon sa
// position dans la liste) et s'enfonce au toucher si elle est cliquable.

import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';
import { AnimatedPressable, HapticKind } from '@/components/ui/AnimatedPressable';

interface AnimatedCardProps {
  children: ReactNode;
  /** Position dans la liste : règle le décalage d'apparition */
  index?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  haptic?: HapticKind;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function AnimatedCard({ children, index = 0, onPress, onLongPress, haptic, style, accessibilityLabel }: AnimatedCardProps) {
  const delay = Math.min(index, Motion.maxStaggerItems) * Motion.stagger;
  const entering = FadeInDown.delay(delay).duration(Motion.enter).reduceMotion(ReduceMotion.System);

  if (!onPress && !onLongPress) {
    return <Animated.View entering={entering} layout={LinearTransition} style={style}>{children}</Animated.View>;
  }
  return (
    <Animated.View entering={entering} layout={LinearTransition}>
      <AnimatedPressable
        onPress={onPress}
        onLongPress={onLongPress}
        haptic={haptic}
        style={style}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </AnimatedPressable>
    </Animated.View>
  );
}
