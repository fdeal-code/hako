// HAKO — Trip Match : reveal (écran signature)
// Anneau de compatibilité animé + insights du groupe (fonctions pures),
// puis CTA vers les propositions.

import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, ReduceMotion } from 'react-native-reanimated';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, StepActions, StepTitle, createCardStyles } from '@/components/createTrip/CreateTripChrome';
import { CompatibilityRing } from '@/components/match/CompatibilityRing';
import { useTripMatch } from '@/hooks/useTripMatch';
import { computeCompatibility, computeInsights } from '@/utils/matchInsights';

const INSIGHTS_DELAY_MS = 900;  // les insights arrivent après l'anneau
const INSIGHT_STAGGER_MS = 220;
const INSIGHT_FADE_MS = 350;
const ICON_SIZE = 36;

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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader title="Trip Match" onClose={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StepTitle title="Votre match de groupe" subtitle="Ce qui vous rassemble, et là où il faudra négocier." />

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
              style={[createCardStyles.whiteCard, styles.insightCard]}
            >
              <View style={[styles.insightIcon, insight.kind === 'friction' && styles.insightIconFriction]}>
                <Ionicons name={insight.icon} size={18} color={Colors.white} />
              </View>
              <Text style={styles.insightText}>{insight.text}</Text>
            </Animated.View>
          ))}
        </View>

        {error !== null && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <StepActions
        onBack={() => router.back()}
        onNext={() => { if (id) router.replace(`/match/${id}/proposals`); }}
        label="Voir les propositions"
        variant="accent"
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  centerAll: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.xl, paddingBottom: Spacing.xl },
  ringZone: { marginBottom: Spacing.lg },
  insights: { gap: Spacing.sm2 },
  insightCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.md },
  insightIcon: {
    width: ICON_SIZE, height: ICON_SIZE, borderRadius: Radii.full,
    backgroundColor: Colors.positive, alignItems: 'center', justifyContent: 'center',
  },
  insightIconFriction: { backgroundColor: Colors.accent },
  insightText: { flex: 1, ...Typography.body, color: Colors.textInk, lineHeight: 20 },
  error: { ...Typography.body, color: Colors.negative, textAlign: 'center', marginTop: Spacing.md },
});
