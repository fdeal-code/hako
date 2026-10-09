// HAKO — Briques de la carte plein écran (maquette « Carte » 723:2932)
// Repères (lieu, trajet), cartes du bas (trajet → billet, lieu → Y aller),
// pastilles de ville.

import { ComponentProps } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { LegMode, MapLeg, MapPlace } from '@/types/tripMap';
import { driveMinutes, formatDuration } from '@/utils/tripMap';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const CARD_WIDTH_RATIO = 0.82;
const PLACE_PIN = 30;
const LEG_PIN = 30;
const THUMB = 56;
const WEEKDAYS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

type PlaceColorKey = keyof typeof Colors.placeColors;

const PLACE_META: Record<PlaceColorKey, { icon: IoniconName; label: string }> = {
  hotel:      { icon: 'bed',        label: 'Logement' },
  restaurant: { icon: 'restaurant', label: 'Resto' },
  cafe:       { icon: 'cafe',       label: 'Café' },
  bar:        { icon: 'wine',       label: 'Bar' },
  monument:   { icon: 'business',   label: 'À voir' },
  activity:   { icon: 'ticket',     label: 'Activité' },
  photo_spot: { icon: 'camera',     label: 'Spot photo' },
  other:      { icon: 'location',   label: 'Lieu' },
};

export function placeMeta(category: string | null) {
  const key = (category && category in PLACE_META ? category : 'other') as PlaceColorKey;
  return { ...PLACE_META[key], color: Colors.placeColors[key] };
}

const MODE_ICON: Record<LegMode, IoniconName> = { flight: 'airplane', train: 'train', car: 'car' };
const MODE_LABEL: Record<LegMode, string> = { flight: 'Vol', train: 'Train', car: 'Voiture' };

function dayLabel(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()] ?? '';
  return `${weekday} ${String(d ?? '').padStart(2, '0')}`;
}

// ─── Repères ─────────────────────────────────────────────────────────────────
export function PlacePin({ place, selected }: { place: MapPlace; selected: boolean }) {
  const meta = placeMeta(place.category);
  const pending = place.status !== 'validated';
  return (
    <View style={[
      styles.placePin,
      { backgroundColor: pending ? Colors.surface : meta.color, borderColor: pending ? meta.color : Colors.white },
      selected && styles.pinSelected,
    ]}>
      <Ionicons name={meta.icon} size={15} color={pending ? meta.color : Colors.white} />
    </View>
  );
}

export function LegPin({ leg, todo }: { leg: MapLeg; todo: boolean }) {
  return (
    <View style={[styles.legPin, todo && styles.legPinTodo]}>
      <Ionicons name={MODE_ICON[leg.mode]} size={15} color={todo ? Colors.accent : Colors.textPrimary} />
    </View>
  );
}

