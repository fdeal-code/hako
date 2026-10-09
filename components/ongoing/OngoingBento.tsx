// HAKO — Tuiles du dashboard « en cours » : ce dont on a besoin tout de suite
// 1. À LA UNE (pleine largeur) : activité en cours ou prochaine, adresse ou
//    infos du billet, « Y aller » — un tap ouvre le billet, sinon la page de
//    l'activité ; quand plus rien n'est prévu, une envie à faire dans le coin.
// 2. PLANNING du jour (pleine largeur, puis demain).
// 3. DÉPENSES (ajout rapide) + CARTE (ouvre la carte plein écran).
// Source unique : utilisé par app/trip/[id]/dashboard.tsx ET par
// components/home/ExpandedDashboard.tsx (ouverture depuis l'accueil).

import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { MapEmptyState } from '@/components/map/MapEmptyState';
import { StopMarkers } from '@/components/map/StopMarkers';
import { OngoingTripState } from '@/hooks/useOngoingTrip';
import { formatEuros } from '@/utils/dashboardSummary';
import { countdown, Destination, directionsUrl, shortTime, toMinutes } from '@/utils/ongoingTrip';
import { Region } from '@/utils/mapRegion';

interface OngoingBentoProps {
  tripId: string;
  /** Données du voyage en cours, chargées par le dashboard */
  ongoing: OngoingTripState;
  /** Cadrage de la mini-carte (étape du jour, sinon tout le trajet) */
  region: Region | null;
  onMapPress: () => void;
  availableHeight?: number;
}

const TILE_HEIGHT = 150;
const TILE_MIN_HEIGHT = 120;
const ROW_GAP = Spacing.sm2 - 2;
const ROWS = 3;
const PLANNING_LINES = 4;
const SMALL_PLUS = 24;
const OS: 'ios' | 'android' | 'other' = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other';


function openDirections(dest: Destination) {
  const url = directionsUrl(dest, OS);
  if (url) void Linking.openURL(url);
}

