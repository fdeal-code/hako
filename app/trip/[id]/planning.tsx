// HAKO — Planning (maquette « Planning · Jour de transfert » 714:2864)
// Pastilles des jours (un point par ville), légende des villes, puis la
// journée : en-tête « ROME · VEN. 05 JUIN · DERNIER JOUR », un créneau par
// carte (les trajets en noir), le bandeau « Arrivée à … » les jours de
// transfert, et les envies validées encore à planifier.
// Tap sur un trajet → le billet ; sur un autre créneau → sa page détail.
// Appui long → retirer du planning. ➕ → page « Au planning » (envie ou créneau libre).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { ArrivalBanner, DayChip, EntryRow, StopLegend, ToPlanRow } from '@/components/planning/PlanningParts';
import { LodgingNudge } from '@/components/partners/LodgingNudge';
import { useLodgingGaps } from '@/hooks/useLodgingGaps';
import { stopForNight } from '@/utils/lodgingGaps';
import { FilterButton } from '@/components/ui/FilterButton';
import { NavButton } from '@/components/ui/NavButton';
import { usePlanning } from '@/hooks/usePlanning';
import { PlanningEntry } from '@/types/planning';
import { toMinutes, ticketFor } from '@/utils/ongoingTrip';
import { EntryKind, entryKind, stopsOnDay } from '@/utils/planningDay';
import { stopColor } from '@/utils/tripStops';

const DAY_CHIP_GAP = 5;
const DAY_CHIP_STEP = 40 + DAY_CHIP_GAP; // largeur pastille + écart (défilement auto vers le jour choisi)
const NAV_SPACE = 120;
const MAX_TO_PLAN = 4;
const MINUTES_PER_HOUR = 60;

type Filter = 'all' | 'activity' | 'food' | 'transport' | 'lodging';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'activity', label: 'Activités' },
  { key: 'food', label: 'Repas' },
  { key: 'transport', label: 'Trajets' },
  { key: 'lodging', label: 'Logements' },
];

