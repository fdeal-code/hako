// HAKO — Planning : bandeau « où est-on ce jour-là ? » (voyages multi-villes)
// Jour normal : « Rome · étape 1 · 02 → 05 juin »
// Jour de transfert : « Rome → Florence · jour de transfert »

import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { TripStop } from '@/types/tripStops';
import { stopColor } from '@/utils/tripStops';

interface StopDayBannerProps {
  dayStops: readonly TripStop[]; // étapes qui couvrent le jour sélectionné
}

const DOT_SIZE = 8;

function shortDate(day: string): string {
  const [, m, d] = day.split('-');
  return `${d}/${m}`;
}

export function StopDayBanner({ dayStops }: StopDayBannerProps) {
  const from = dayStops[0];
  if (!from) return null;
  const to = dayStops[1];
  const isTransfer = to !== undefined;

  return (
    <View style={[styles.wrap, isTransfer && styles.wrapTransfer]}>
      <View style={styles.dots}>
        {dayStops.map(stop => (
          <View key={stop.id} style={[styles.dot, { backgroundColor: stopColor(stop.position, Colors.stopPalette) }]} />
        ))}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {isTransfer ? `${from.place_name} → ${to.place_name}` : from.place_name}
      </Text>
      <Text style={styles.sub} numberOfLines={1}>
        {isTransfer
          ? 'jour de transfert'
          : `étape ${from.position + 1} · ${shortDate(from.start_date)} → ${shortDate(from.end_date)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm2,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceAlt,
  },
  wrapTransfer: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.accent,
    backgroundColor: Colors.background,
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: Radii.full,
  },
  title: {
    ...Typography.bodySmall,
    fontWeight: '800',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sub: {
    flex: 1,
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
});
