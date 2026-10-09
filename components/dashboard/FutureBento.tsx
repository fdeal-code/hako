// HAKO — Tuiles du dashboard « avant le départ » (maquette « V2 · Dashboard »)
// DOCUMENT + PLANNING · Carte (moitié) + VOS ENVIES · ON T'AIDE + BUDGET.
// Source unique : utilisé par app/trip/[id]/dashboard.tsx ET par
// components/home/ExpandedDashboard.tsx (ouverture depuis l'accueil).

import { RefObject } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { HelpTile } from '@/components/dashboard/HelpTile';
import { MapEmptyState } from '@/components/map/MapEmptyState';
import { StopMarkers } from '@/components/map/StopMarkers';
import { useFutureDashboard } from '@/hooks/useFutureDashboard';
import { TripStop } from '@/types/tripStops';
import { Region } from '@/utils/mapRegion';
import { balanceLabel, formatEuros, plural } from '@/utils/dashboardSummary';

interface FutureBentoProps {
  tripId: string;
  startDate: string | null;
  destination: string;
  stops: readonly TripStop[];
  /** Région de la carte (étapes géolocalisées, sinon destination), null = état vide. */
  region: Region | null;
  mapCardRef: RefObject<View | null>;
  onMapPress: () => void;
  /** Hauteur dispo pour les 3 rangées : les tuiles rétrécissent pour tenir sans scroll */
  availableHeight?: number;
  /** Pendant le voyage : la tuile PLANNING parle d'aujourd'hui (« J6/14 · Kyoto ») */
  today?: { day: string; count: string; badge: string; place: string };
}

const TILE_HEIGHT = 150;      // maquette « V2 · Dashboard »
const TILE_MIN_HEIGHT = 110;  // en dessous, on laisse scroller
const ROW_GAP = Spacing.sm2 - 2;
const ROWS = 3;
const DOC_FLEX = 0.8;
const PLANNING_ICON = 44;

function shortDayMonth(day: string): string {
  const [, m, d] = day.split('-');
  return `${d}/${m}`;
}

