// HAKO — Accueil : petite carte « Tes autres voyages » (slider horizontal)
// Photo, pastille (J-x, En cours, Terminé), nom et mois. Tap → dashboard
// animé (même ouverture que la grande carte).

import { useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { Trip } from '@/constants/types';
import { localDayIso, nightsBetween } from '@/utils/tripStops';
import { CardLayout } from '@/components/home/ExpandedDashboard';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';

const CARD_HEIGHT = 168;
const SCRIM = [Colors.scrimClear, Colors.scrimStrong] as const;
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function monthYear(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1] ?? ''} ${y ?? ''}`;
}

export function OtherTripCard({ trip, width, onExpand }: { trip: Trip; width: number; onExpand: (layout: CardLayout) => void }) {
  const ref = useRef<View>(null);
  const today = localDayIso(new Date());
  const past = trip.end_date < today;
  const ongoing = !past && trip.start_date <= today;
  const tag = past ? 'Terminé' : ongoing ? 'En cours' : `J-${nightsBetween(today, trip.start_date)}`;

  return (
    <View ref={ref} collapsable={false} style={{ width }}>
      <AnimatedPressable
        style={styles.card}
        onPress={() => ref.current?.measureInWindow((x, y, w, h) => onExpand({ x, y, width: w, height: h }))}
        accessibilityRole="button"
        accessibilityLabel={`${trip.name}, ${tag}`}
      >
        {trip.cover_url
          ? <Image source={{ uri: trip.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, styles.coverEmpty]} />}
        <LinearGradient colors={SCRIM} style={StyleSheet.absoluteFill} />
        <View style={styles.top}>
          <View style={[styles.tag, past && styles.tagPast]}>
            <Text style={[styles.tagText, past && styles.tagTextPast]}>{tag}</Text>
          </View>
        </View>
        <View>
          <Text style={styles.name} numberOfLines={2}>{trip.name}</Text>
          <Text style={styles.sub} numberOfLines={1}>{monthYear(trip.start_date)} · {trip.destination}</Text>
        </View>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT, borderRadius: Radii.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.primary, padding: Spacing.sm2, justifyContent: 'space-between',
  },
  coverEmpty: { backgroundColor: Colors.primary },
  top: { flexDirection: 'row' },
  tag: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radii.full, backgroundColor: Colors.accent },
  tagPast: { backgroundColor: Colors.glassLight },
  tagText: { ...Typography.bodySmall, fontWeight: '600', color: Colors.white },
  tagTextPast: { color: Colors.textPrimary },
  name: { ...Typography.displayValue, color: Colors.white },
  sub: { ...Typography.bodySmall, color: Colors.white },
});
