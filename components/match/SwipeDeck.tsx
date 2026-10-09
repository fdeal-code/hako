// HAKO — Deck de cartes swipables (générique)
// Pan + rotation proportionnelle, stamps OUI/NON progressifs,
// seuil ~30 % de la largeur, boutons ✕ / ❤️ sous le deck.

import { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  ReduceMotion,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';

export interface SwipeCardContent {
  id: string;
  title: string;
  emoji: string;
  gradient: readonly [string, string];
}

const SWIPE_THRESHOLD_RATIO = 0.3;   // ~30 % de la largeur d'écran
const MAX_ROTATION_DEG = 12;
const EXIT_DISTANCE_RATIO = 1.4;
const EXIT_DURATION_MS = 220;
const VERTICAL_DAMPING = 0.35;
const NEXT_CARD_SCALE = 0.94;
const CARD_HEIGHT = 300;
const STAMP_YES = 'OUI';
const STAMP_NO = 'NON';

interface SwipeDeckProps {
  cards: readonly SwipeCardContent[];
  onComplete: (likedIds: string[]) => void;
}

function CardFace({ card }: { card: SwipeCardContent }) {
  return (
    <LinearGradient colors={card.gradient} style={styles.cardFace}>
      <Text style={styles.emoji}>{card.emoji}</Text>
      <Text style={styles.cardTitle}>{card.title}</Text>
    </LinearGradient>
  );
}

export function SwipeDeck({ cards, onComplete }: SwipeDeckProps) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const likedRef = useRef<string[]>([]);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  const current = cards[index];
  const next = cards[index + 1];
  const threshold = width * SWIPE_THRESHOLD_RATIO;

  const handleSwiped = (liked: boolean) => {
    const card = cards[index];
    if (!card) return;
    if (liked) likedRef.current = [...likedRef.current, card.id];
    tx.value = 0;
    ty.value = 0;
    const nextIndex = index + 1;
    setIndex(nextIndex);
    if (nextIndex >= cards.length) onComplete(likedRef.current);
  };

  const swipeAway = (liked: boolean) => {
    tx.value = withTiming(
      (liked ? 1 : -1) * width * EXIT_DISTANCE_RATIO,
      { duration: EXIT_DURATION_MS, reduceMotion: ReduceMotion.System },
      finished => { if (finished) runOnJS(handleSwiped)(liked); },
    );
  };

  const pan = Gesture.Pan()
    .onUpdate(e => {
      tx.value = e.translationX;
      ty.value = e.translationY * VERTICAL_DAMPING;
    })
    .onEnd(() => {
      if (Math.abs(tx.value) > threshold) {
        runOnJS(swipeAway)(tx.value > 0);
      } else {
        tx.value = withSpring(0, { reduceMotion: ReduceMotion.System });
        ty.value = withSpring(0, { reduceMotion: ReduceMotion.System });
      }
    });

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${interpolate(tx.value, [-width, width], [-MAX_ROTATION_DEG, MAX_ROTATION_DEG])}deg` },
    ],
  }));
  const yesStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [0, threshold], [0, 1], Extrapolation.CLAMP),
  }));
  const noStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-threshold, 0], [1, 0], Extrapolation.CLAMP),
  }));
  const nextStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(tx.value) / threshold, 1);
    return { transform: [{ scale: NEXT_CARD_SCALE + (1 - NEXT_CARD_SCALE) * progress }] };
  });

  if (!current) {
    return (
      <View style={styles.doneBox}>
        <Ionicons name="checkmark-circle" size={48} color={Colors.positive} />
        <Text style={styles.doneText}>C’est noté !</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.deck, { height: CARD_HEIGHT }]}>
        {next && (
          <Animated.View style={[styles.card, nextStyle]}>
            <CardFace card={next} />
          </Animated.View>
        )}
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.card, topStyle]}>
            <CardFace card={current} />
            <Animated.View style={[styles.stamp, styles.stampYes, yesStyle]}>
              <Text style={[styles.stampText, { color: Colors.positive }]}>{STAMP_YES}</Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.stampNo, noStyle]}>
              <Text style={[styles.stampText, { color: Colors.negative }]}>{STAMP_NO}</Text>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>

      <Text style={styles.counter}>{index + 1}/{cards.length}</Text>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => swipeAway(false)} activeOpacity={0.8}>
          <Ionicons name="close" size={26} color={Colors.negative} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => swipeAway(true)} activeOpacity={0.8}>
          <Ionicons name="heart" size={24} color={Colors.vote.love} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  deck: { width: '100%', justifyContent: 'center' },
  card: { ...StyleSheet.absoluteFill, ...Shadows.md },
  cardFace: {
    flex: 1,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  emoji: { ...Typography.emoji },
  cardTitle: { ...Typography.displayValue, color: Colors.white },
  stamp: {
    position: 'absolute',
    top: Spacing.md2,
    borderWidth: 3,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.sm2,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
  },
  stampYes: { left: Spacing.md2, borderColor: Colors.positive, transform: [{ rotate: '-12deg' }] },
  stampNo: { right: Spacing.md2, borderColor: Colors.negative, transform: [{ rotate: '12deg' }] },
  stampText: { ...Typography.displayLabel, fontSize: Typography.section.fontSize, letterSpacing: 1 },
  counter: { marginTop: Spacing.sm2, ...Typography.bodySmall, color: Colors.textMuted },
  actions: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.sm2 },
  actionBtn: {
    width: 56,
    height: 56,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  doneBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  doneText: { ...Typography.cardTitle, color: Colors.textPrimary },
});
