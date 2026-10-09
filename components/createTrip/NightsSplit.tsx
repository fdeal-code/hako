// HAKO — Création : « Une nuit, un lieu » (affiché seulement si plusieurs villes)
// Barre de répartition + bandeau nuit par nuit + stepper par ville.
// Le total reste toujours juste : une nuit ajoutée à une ville est prise
// à la ville voisine (voir utils/tripStops.adjustNights).

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { SectionLabel, createCardStyles as card } from '@/components/createTrip/CreateTripChrome';
import { StopDraft } from '@/types/tripStops';
import { addDays, nightOwners, stopColor } from '@/utils/tripStops';

interface NightsSplitProps {
  stops: readonly StopDraft[];
  tripStartDate: string; // "YYYY-MM-DD"
  totalNights: number;
  onAdjust: (index: number, delta: 1 | -1) => void;
}

const WEEKDAYS_SHORT = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
const STEPPER_SIZE = 36;
const BADGE_SIZE = 28;
const BAR_HEIGHT = 10;
const DOT_SIZE = 6;
const MIN_NIGHTS = 1;

function weekdayOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const index = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return WEEKDAYS_SHORT[index] ?? '';
}

function shortDate(day: string): string {
  const [, m, d] = day.split('-');
  return `${d}/${m}`;
}

export function NightsSplit({ stops, tripStartDate, totalNights, onAdjust }: NightsSplitProps) {
  const nights = stops.map(s => s.nights);
  const owners = nightOwners(nights);
  const sum = nights.reduce((a, b) => a + b, 0);

  // Nuits cumulées avant chaque étape → dates d'arrivée / de départ
  const ranges = stops.map((stop, i) => {
    const nightsBefore = nights.slice(0, i).reduce((a, b) => a + b, 0);
    const start = addDays(tripStartDate, nightsBefore);
    return `${shortDate(start)} → ${shortDate(addDays(start, stop.nights))}`;
  });

  return (
    <View style={styles.wrap}>
      {/* Barre proportionnelle */}
      <View style={styles.bar}>
        {stops.map((stop, i) => (
          <View
            key={`bar-${i}`}
            style={[styles.barPart, { flex: Math.max(stop.nights, 0), backgroundColor: stopColor(i, Colors.stopPalette) }]}
          />
        ))}
      </View>

      {/* Nuit par nuit */}
      <View style={styles.labelWrap}>
        <SectionLabel>Nuit par nuit</SectionLabel>
      </View>
      <View style={styles.strip}>
        {owners.map((owner, night) => {
          const day = addDays(tripStartDate, night);
          return (
            <View key={day} style={[styles.night, { borderColor: stopColor(owner, Colors.stopPalette) }]}>
              <Text style={styles.nightWeekday}>{weekdayOf(day)}</Text>
              <Text style={styles.nightDay}>{day.slice(8, 10)}</Text>
              <View style={[styles.dot, { backgroundColor: stopColor(owner, Colors.stopPalette) }]} />
            </View>
          );
        })}
      </View>

      {/* Stepper par ville */}
      {stops.map((stop, i) => (
        <View key={`row-${i}`} style={[card.whiteCard, styles.row]}>
          <View style={[styles.badge, { backgroundColor: stopColor(i, Colors.stopPalette) }]}>
            <Text style={styles.badgeText}>{i + 1}</Text>
          </View>
          <View style={styles.rowText}>
            <Text style={card.cardTitle} numberOfLines={1}>{stop.place_name}</Text>
            <Text style={card.cardSub}>{ranges[i]}</Text>
          </View>
          <TouchableOpacity
            style={[styles.stepBtn, styles.stepBtnGhost, stop.nights <= MIN_NIGHTS && styles.stepBtnDisabled]}
            onPress={() => onAdjust(i, -1)}
            disabled={stop.nights <= MIN_NIGHTS}
            accessibilityLabel={`Une nuit de moins à ${stop.place_name}`}
          >
            <Ionicons name="remove" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.count}>{stop.nights}</Text>
          <TouchableOpacity
            style={[styles.stepBtn, styles.stepBtnFilled]}
            onPress={() => onAdjust(i, 1)}
            accessibilityLabel={`Une nuit de plus à ${stop.place_name}`}
          >
            <Ionicons name="add" size={18} color={Colors.textInverted} />
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.summary}>
        <Ionicons
          name={sum === totalNights ? 'checkmark-circle' : 'alert-circle'}
          size={20}
          color={sum === totalNights ? Colors.accent : Colors.negative}
        />
        <Text style={styles.summaryText}>{sum} / {totalNights} nuits réparties</Text>
      </View>
      <Text style={styles.hint}>
        Le jour de transfert compte pour les deux villes.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.sm2,
  },
  bar: {
    flexDirection: 'row',
    gap: Spacing.xs,
    height: BAR_HEIGHT,
  },
  barPart: {
    borderRadius: Radii.full,
  },
  labelWrap: {
    marginTop: Spacing.sm,
  },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  night: {
    alignItems: 'center',
    gap: 2,
    minWidth: 40,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.sm,
    borderWidth: 1,
    backgroundColor: Colors.surface,
  },
  nightWeekday: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  nightDay: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: Radii.full,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm2,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm2,
    paddingVertical: Spacing.sm2,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.textInverted,
  },
  rowText: {
    flex: 1,
  },

  stepBtn: {
    width: STEPPER_SIZE,
    height: STEPPER_SIZE,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnGhost: {
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
  },
  stepBtnFilled: {
    backgroundColor: Colors.primary,
  },
  stepBtnDisabled: {
    opacity: 0.3,
  },
  count: {
    ...Typography.displayValue,
    fontSize: 20,
    color: Colors.textPrimary,
    minWidth: 20,
    textAlign: 'center',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  summaryText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  hint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
});
