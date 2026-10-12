// HAKO — Bandeau « Pas encore de logement à Kyoto » (affiliation au bon moment)
// Affiché seulement quand une étape n'a aucun logement ; ouvre « On t'aide »
// directement sur cette étape (ville, dates et voyageurs déjà remplis).

import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Motion, Radii, Spacing, Typography } from '@/constants/theme';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';

const ICON = 36;
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function shortDay(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${d ?? ''} ${MONTHS[(m ?? 1) - 1] ?? ''}`;
}

interface LodgingNudgeProps {
  tripId: string;
  stop: { id: string; place_name: string; start_date: string; end_date: string };
}

export function LodgingNudge({ tripId, stop }: LodgingNudgeProps) {
  const open = () => router.push({ pathname: '/trip/[id]/help', params: { id: tripId, tab: 'lodging', stop: stop.id } });
  return (
    <Animated.View entering={FadeIn.duration(Motion.enter)}>
      <AnimatedPressable style={styles.card} onPress={open} accessibilityRole="button" accessibilityLabel={`Voir les logements à ${stop.place_name}`}>
        <View style={styles.icon}><Ionicons name="bed-outline" size={18} color={Colors.accent} /></View>
        <View style={styles.flex}>
          <Text style={styles.title} numberOfLines={1}>Pas encore de logement à {stop.place_name}</Text>
          <Text style={styles.sub}>Du {shortDay(stop.start_date)} au {shortDay(stop.end_date)}</Text>
        </View>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Voir</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.white} />
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.sm2,
    borderRadius: Radii.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.accent, backgroundColor: Colors.surface,
  },
  icon: { width: ICON, height: ICON, borderRadius: Radii.full, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.rowTitle, color: Colors.textInk },
  sub: { ...Typography.bodySmall, color: Colors.textMuted },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.sm2, paddingVertical: Spacing.xs + 2, borderRadius: Radii.full, backgroundColor: Colors.accent,
  },
  ctaText: { ...Typography.chip, color: Colors.white },
});
