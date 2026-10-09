// HAKO — Trip Match : reveal (écran signature)
// Anneau de compatibilité animé + insights du groupe (fonctions pures),
// puis CTA vers les propositions.

import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, ReduceMotion } from 'react-native-reanimated';

import { Colors, Radii, Shadows, Spacing } from '@/constants/theme';
import { CompatibilityRing } from '@/components/match/CompatibilityRing';
import { useTripMatch } from '@/hooks/useTripMatch';
import { computeCompatibility, computeInsights } from '@/utils/matchInsights';

const INSIGHTS_DELAY_MS = 900;  // les insights arrivent après l'anneau
const INSIGHT_STAGGER_MS = 220;
const INSIGHT_FADE_MS = 350;

export default function MatchRevealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { responses, loading, error } = useTripMatch(id);

  const score = useMemo(() => computeCompatibility(responses), [responses]);
  const insights = useMemo(() => computeInsights(responses), [responses]);

  if (loading && responses.length === 0) {
    return (
      <View style={[styles.root, styles.centerAll]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.sm }]}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
      </TouchableOpacity>

      <Text style={styles.title}>Votre match de groupe</Text>

      <View style={styles.ringZone}>
        <CompatibilityRing score={score} />
      </View>

      <View style={styles.insights}>
        {insights.map((insight, i) => (
          <Animated.View
            key={insight.text}
            entering={FadeInUp.delay(INSIGHTS_DELAY_MS + i * INSIGHT_STAGGER_MS)
              .duration(INSIGHT_FADE_MS)
              .reduceMotion(ReduceMotion.System)}
            style={styles.insightCard}
          >
            <View
              style={[
                styles.insightIcon,
                insight.kind === 'friction' && styles.insightIconFriction,
              ]}
            >
              <Ionicons
                name={insight.icon}
                size={18}
                color={insight.kind === 'friction' ? Colors.negative : Colors.positive}
              />
            </View>
            <Text style={styles.insightText}>{insight.text}</Text>
          </Animated.View>
        ))}
      </View>

      {error !== null && <Text style={styles.error}>{error}</Text>}

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => { if (id) router.replace(`/match/${id}/proposals`); }}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaLabel}>Voir les propositions</Text>
          <Ionicons name="arrow-forward" size={18} color={Colors.textInverted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.md2 },
  centerAll: { alignItems: 'center', justifyContent: 'center' },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  ringZone: { marginTop: Spacing.lg, marginBottom: Spacing.lg },
  insights: { flex: 1, gap: Spacing.sm2 },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm2,
    backgroundColor: Colors.surface,
    borderRadius: Radii.sm,
    padding: Spacing.sm2,
    ...Shadows.sm,
  },
  insightIcon: {
    width: 34,
    height: 34,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.positive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightIconFriction: { borderColor: Colors.negative },
  insightText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  error: { textAlign: 'center', color: Colors.negative, fontSize: 13, fontWeight: '600' },
  footer: { paddingTop: Spacing.sm },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radii.pill,
    paddingVertical: Spacing.md,
  },
  ctaLabel: { color: Colors.textInverted, fontSize: 16, fontWeight: '700' },
});
