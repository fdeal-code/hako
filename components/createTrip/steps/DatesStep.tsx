// HAKO — Création · étape 2 « Quand ? » (maquette « V2 · 2 Dates »)
// Calendrier blanc (plage beige, départ / retour en ronds noirs) puis les
// deux cartes DÉPART / RETOUR.

import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { CreateTripForm } from '@/hooks/useCreateTripForm';
import { StepTitle, createCardStyles as card } from '@/components/createTrip/CreateTripChrome';
import { localDayIso } from '@/utils/tripStops';

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const WEEKDAYS_LONG = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAY_CIRCLE = 36;
const CELL_HEIGHT = 40;
const DAYS_PER_WEEK = 7;

function dayIso(year: number, month: number, day: number): string {
  return localDayIso(new Date(year, month, day));
}

function shortLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${String(d ?? '').padStart(2, '0')} ${MONTHS_SHORT[(m ?? 1) - 1] ?? ''}`;
}

function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAYS_LONG[new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getDay()] ?? '';
}

export function DatesStep({ form }: { form: CreateTripForm }) {
  const today = useMemo(() => localDayIso(new Date()), []);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());

  const now = new Date();
  const canGoPrev = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth());
  const prevMonth = () => {
    if (!canGoPrev) return;
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % DAYS_PER_WEEK; // lundi = 0
  const cells = Math.ceil((firstWeekday + daysInMonth) / DAYS_PER_WEEK) * DAYS_PER_WEEK;
  const { startDate, endDate } = form;

  return (
    <View>
      <StepTitle title="Quand ?" subtitle="Sélectionne ton départ puis ton retour." />

      <View style={[card.whiteCard, styles.calendar]}>
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={prevMonth} disabled={!canGoPrev} hitSlop={12} accessibilityLabel="Mois précédent">
            <Ionicons name="chevron-back" size={20} color={canGoPrev ? Colors.textInk : Colors.textTertiary} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{MONTHS_FR[month]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} hitSlop={12} accessibilityLabel="Mois suivant">
            <Ionicons name="chevron-forward" size={20} color={Colors.textInk} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((w, i) => <Text key={i} style={styles.weekday}>{w}</Text>)}
        </View>

        <View style={styles.grid}>
          {Array.from({ length: cells }, (_, i) => {
            const dayNum = i - firstWeekday + 1;
            if (dayNum < 1 || dayNum > daysInMonth) return <View key={i} style={styles.cell} />;
            const iso = dayIso(year, month, dayNum);
            const isPast = iso < today;
            const isStart = iso === startDate;
            const isEnd = iso === endDate;
            const inRange = !!startDate && !!endDate && iso > startDate && iso < endDate;
            const hasRange = !!startDate && !!endDate;
            return (
              <TouchableOpacity
                key={i}
                style={styles.cell}
                onPress={() => form.selectDay(iso)}
                disabled={isPast}
                activeOpacity={0.7}
                accessibilityLabel={`${dayNum} ${MONTHS_FR[month]}`}
              >
                {(inRange || (isStart && hasRange) || (isEnd && hasRange)) && (
                  <View style={[styles.band, isStart && styles.bandStart, isEnd && styles.bandEnd]} />
                )}
                <View style={[styles.dayCircle, (isStart || isEnd) && styles.dayCircleOn]}>
                  <Text
                    style={[
                      styles.dayText,
                      isPast && styles.dayTextPast,
                      (isStart || isEnd) && styles.dayTextOn,
                      iso === today && !isStart && !isEnd && styles.dayTextToday,
                    ]}
                  >
                    {dayNum}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.boxes}>
        <View style={[card.creamTile, styles.box]}>
          <Text style={styles.boxLabel}>DÉPART</Text>
          <Text style={styles.boxValue}>{startDate ? shortLabel(startDate) : '—'}</Text>
          <Text style={styles.boxSub}>{startDate ? weekdayLabel(startDate) : 'Choisis un jour'}</Text>
        </View>
        <View style={[card.creamTile, styles.box]}>
          <Text style={styles.boxLabel}>RETOUR</Text>
          <Text style={styles.boxValue}>{endDate ? shortLabel(endDate) : '—'}</Text>
          <Text style={[styles.boxSub, endDate && styles.boxSubAccent]}>
            {endDate ? `${form.totalNights} nuit${form.totalNights > 1 ? 's' : ''}` : 'Puis ton retour'}
          </Text>
        </View>
      </View>

      {startDate && endDate && !form.enoughNights && (
        <Text style={styles.warning}>
          Il faut au moins une nuit par ville ({form.stops.length} villes).
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: {
    padding: Spacing.md2,
    gap: Spacing.sm2,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textInk,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.xs,
  },
  cell: {
    width: `${100 / DAYS_PER_WEEK}%`,
    height: CELL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: DAY_CIRCLE,
    backgroundColor: Colors.line,
  },
  bandStart: { left: '50%' },
  bandEnd: { right: '50%' },
  dayCircle: {
    width: DAY_CIRCLE,
    height: DAY_CIRCLE,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleOn: {
    backgroundColor: Colors.primary,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textInk,
  },
  dayTextPast: { color: Colors.textTertiary },
  dayTextOn: { color: Colors.textInverted, fontWeight: '600' },
  dayTextToday: { color: Colors.accent, fontWeight: '700' },
  boxes: {
    flexDirection: 'row',
    gap: Spacing.sm2 - 2,
    marginTop: Spacing.lg,
  },
  box: {
    flex: 1,
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md2,
  },
  boxLabel: {
    ...Typography.displayLabel,
    color: Colors.textPrimary,
  },
  boxValue: {
    ...Typography.displayValue,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  boxSub: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  boxSubAccent: {
    color: Colors.accent,
  },
  warning: {
    ...Typography.bodySmall,
    color: Colors.negative,
    marginTop: Spacing.md,
  },
});