export function OngoingBento({ tripId, ongoing: o, region, onMapPress, availableHeight }: OngoingBentoProps) {
  const tileHeight = availableHeight === undefined
    ? TILE_HEIGHT
    : Math.max(TILE_MIN_HEIGHT, Math.min(TILE_HEIGHT, Math.floor((availableHeight - ROW_GAP * (ROWS - 1)) / ROWS)));
  const { current, left } = o.schedule;
  const focus = o.focus;
  const today = o.data?.today ?? [];
  const tomorrow = o.data?.tomorrow ?? [];
  const idea = o.ideas[0] ?? null;

  const openPlanning = (day: string) => router.push({ pathname: '/trip/[id]/planning', params: { id: tripId, highlightDay: day } });
  const openDoc = (docId: string) => router.push({ pathname: '/trip/[id]/document/[docId]', params: { id: tripId, docId } });
  const openActivity = (itemId: string) => router.push({ pathname: '/trip/[id]/planning-detail', params: { id: tripId, itemId } });

  /* La carte noire mène à l'essentiel : le billet, sinon la page de l'activité ou de l'envie */
  const openFocus = () => {
    if (focus && o.focusTicket) openDoc(o.focusTicket.id);
    else if (focus) openActivity(focus.id);
    else if (idea) router.push({ pathname: '/trip/[id]/envies', params: { id: tripId, wish: idea.id } });
    else router.push({ pathname: '/trip/[id]/help', params: { id: tripId, tab: 'activities' } });
  };

  const focusDest: Destination | null = focus
    ? { label: focus.title, address: focus.wish?.address ?? null, latitude: focus.wish?.latitude ?? null, longitude: focus.wish?.longitude ?? null }
    : null;
  const ideaDest: Destination | null = idea
    ? { label: idea.title, address: idea.address, latitude: idea.latitude, longitude: idea.longitude }
    : null;
  const canGo = (d: Destination | null) => !!d && directionsUrl(d, OS) !== null;

  return (
    <View style={styles.wrap}>
      {/* ── 1. À la une ── */}
      <View style={styles.row}>
        <GlassCard flex={1} height={tileHeight} variant="dark" onPress={openFocus}>
          {!o.data ? <ActivityIndicator color={Colors.white} /> : focus ? (
            <>
              <View style={styles.titleRow}>
                <Text style={styles.kicker} numberOfLines={1}>
                  {current
                    ? `EN CE MOMENT${current.end_time ? ` · jusqu’à ${shortTime(current.end_time)}` : ''}`
                    : `${shortTime(focus.start_time)} · ${countdown(o.now, toMinutes(focus.start_time) ?? o.now)}`}
                </Text>
                <View style={styles.dayPill}><Text style={styles.dayPillText}>J{o.day.day}/{o.day.total}</Text></View>
              </View>
              <View style={styles.focusBody}>
                <Text style={styles.focusTitle} numberOfLines={1}>{focus.title}</Text>
                <View style={styles.addressRow}>
                  <Ionicons name={o.focusTicket ? 'ticket-outline' : 'location-outline'} size={13} color={Colors.textOnDark} />
                  <Text style={styles.address} numberOfLines={1}>
                    {o.focusTicket
                      ? [o.focusTicket.details?.from && o.focusTicket.details?.to ? `${o.focusTicket.details.from} → ${o.focusTicket.details.to}` : null,
                        o.focusTicket.details?.seat].filter(Boolean).join(' · ') || o.focusTicket.title
                      : focus.wish?.address ?? o.stop?.place_name ?? ''}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                {canGo(focusDest) && focusDest && (
                  <TouchableOpacity style={styles.go} onPress={() => openDirections(focusDest)} accessibilityRole="button">
                    <Ionicons name="navigate" size={14} color={Colors.white} />
                    <Text style={styles.goText}>Y aller</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.hint}>
                  <Text style={styles.hintText}>{o.focusTicket ? 'Voir le billet' : 'Détails'}</Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textOnDark} />
                </View>
              </View>
            </>
          ) : idea ? (
            <>
              <View style={styles.titleRow}>
                <Text style={styles.kicker}>PLUS RIEN DE PRÉVU · À FAIRE DANS LE COIN</Text>
              </View>
              <View style={styles.focusBody}>
                <Text style={styles.focusTitle} numberOfLines={1}>{idea.title}</Text>
                <Text style={styles.address} numberOfLines={1}>
                  {idea.status === 'validated' ? 'Validée par le groupe' : 'Encore à voter'}
                  {o.ideas.length > 1 ? ` · +${o.ideas.length - 1} idée${o.ideas.length > 2 ? 's' : ''}` : ''}
                </Text>
              </View>
              <View style={styles.actions}>
                {canGo(ideaDest) && ideaDest && (
                  <TouchableOpacity style={styles.go} onPress={() => openDirections(ideaDest)} accessibilityRole="button">
                    <Ionicons name="navigate" size={14} color={Colors.white} />
                    <Text style={styles.goText}>Y aller</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.hint}>
                  <Text style={styles.hintText}>Voir l’envie</Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textOnDark} />
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.titleRow}>
                <Text style={styles.kicker}>QUARTIER LIBRE</Text>
                <View style={styles.dayPill}><Text style={styles.dayPillText}>J{o.day.day}/{o.day.total}</Text></View>
              </View>
              <Text style={styles.focusTitle} numberOfLines={2}>Rien de prévu, profitez de {o.stop?.place_name ?? 'la ville'} !</Text>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.go} onPress={() => router.push({ pathname: '/trip/[id]/help', params: { id: tripId, tab: 'activities' } })} accessibilityRole="button">
                  <Ionicons name="sparkles" size={14} color={Colors.white} />
                  <Text style={styles.goText}>Idées Hako</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </GlassCard>
      </View>

      {/* ── 2. Planning du jour ── */}
      <View style={styles.row}>
        <GlassCard flex={1} height={tileHeight} onPress={() => openPlanning(o.today)}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>PLANNING</Text>
            <Text style={styles.muted}>{o.stop?.place_name ?? ''}</Text>
          </View>
          {today.length === 0 || left === 0 ? (
            <View style={styles.lines}>
              <Text style={styles.muted}>{today.length === 0 ? 'Rien au programme aujourd’hui' : 'Fini pour aujourd’hui'}</Text>
              {tomorrow.slice(0, 2).map(item => (
                <View key={item.id} style={styles.line}>
                  <Text style={styles.lineTime}>{shortTime(item.start_time)}</Text>
                  <Text style={styles.lineTitle} numberOfLines={1}>Demain · {item.title}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.lines}>
              {today.slice(Math.max(0, today.length - left - 1), Math.max(0, today.length - left - 1) + PLANNING_LINES).map(item => {
                const isCurrent = item.id === current?.id;
                const isPast = (toMinutes(item.end_time ?? item.start_time) ?? 0) <= o.now && !isCurrent;
                return (
                  <View key={item.id} style={styles.line}>
                    <Text style={[styles.lineTime, isPast && styles.past, isCurrent && styles.now]}>{shortTime(item.start_time)}</Text>
                    <Text style={[styles.lineTitle, isPast && styles.past, isCurrent && styles.now]} numberOfLines={1}>{item.title}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </GlassCard>
      </View>

      {/* ── 3. Dépenses + Carte ── */}
      <View style={styles.row}>
        <GlassCard flex={1} height={tileHeight} onPress={() => router.push({ pathname: '/trip/[id]/budget', params: { id: tripId } })}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>DÉPENSES</Text>
            <TouchableOpacity
              style={styles.plusSmall}
              onPress={() => router.push({ pathname: '/trip/[id]/budget', params: { id: tripId, add: '1' } })}
              hitSlop={8}
              accessibilityLabel="Ajouter une dépense"
            >
              <Ionicons name="add" size={16} color={Colors.accent} />
            </TouchableOpacity>
          </View>
          <View>
            <Text style={styles.big} numberOfLines={1} adjustsFontSizeToFit>{formatEuros(o.todaySpent)}</Text>
            <Text style={styles.muted} numberOfLines={1}>aujourd’hui · {formatEuros(o.budget.total)} au total</Text>
          </View>
        </GlassCard>

        <GlassCard flex={1} height={tileHeight} noPadding onPress={onMapPress}>
          {region === null ? (
            <MapEmptyState tone="dark" />
          ) : (
            <MapView
              style={StyleSheet.absoluteFill}
              initialRegion={region}
              region={region}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
            >
              {o.stops.some(st => st.lat !== null)
                ? <StopMarkers stops={o.stops} />
                : <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }} />}
            </MapView>
          )}
          <View style={styles.mapLabel}>
            <Ionicons name="navigate" size={12} color={Colors.white} />
            <Text style={styles.mapLabelText} numberOfLines={1}>{o.stop ? `Tu es à ${o.stop.place_name}` : 'Carte'}</Text>
          </View>
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: ROW_GAP },
  row: { flexDirection: 'row', gap: ROW_GAP },
  title: { ...Typography.displayLabel, color: Colors.textPrimary },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  bottom: { gap: 2 },
  dayPill: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radii.full, backgroundColor: Colors.accent },
  dayPillText: { ...Typography.bodySmall, fontWeight: '700', color: Colors.white },
  kicker: { flex: 1, ...Typography.bodySmall, fontWeight: '700', color: Colors.accent },
  focusBody: { gap: 2 },
  focusTitle: { ...Typography.cardTitle, fontSize: 18, color: Colors.white },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  address: { flex: 1, ...Typography.bodySmall, color: Colors.textOnDark },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  go: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.sm2, paddingVertical: Spacing.xs + 2, borderRadius: Radii.full, backgroundColor: Colors.accent,
  },
  goText: { ...Typography.chip, color: Colors.white },
  hint: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 2 },
  hintText: { ...Typography.bodySmall, fontWeight: '600', color: Colors.textOnDark },
  lines: { gap: 3 },
  line: { flexDirection: 'row', gap: Spacing.sm },
  lineTime: { width: 40, ...Typography.bodySmall, fontWeight: '700', color: Colors.textInk },
  lineTitle: { flex: 1, ...Typography.bodySmall, color: Colors.textInk },
  past: { color: Colors.textTertiary },
  now: { color: Colors.accent, fontWeight: '700' },
  muted: { ...Typography.bodySmall, color: Colors.textMuted },
  big: { ...Typography.displayValue, color: Colors.textPrimary },
  mapLabel: {
    position: 'absolute', bottom: 10, left: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radii.full,
  },
  mapLabelText: { flexShrink: 1, color: Colors.white, fontSize: 11, fontWeight: '600' },
  plusSmall: {
    width: SMALL_PLUS, height: SMALL_PLUS, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
});