// ─── Pastilles de ville ──────────────────────────────────────────────────────
export function CityChip({ label, active, today, onPress }: { label: string; active: boolean; today?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.85} accessibilityState={{ selected: active }}>
      {today && <View style={[styles.todayDot, active && styles.todayDotActive]} />}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Carte d'un trajet : un tap ouvre le billet ──────────────────────────────
export function LegCard({ leg, width, isPast, onPress }: { leg: MapLeg; width: number; isPast: boolean; onPress: () => void }) {
  const booked = leg.ticket !== null;
  const duration = leg.durationMinutes !== null
    ? `${MODE_LABEL[leg.mode]} · ${formatDuration(leg.durationMinutes)}`
    : leg.distanceKm !== null ? `~${formatDuration(driveMinutes(leg.distanceKm))} en voiture` : MODE_LABEL[leg.mode];
  const status = booked
    ? `${dayLabel(leg.date)} · billet ✓`
    : isPast ? `${dayLabel(leg.date)} · pas de billet` : 'À prévoir · ajouter le billet';
  return (
    <TouchableOpacity style={[styles.card, { width }, booked && styles.cardDark]} onPress={onPress} activeOpacity={0.9} accessibilityRole="button">
      <View style={styles.legHead}>
        <Ionicons name={MODE_ICON[leg.mode]} size={20} color={booked ? Colors.white : Colors.textPrimary} />
        <Text style={[styles.legTitle, booked && styles.onDark]} numberOfLines={1}>
          {leg.fromLabel.toUpperCase()} → {leg.toLabel.toUpperCase()}
        </Text>
        <Ionicons name={booked ? 'ticket-outline' : 'add-circle-outline'} size={20} color={booked ? Colors.white : Colors.accent} />
      </View>
      <View style={styles.legLine}>
        <Text style={[styles.legDuration, !booked && styles.inkText]}>{duration}</Text>
        <Text style={[styles.legStatus, booked ? styles.onDark : !isPast && styles.accentText]} numberOfLines={1}>{status}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Carte d'un lieu ─────────────────────────────────────────────────────────
export function PlaceCard({ place, width, selected, onPress, onGo }: {
  place: MapPlace; width: number; selected: boolean; onPress: () => void; onGo: (() => void) | null;
}) {
  const meta = placeMeta(place.category);
  const when = place.booked ? 'Réservé ✓'
    : place.plannedDay ? `${dayLabel(place.plannedDay)}${place.plannedTime ? ` · ${place.plannedTime}` : ''}`
      : place.status === 'validated' ? 'Pas encore planifié' : 'À voter';
  return (
    <TouchableOpacity style={[styles.card, styles.placeCard, { width }, selected && styles.cardSelected]} onPress={onPress} activeOpacity={0.9}>
      {place.imageUrl
        ? <Image source={{ uri: place.imageUrl }} style={styles.thumb} />
        : <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: meta.color }]}><Ionicons name={meta.icon} size={22} color={Colors.white} /></View>}
      <View style={styles.placeText}>
        <Text style={styles.placeTitle} numberOfLines={1}>{place.title}</Text>
        <View style={styles.placeMetaRow}>
          <View style={[styles.dot, { backgroundColor: meta.color }]} />
          <Text style={styles.muted} numberOfLines={1}>{meta.label} · {when}</Text>
        </View>
        {place.address ? <Text style={styles.muted} numberOfLines={1}>{place.address}</Text> : null}
      </View>
      {onGo && (
        <TouchableOpacity style={styles.go} onPress={onGo} hitSlop={6} accessibilityLabel={`Y aller : ${place.title}`}>
          <Ionicons name="navigate" size={16} color={Colors.white} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  placePin: {
    width: PLACE_PIN, height: PLACE_PIN, borderRadius: Radii.full, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', ...Shadows.md,
  },
  pinSelected: { transform: [{ scale: 1.25 }] },
  legPin: {
    width: LEG_PIN, height: LEG_PIN, borderRadius: Radii.full, borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', ...Shadows.sm,
  },
  legPinTodo: { borderColor: Colors.accent, borderStyle: 'dashed' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md2, paddingVertical: Spacing.sm2 - 2,
    borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.background, ...Shadows.sm,
  },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { ...Typography.filter, color: Colors.textPrimary },
  chipTextActive: { color: Colors.white },
  todayDot: { width: 7, height: 7, borderRadius: Radii.full, backgroundColor: Colors.accent },
  todayDotActive: { backgroundColor: Colors.accent },
  card: {
    padding: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.surface, gap: Spacing.sm, ...Shadows.card,
  },
  cardDark: { backgroundColor: Colors.primary },
  cardSelected: { borderWidth: 2, borderColor: Colors.accent },
  legHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2 },
  legTitle: { flex: 1, ...Typography.displayLabel, fontSize: 16, color: Colors.textPrimary },
  onDark: { color: Colors.white },
  legLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, paddingLeft: Spacing.lg + Spacing.xs },
  legDuration: { ...Typography.bodySmall, fontWeight: '700', color: Colors.accent },
  legStatus: { flex: 1, ...Typography.bodySmall, fontWeight: '600', color: Colors.textMuted },
  inkText: { color: Colors.textInk },
  accentText: { color: Colors.accent },
  placeCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2 },
  thumb: { width: THUMB, height: THUMB, borderRadius: Radii.sm, backgroundColor: Colors.line },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  placeText: { flex: 1, gap: 2 },
  placeTitle: { ...Typography.rowTitle, color: Colors.textInk },
  placeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: Radii.full },
  muted: { flexShrink: 1, ...Typography.bodySmall, color: Colors.textMuted },
  go: {
    width: 36, height: 36, borderRadius: Radii.full, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
});
