// HAKO — Question 1 : plages de dates (calendrier multi-périodes)
// 1er tap = début, 2e tap = fin (inversés si besoin). Plages listées
// sous le calendrier, supprimables au tap. Dates passées désactivées.

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { MatchDateRange } from '@/types/tripMatch';

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366; // garde-fou d'itération

function todayIso(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

function eachDay(range: MatchDateRange): string[] {
  const days: string[] = [];
  let cursor = Date.parse(`${range.start}T00:00:00Z`);
  const last = Date.parse(`${range.end}T00:00:00Z`);
  while (cursor <= last && days.length < MAX_RANGE_DAYS) {
    days.push(new Date(cursor).toISOString().split('T')[0] ?? '');
    cursor += DAY_MS;
  }
  return days;
}

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

interface DayMarking {
  color: string;
  textColor: string;
  startingDay?: boolean;
  endingDay?: boolean;
}

interface QuestionDatesProps {
  value: MatchDateRange[];
  onChange: (ranges: MatchDateRange[]) => void;
}

export function QuestionDates({ value, onChange }: QuestionDatesProps) {
  const [pendingStart, setPendingStart] = useState<string | null>(null);

  const onDayPress = (day: DateData) => {
    const date = day.dateString;
    if (pendingStart === null) {
      setPendingStart(date);
      return;
    }
    const [start, end] = date >= pendingStart ? [pendingStart, date] : [date, pendingStart];
    onChange([...value, { start, end }].sort((a, b) => a.start.localeCompare(b.start)));
    setPendingStart(null);
  };

  const removeRange = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const marked: Record<string, DayMarking> = {};
  for (const range of value) {
    const days = eachDay(range);
    days.forEach((d, i) => {
      marked[d] = {
        color: Colors.primary,
        textColor: Colors.textInverted,
        startingDay: i === 0 || marked[d]?.startingDay === true,
        endingDay: i === days.length - 1 || marked[d]?.endingDay === true,
      };
    });
  }
  if (pendingStart !== null) {
    marked[pendingStart] = {
      color: Colors.textSecondary,
      textColor: Colors.textInverted,
      startingDay: true,
      endingDay: true,
    };
  }

  return (
    <View style={styles.root}>
      <Calendar
        minDate={todayIso()}
        disableAllTouchEventsForDisabledDays
        onDayPress={onDayPress}
        markingType="period"
        markedDates={marked}
        firstDay={1}
        style={styles.calendar}
        theme={{
          calendarBackground: Colors.surface,
          dayTextColor: Colors.textPrimary,
          textDisabledColor: Colors.textTertiary,
          todayTextColor: Colors.primary,
          monthTextColor: Colors.textPrimary,
          arrowColor: Colors.textPrimary,
          textDayFontWeight: '500',
          textMonthFontWeight: '700',
          textDayHeaderFontWeight: '600',
        }}
      />

      <Text style={styles.hint}>
        {pendingStart !== null
          ? `Début : ${formatDay(pendingStart)} — tape la date de fin`
          : value.length === 0
            ? 'Tape un début puis une fin (plusieurs plages possibles)'
            : 'Ajoute d’autres plages si tu es flexible'}
      </Text>

      {value.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rangeList}>
          {value.map((range, i) => (
            <TouchableOpacity
              key={`${range.start}-${range.end}-${i}`}
              style={styles.rangeChip}
              onPress={() => removeRange(i)}
              activeOpacity={0.75}
            >
              <Text style={styles.rangeText}>
                {range.start === range.end
                  ? formatDay(range.start)
                  : `${formatDay(range.start)} – ${formatDay(range.end)}`}
              </Text>
              <Ionicons name="close-circle" size={16} color={Colors.textInverted} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  calendar: {
    borderRadius: Radii.sm,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  hint: {
    marginTop: Spacing.sm2,
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  rangeList: { marginTop: Spacing.sm2, flexGrow: 0 },
  rangeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.sm2,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
  },
  rangeText: { ...Typography.chip, color: Colors.textInverted },
});