export default function PlanningScreen() {
  // highlightDay / highlightId : jour et créneau mis en avant (ex. juste ajouté)
  const { id: tripId, highlightDay, highlightId } = useLocalSearchParams<{
    id: string; highlightDay?: string; highlightId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const p = usePlanning(tripId, highlightDay);
  // Logement à proposer si l'étape de la nuit du jour choisi n'en a pas
  const { gaps } = useLodgingGaps(tripId ?? '');
  const nightStop = stopForNight(p.stops, p.selectedDay);
  const nightGap = nightStop && gaps.some(g => g.id === nightStop.id) ? nightStop : null;
  const [showFilters, setShowFilters] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const daysRef = useRef<ScrollView>(null);

  // Fait défiler les pastilles jusqu'au jour choisi
  const selectedIndex = p.days.indexOf(p.selectedDay);
  useEffect(() => {
    if (selectedIndex > 2) daysRef.current?.scrollTo({ x: (selectedIndex - 2) * DAY_CHIP_STEP, animated: true });
  }, [selectedIndex]);

  const now = new Date();
  const nowMinutes = now.getHours() * MINUTES_PER_HOUR + now.getMinutes();

  const rows = useMemo(() => p.entries.map(entry => {
    const ticket = ticketFor(entry, p.tickets, p.selectedDay);
    return { entry, ticket, kind: entryKind(entry, ticket !== null && ticket.category !== 'hotel') };
  }), [p.entries, p.tickets, p.selectedDay]);
  const visible = filter === 'all' ? rows : rows.filter(r => r.kind === filter || (filter === 'activity' && r.kind === 'other'));

  const isCurrent = (e: PlanningEntry) => {
    if (p.selectedDay !== p.today) return false;
    const start = toMinutes(e.start_time);
    const end = toMinutes(e.end_time) ?? (start !== null ? start + MINUTES_PER_HOUR : null);
    return start !== null && end !== null && start <= nowMinutes && nowMinutes < end;
  };

  const open = (entry: PlanningEntry, kind: EntryKind, ticketId: string | null) => {
    if (ticketId && (kind === 'transport' || kind === 'lodging')) {
      router.push({ pathname: '/trip/[id]/document/[docId]', params: { id: tripId ?? '', docId: ticketId } });
    } else {
      router.push({ pathname: '/trip/[id]/planning-detail', params: { id: tripId ?? '', itemId: entry.id } });
    }
  };

  const confirmRemove = (entry: PlanningEntry) => Alert.alert(
    'Retirer du planning ?',
    `« ${entry.title} » quitte le programme. L’envie reste dans vos envies.`,
    [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => { void p.remove(entry.id).then(err => { if (err) Alert.alert('Oups', err); }); } },
    ],
  );

  const arrivalImage = p.arrival
    ? p.entries.find(e => e.stop_id === p.arrival?.stop?.id && e.wish?.image_url)?.wish?.image_url ?? null
    : null;
  const dayToPlan = p.toPlan.slice(0, MAX_TO_PLAN);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── En-tête : titre, jours, légende ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Planning</Text>
        <ScrollView ref={daysRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
          {p.days.map(day => (
            <DayChip
              key={day}
              day={day}
              active={day === p.selectedDay}
              isToday={day === p.today}
              dotColors={stopsOnDay(p.stops, day).map(s => stopColor(s.position, Colors.stopPalette))}
              onPress={() => p.selectDay(day)}
            />
          ))}
        </ScrollView>
        {p.stops.length > 0 && <View style={styles.legend}><StopLegend stops={p.stops} /></View>}
        {showFilters && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map(f => (
              <FilterButton key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── La journée ── */}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + NAV_SPACE }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.dayHeader}>{p.header}</Text>
        {nightGap && <View style={styles.nudge}><LodgingNudge tripId={tripId ?? ''} stop={nightGap} /></View>}

        {!p.data && p.error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Le planning n’a pas pu se charger</Text>
            <Text style={styles.muted}>{p.error}</Text>
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{rows.length === 0 ? 'Rien de prévu ce jour-là' : 'Rien dans ce filtre'}</Text>
            <Text style={styles.muted}>Touche ➕ pour ajouter une envie validée ou un créneau libre.</Text>
          </View>
        ) : (
          visible.map(({ entry, ticket, kind }, index) => (
            <View key={entry.id} style={styles.item}>
              {filter === 'all' && p.arrival?.stop && p.arrival.index === index && (
                <ArrivalBanner stop={p.arrival.stop} imageUrl={arrivalImage} />
              )}
              <EntryRow
                entry={entry}
                kind={kind}
                ticket={ticket}
                isCurrent={isCurrent(entry) || entry.id === highlightId}
                onPress={() => open(entry, kind, ticket?.id ?? null)}
                onLongPress={() => confirmRemove(entry)}
              />
            </View>
          ))
        )}
        {filter === 'all' && p.arrival?.stop && p.arrival.index >= visible.length && visible.length > 0 && (
          <ArrivalBanner stop={p.arrival.stop} imageUrl={arrivalImage} />
        )}

        {dayToPlan.length > 0 && (
          <View style={styles.toPlan}>
            <Text style={styles.sectionTitle}>À PLANIFIER</Text>
            {dayToPlan.map(w => (
              <ToPlanRow
                key={w.id}
                wish={w}
                onAdd={() => router.push({ pathname: '/trip/[id]/plan-add', params: { id: tripId ?? '', wishId: w.id, day: p.selectedDay } })}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Barre du bas ── */}
      <View style={[styles.nav, { bottom: Math.max(insets.bottom, 10) + Spacing.md }]} pointerEvents="box-none">
        <NavButton icon="arrow-back-outline" onPress={() => router.back()} />
        <NavButton icon="add" iconSize={28} variant="accent" onPress={() => router.push({ pathname: '/trip/[id]/plan-add', params: { id: tripId ?? '', day: p.selectedDay } })} />
        <NavButton icon="filter-outline" onPress={() => { setShowFilters(v => !v); if (showFilters) setFilter('all'); }} />
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  nudge: { marginBottom: Spacing.sm2 },
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: Spacing.md, gap: Spacing.sm2 },
  title: { paddingHorizontal: Spacing.md2, ...Typography.displayTitle, color: Colors.textPrimary },
  days: { gap: DAY_CHIP_GAP, paddingHorizontal: Spacing.md2 },
  legend: { paddingHorizontal: Spacing.md2 },
  filters: { gap: Spacing.sm, paddingHorizontal: Spacing.md2 },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.md, gap: Spacing.sm2 },
  dayHeader: { ...Typography.displayLabel, color: Colors.textPrimary, paddingTop: Spacing.sm },
  item: { gap: Spacing.sm2 },
  empty: { gap: Spacing.xs, paddingVertical: Spacing.lg },
  emptyTitle: { ...Typography.rowTitle, color: Colors.textInk },
  muted: { ...Typography.body, color: Colors.textMuted },
  toPlan: { gap: Spacing.sm, marginTop: Spacing.md },
  sectionTitle: { ...Typography.displayLabel, color: Colors.textPrimary },
  nav: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 14 },
});