export function FutureBento({
  tripId, startDate, destination, stops, region, mapCardRef, onMapPress, availableHeight, today,
}: FutureBentoProps) {
  const tileHeight = availableHeight === undefined
    ? TILE_HEIGHT
    : Math.max(TILE_MIN_HEIGHT, Math.min(TILE_HEIGHT, Math.floor((availableHeight - ROW_GAP * (ROWS - 1)) / ROWS)));
  const { recentDocTitles, docCount, wishCount, toVoteCount, budget, plannedCount } = useFutureDashboard(tripId);
  const moreDocs = docCount - recentDocTitles.length;
  const hasLocatedStops = stops.some(s => s.lat !== null && s.lng !== null);

  return (
    <View style={styles.wrap}>
      {/* Documents + Planning */}
      <View style={styles.row}>
        <GlassCard flex={DOC_FLEX} height={tileHeight} onPress={() => router.push(`/trip/${tripId}/documents`)}>
          <Text style={styles.title}>DOCUMENT</Text>
          {recentDocTitles.length === 0 ? (
            <Text style={styles.docLine}>Aucun document</Text>
          ) : (
            <View style={styles.docList}>
              {recentDocTitles.map((t, i) => <Text key={`${t}-${i}`} style={styles.docLine} numberOfLines={1}>{t}</Text>)}
              {moreDocs > 0 && <Text style={styles.docMore}>+ {plural(moreDocs, 'autre')}</Text>}
            </View>
          )}
        </GlassCard>
        <GlassCard
          flex={1}
          height={tileHeight}
          variant="dark"
          onPress={() => router.push({ pathname: '/trip/[id]/planning', params: today ? { id: tripId, highlightDay: today.day } : { id: tripId } })}
        >
          <View style={styles.titleRow}>
            <Text style={[styles.title, styles.titleOnDark]}>PLANNING</Text>
            <Ionicons name="calendar" size={PLANNING_ICON} color={Colors.white} />
          </View>
          <View style={styles.planningBottom}>
            <Text style={styles.planningCount} numberOfLines={1}>
              {today ? today.count : plannedCount > 0 ? `${plural(plannedCount, 'activité')} au programme` : 'Rien de prévu pour l’instant'}
            </Text>
            <View style={styles.planningRow}>
              <Text style={styles.planningDate}>{today ? today.badge : startDate ? shortDayMonth(startDate) : ''}</Text>
              <Text style={styles.planningInfo} numberOfLines={1}>
                {today ? today.place : stops[0] ? `Départ pour ${stops[0].place_name}` : 'Départ'}
              </Text>
            </View>
          </View>
        </GlassCard>
      </View>

      {/* Carte (moitié) + Vos envies */}
      <View style={styles.row}>
        <View ref={mapCardRef} collapsable={false} style={styles.half}>
          <GlassCard height={tileHeight} noPadding onPress={onMapPress}>
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
                {hasLocatedStops
                  ? <StopMarkers stops={stops} />
                  : <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }} />}
              </MapView>
            )}
            <View style={styles.mapLabel}>
              <Ionicons name="map-outline" size={12} color={Colors.white} />
              <Text style={styles.mapLabelText} numberOfLines={1}>{destination}</Text>
            </View>
            <TouchableOpacity
              style={styles.itineraryBtn}
              onPress={() => router.push(`/trip/${tripId}/itinerary`)}
              activeOpacity={0.85}
              accessibilityLabel="Ouvrir l’itinéraire"
            >
              <Ionicons name="git-commit-outline" size={13} color={Colors.textPrimary} />
              <Text style={styles.itineraryText}>{stops.length > 1 ? `${stops.length} étapes` : 'Itinéraire'}</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
        <GlassCard
          flex={1}
          height={tileHeight}
          variant={wishCount === 0 ? 'accentDashed' : 'light'}
          onPress={() => router.push(`/trip/${tripId}/envies`)}
        >
          <Text style={styles.title}>VOS ENVIES</Text>
          {wishCount === 0 ? (
            <Text style={styles.enviesEmpty}>Espace vide</Text>
          ) : (
            <View>
              <Text style={styles.enviesCount}>{wishCount}</Text>
              <Text style={toVoteCount > 0 ? styles.enviesToVote : styles.enviesSub}>
                {toVoteCount > 0 ? `${toVoteCount} à voter` : 'Tout est voté'}
              </Text>
            </View>
          )}
        </GlassCard>
      </View>

      {/* On t'aide (logements + activités) + Budget */}
      <View style={styles.row}>
        <HelpTile
          height={tileHeight}
          stopCount={stops.length}
          onOpen={tab => router.push({ pathname: '/trip/[id]/help', params: { id: tripId, tab } })}
        />
        <GlassCard flex={1} height={tileHeight} onPress={() => router.push(`/trip/${tripId}/budget`)}>
          {budget.expenseCount === 0 ? (
            <View style={styles.budgetInner}>
              <Text style={styles.title}>BUDGET</Text>
              <View style={styles.addCircle}>
                <Ionicons name="add" size={20} color={Colors.accent} />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.titleRow}>
                <Text style={styles.title}>BUDGET</Text>
                <TouchableOpacity
                  style={styles.addCircleSmall}
                  onPress={() => router.push({ pathname: '/trip/[id]/budget', params: { id: tripId, add: '1' } })}
                  hitSlop={8}
                  accessibilityLabel="Ajouter une dépense"
                >
                  <Ionicons name="add" size={16} color={Colors.accent} />
                </TouchableOpacity>
              </View>
              <View>
                <Text style={styles.budgetTotal} numberOfLines={1} adjustsFontSizeToFit>{formatEuros(budget.total)}</Text>
                <Text
                  style={[styles.budgetBalance, budget.myBalance < 0 && styles.budgetOwe, budget.myBalance > 0 && styles.budgetOwed]}
                  numberOfLines={1}
                >
                  {balanceLabel(budget.myBalance)}
                </Text>
              </View>
            </>
          )}
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: ROW_GAP },
  row: { flexDirection: 'row', gap: ROW_GAP },
  half: { flex: 1, flexBasis: 0 },
  title: { ...Typography.displayLabel, color: Colors.textPrimary },
  titleOnDark: { color: Colors.surfaceAlt },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  docList: { gap: Spacing.xs },
  docLine: { ...Typography.body, color: Colors.textMuted },
  docMore: { ...Typography.bodySmall, fontWeight: '600', color: Colors.accent },
  planningBottom: { gap: Spacing.xs },
  planningCount: { ...Typography.bodySmall, color: Colors.textOnDark },
  planningRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  planningDate: { ...Typography.displayLabel, color: Colors.accent },
  planningInfo: { flex: 1, ...Typography.body, color: Colors.offWhite },
  mapLabel: {
    position: 'absolute', bottom: 10, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.28)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.full,
  },
  mapLabelText: { color: Colors.white, fontSize: 11, fontWeight: '600', maxWidth: 110 },
  itineraryBtn: {
    position: 'absolute', top: Spacing.sm, right: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radii.full, backgroundColor: Colors.surface,
  },
  itineraryText: { fontSize: 11, fontWeight: '700', color: Colors.textPrimary },
  enviesEmpty: { ...Typography.body, color: Colors.accent },
  enviesCount: { ...Typography.displayValue, fontSize: 28, color: Colors.textPrimary },
  enviesToVote: { fontSize: 12, color: Colors.accent, fontWeight: '700' },
  enviesSub: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  budgetInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm2 - 2 },
  budgetTotal: { ...Typography.displayValue, color: Colors.textPrimary },
  budgetBalance: { ...Typography.bodySmall, fontWeight: '600', color: Colors.textMuted },
  budgetOwe: { color: Colors.accent },
  budgetOwed: { color: Colors.positive },
  addCircleSmall: {
    width: 24, height: 24, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  addCircle: {
    width: 32, height: 32, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
});
