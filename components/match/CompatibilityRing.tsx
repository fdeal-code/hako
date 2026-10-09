// HAKO — Anneau de compatibilité animé (sans react-native-svg)
// Anneau de ticks : les segments actifs apparaissent en cascade
// (FadeIn décalé, ReduceMotion respecté) + compteur central.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Colors, Spacing } from '@/constants/theme';

const TICK_COUNT = 36;
const TICK_WIDTH = 4;
const TICK_HEIGHT = 16;
const TICK_RADIUS = 2;
const RING_SIZE = 220;
const ANIM_TOTAL_MS = 1200;       // durée de la cascade complète
const TICK_FADE_MS = 260;
const COUNT_UP_INTERVAL_MS = 24;  // cadence du compteur central
const FULL_CIRCLE_DEG = 360;
const SCORE_MAX = 100;

interface CompatibilityRingProps {
  score: number; // 0 → 100
}

export function CompatibilityRing({ score }: CompatibilityRingProps) {
  const activeTicks = Math.round((score / SCORE_MAX) * TICK_COUNT);
  const [displayed, setDisplayed] = useState(0);

  /* Compteur central synchronisé avec la cascade */
  useEffect(() => {
    if (score <= 0) return;
    const step = Math.max(1, Math.ceil(score / (ANIM_TOTAL_MS / COUNT_UP_INTERVAL_MS)));
    const timer = setInterval(() => {
      setDisplayed(prev => {
        const next = prev + step;
        if (next >= score) {
          clearInterval(timer);
          return score;
        }
        return next;
      });
    }, COUNT_UP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [score]);

  const radius = RING_SIZE / 2 - TICK_HEIGHT;
  const tickDelay = activeTicks > 0 ? ANIM_TOTAL_MS / activeTicks : 0;

  return (
    <View style={styles.ring}>
      {Array.from({ length: TICK_COUNT }, (_, i) => {
        const angle = (i / TICK_COUNT) * FULL_CIRCLE_DEG;
        const transform = [{ rotate: `${angle}deg` }, { translateY: -radius }];
        const active = i < activeTicks;
        return (
          <View key={angle} style={[styles.tick, styles.tickBase, { transform }]}>
            {active && (
              <Animated.View
                entering={FadeIn.delay(i * tickDelay)
                  .duration(TICK_FADE_MS)
                  .reduceMotion(ReduceMotion.System)}
                style={styles.tickActive}
              />
            )}
          </View>
        );
      })}

      <View style={styles.center}>
        <Text style={styles.score}>{displayed}%</Text>
        <Text style={styles.caption}>compatibles</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  tick: {
    position: 'absolute',
    width: TICK_WIDTH,
    height: TICK_HEIGHT,
    borderRadius: TICK_RADIUS,
  },
  tickBase: { backgroundColor: Colors.border },
  tickActive: {
    flex: 1,
    borderRadius: TICK_RADIUS,
    backgroundColor: Colors.primary,
  },
  center: { alignItems: 'center', gap: Spacing.xs },
  score: { fontSize: 48, fontWeight: '900', color: Colors.textPrimary },
  caption: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
});
