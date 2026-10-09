// HAKO — Briques du planning (maquette « Planning · Jour de transfert » 714:2864)
// Pastille de jour (points des villes), légende, ligne de créneau (heure +
// carte), bandeau « Arrivée à … », envie à planifier.

import { ComponentProps } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { PlannableWish, PlanningEntry } from '@/types/planning';
import { MapTicket } from '@/types/tripMap';
import { EntryKind } from '@/utils/planningDay';
import { formatDuration, ticketDuration } from '@/utils/tripMap';
import { stopColor } from '@/utils/tripStops';
import { formatStopRange } from '@/utils/wishLinks';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const DAY_CHIP_WIDTH = 40;
const DOT = 6;
const TIME_WIDTH = 38;
const CARD_HEIGHT = 82;
const BANNER_IMAGE = 40;
const BADGE = 28;
const WEEKDAYS = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];

const short = (t: string | null) => (t ? t.slice(0, 5) : '');

// ─── Jour ────────────────────────────────────────────────────────────────────
export function DayChip({ day, active, isToday, dotColors, onPress }: {
  day: string; active: boolean; isToday: boolean; dotColors: readonly string[]; onPress: () => void;
}) {
  const [y, m, d] = day.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()] ?? '';
  return (
    <TouchableOpacity
      style={[styles.dayChip, active && styles.dayChipActive]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${weekday} ${d}${isToday ? ', aujourd’hui' : ''}`}
    >
      <Text style={[styles.dayWeek, active && styles.dayWeekActive]}>{weekday}</Text>
      <Text style={[styles.dayNum, active && styles.dayNumActive, isToday && !active && styles.dayToday]}>{String(d).padStart(2, '0')}</Text>
      <View style={styles.dots}>
        {dotColors.map((c, i) => <View key={i} style={[styles.dot, { backgroundColor: c }]} />)}
      </View>
    </TouchableOpacity>
  );
}

export function StopLegend({ stops }: { stops: readonly { id: string; position: number; place_name: string }[] }) {
  return (
    <View style={styles.legend}>
      {stops.map(s => (
        <View key={s.id} style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: stopColor(s.position, Colors.stopPalette) }]} />
          <Text style={styles.legendText}>{s.place_name}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Créneau ─────────────────────────────────────────────────────────────────
function iconFor(kind: EntryKind, entry: PlanningEntry, ticket: MapTicket | null): IoniconName {
  if (kind === 'transport') return ticket?.category === 'flight' ? 'airplane-outline' : 'train-outline';
  if (kind === 'lodging') return entry.title.toLowerCase().startsWith('check-out') ? 'bag-handle-outline' : 'key-outline';
  if (kind === 'food') return entry.wish?.category === 'bar' ? 'wine-outline' : 'restaurant-outline';
  if (entry.wish?.category === 'monument') return 'business-outline';
  if (entry.wish?.category === 'photo_spot') return 'camera-outline';
  if (kind === 'activity') return 'ticket-outline';
  return 'time-outline';
}

/** Les deux infos sous le titre, selon le type de créneau. */
function infoLine(kind: EntryKind, entry: PlanningEntry, ticket: MapTicket | null): [string, string] {
  const range = entry.end_time ? `${short(entry.start_time)} → ${short(entry.end_time)}` : short(entry.start_time);
  if (kind === 'transport') {
    const duration = ticketDuration(ticket);
    const from = ticket?.details?.from ?? entry.wish?.address ?? range;
    const right = ticket ? `${duration ? `${formatDuration(duration)} · ` : ''}billet ✓` : 'Pas de billet';
    return [from, right];
  }
  if (kind === 'lodging') {
    const isOut = entry.title.toLowerCase().startsWith('check-out');
    return [`${isOut ? 'Avant' : 'Check-in'} ${short(entry.start_time)}`, entry.notes ?? ticket?.details?.reference ?? entry.wish?.address ?? ''];
  }
  if (entry.wish) {
    const ups = entry.wish.wish_votes.filter(v => v.vote === 'up').length;
    const status = entry.wish.status === 'validated' ? 'Envie validée' : 'À voter';
    return [status, ups > 0 ? `${ups} partant${ups > 1 ? 's' : ''}` : (entry.notes ?? range)];
  }
  return [range, entry.notes ?? ''];
}

export function EntryRow({ entry, kind, ticket, isCurrent, onPress, onLongPress }: {
  entry: PlanningEntry;
  kind: EntryKind;
  ticket: MapTicket | null;
  isCurrent: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const dark = kind === 'transport';
  const [left, right] = infoLine(kind, entry, ticket);
  return (
    <View style={styles.row}>
      <Text style={[styles.time, (isCurrent || dark) && styles.timeAccent]}>{short(entry.start_time)}</Text>
      <TouchableOpacity
        style={[styles.card, dark && styles.cardDark, isCurrent && !dark && styles.cardCurrent]}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.9}
        accessibilityRole="button"
      >
        <View style={styles.cardHead}>
          <Ionicons name={iconFor(kind, entry, ticket)} size={18} color={dark ? Colors.white : Colors.textInk} />
          <Text style={[styles.cardTitle, dark && styles.onDark]} numberOfLines={1}>{entry.title.toUpperCase()}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.info, dark && styles.infoAccent]} numberOfLines={1}>{left}</Text>
          {right ? <Text style={[styles.info, styles.infoRight, dark && styles.onDark]} numberOfLines={1}>{right}</Text> : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ─── Arrivée dans une nouvelle étape ─────────────────────────────────────────
export function ArrivalBanner({ stop, imageUrl }: {
  stop: { position: number; place_name: string; start_date: string; end_date: string };
  imageUrl: string | null;
}) {
  const nights = Math.round((Date.parse(stop.end_date) - Date.parse(stop.start_date)) / 86_400_000);
  return (
    <View style={styles.banner}>
      {imageUrl
        ? <Image source={{ uri: imageUrl }} style={styles.bannerImage} />
        : <View style={[styles.bannerImage, styles.bannerImageEmpty]}><Ionicons name="location" size={18} color={Colors.textPrimary} /></View>}
      <View style={styles.bannerText}>
        <Text style={styles.bannerTitle}>ARRIVÉE À {stop.place_name.toUpperCase()}</Text>
        <Text style={styles.bannerSub}>
          Étape {stop.position + 1} · {formatStopRange(stop.start_date, stop.end_date)} · {nights} nuit{nights > 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.badge}><Text style={styles.badgeText}>{stop.position + 1}</Text></View>
    </View>
  );
}

// ─── Envie à planifier ───────────────────────────────────────────────────────
export function ToPlanRow({ wish, onAdd }: { wish: PlannableWish; onAdd: () => void }) {
  return (
    <TouchableOpacity style={styles.toPlan} onPress={onAdd} activeOpacity={0.85} accessibilityRole="button">
      {wish.image_url
        ? <Image source={{ uri: wish.image_url }} style={styles.toPlanImage} />
        : <View style={[styles.toPlanImage, styles.bannerImageEmpty]}><Ionicons name="heart-outline" size={16} color={Colors.textPrimary} /></View>}
      <Text style={styles.toPlanTitle} numberOfLines={1}>{wish.title}</Text>
      <View style={styles.toPlanAdd}>
        <Ionicons name="add" size={16} color={Colors.accent} />
        <Text style={styles.toPlanAddText}>Planifier</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  dayChip: {
    width: DAY_CHIP_WIDTH, alignItems: 'center', gap: 3, paddingVertical: 9,
    borderRadius: Radii.sm, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.surface,
  },
  dayChipActive: { backgroundColor: Colors.primary },
  dayWeek: { fontSize: 10, fontWeight: '500', color: Colors.textMuted },
  dayWeekActive: { color: Colors.textOnDark },
  dayNum: { fontSize: 15, fontWeight: '600', color: Colors.textInk },
  dayNumActive: { color: Colors.white },
  dayToday: { color: Colors.accent },
  dots: { flexDirection: 'row', gap: 3, height: DOT },
  dot: { width: DOT, height: DOT, borderRadius: Radii.full },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 11, fontWeight: '500', color: Colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2 },
  time: { width: TIME_WIDTH, ...Typography.bodySmall, color: Colors.textMuted },
  timeAccent: { color: Colors.accent },
  card: {
    flex: 1, minHeight: CARD_HEIGHT, justifyContent: 'center', gap: Spacing.sm2,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card,
  },
  cardDark: { backgroundColor: Colors.primary },
  cardCurrent: { borderWidth: 1.5, borderColor: Colors.accent },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardTitle: { flex: 1, ...Typography.cardTitle, color: Colors.textInk },
  onDark: { color: Colors.white },
  cardInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  info: { flexShrink: 1, ...Typography.bodySmall, color: Colors.textInk },
  infoRight: { flexShrink: 1 },
  infoAccent: { color: Colors.accent },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2,
    paddingLeft: 10, paddingRight: 14, paddingVertical: 10,
    borderRadius: Radii.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.accent, backgroundColor: Colors.background,
  },
  bannerImage: { width: BANNER_IMAGE, height: BANNER_IMAGE, borderRadius: 14, borderWidth: 1, borderColor: Colors.primary },
  bannerImageEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceAlt },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { ...Typography.displayLabel, color: Colors.accent },
  bannerSub: { ...Typography.bodySmall, color: Colors.textMuted },
  badge: { width: BADGE, height: BADGE, borderRadius: Radii.full, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...Typography.chip, color: Colors.white },
  toPlan: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.sm2,
    borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.sm,
  },
  toPlanImage: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.line },
  toPlanTitle: { flex: 1, ...Typography.rowTitle, color: Colors.textInk },
  toPlanAdd: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  toPlanAddText: { ...Typography.chip, color: Colors.accent },
});
