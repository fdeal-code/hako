// HAKO — Tuiles du dashboard « après le voyage » (même grille que FutureBento)
// RÉCAP + PHOTOS · Carte du parcours (pleine largeur) · AVIS + BILAN.
// Le partage du récap est dans la barre du bas du dashboard.
// Source unique : utilisé par app/trip/[id]/dashboard.tsx ET par
// components/home/ExpandedDashboard.tsx (ouverture depuis l'accueil).

import { RefObject } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { MapEmptyState } from '@/components/map/MapEmptyState';
import { StopMarkers } from '@/components/map/StopMarkers';
import { StarRating } from '@/components/past/StarRating';
import { PastTripState } from '@/hooks/usePastTrip';
import { TripStop } from '@/types/tripStops';
import { balanceLabel, formatEuros, plural } from '@/utils/dashboardSummary';
import { Region } from '@/utils/mapRegion';

interface PastBentoProps {
  tripId: string;
  /** Données de l'après-voyage, chargées par le dashboard (partagées avec sa barre du bas) */
  past: PastTripState;
  stops: readonly TripStop[];
  region: Region | null;
  mapCardRef: RefObject<View | null>;
  onMapPress: () => void;
  availableHeight?: number;
}

const TILE_HEIGHT = 150;
const TILE_MIN_HEIGHT = 120;
const ROW_GAP = Spacing.sm2 - 2;
const ROWS = 3;
const BIG_ICON = 40;
const PLUS_SIZE = 32;

export function PastBento({ tripId, past: p, stops, region, mapCardRef, onMapPress, availableHeight }: PastBentoProps) {
  const tileHeight = availableHeight === undefined
    ? TILE_HEIGHT
    : Math.max(TILE_MIN_HEIGHT, Math.min(TILE_HEIGHT, Math.floor((availableHeight - ROW_GAP * (ROWS - 1)) / ROWS)));
  const cover = p.data?.photos[0]?.photoUrl ?? null;
  const photoCount = p.data?.photos.length ?? 0;
  const hasLocatedStops = stops.some(s => s.lat !== null && s.lng !== null);

  const importPhotos = () => { void p.importPhotos().then(error => { if (error) Alert.alert('Oups', error); }); };

  return (
    <View style={styles.wrap}>
      {/* Récap + Photos */}
      <View style={styles.row}>
        <GlassCard flex={1} height={tileHeight} variant="dark" onPress={() => router.push({ pathname: '/trip/[id]/recap', params: { id: tripId } })}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, styles.onDark]}>RÉCAP</Text>
            <Ionicons name="trophy" size={BIG_ICON} color={Colors.white} />
          </View>
          {p.stats ? (
            <View style={styles.bottom}>
              <Text style={styles.subOnDark} numberOfLines={1}>
                {plural(p.stats.days, 'jour')} · {plural(p.stats.cities, 'ville')}
              </Text>
              <Text style={styles.lineOnDark} numberOfLines={1}>
                {plural(p.stats.places, 'lieu', 'lieux')} · {plural(p.stats.photos, 'photo')}
              </Text>
            </View>
          ) : <ActivityIndicator color={Colors.white} />}
        </GlassCard>

        {photoCount === 0 ? (
          <GlassCard flex={1} height={tileHeight} variant="accentDashed" onPress={() => router.push({ pathname: '/trip/[id]/past-photos', params: { id: tripId } })}>
            <Text style={styles.title}>PHOTOS</Text>
            <View style={styles.photoBottom}>
              <Text style={styles.empty}>Importer vos photos</Text>
              <TouchableOpacity style={styles.plusAccent} onPress={importPhotos} disabled={p.uploading} accessibilityLabel="Importer des photos">
                {p.uploading ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="add" size={20} color={Colors.white} />}
              </TouchableOpacity>
            </View>
          </GlassCard>
        ) : (
          <GlassCard flex={1} height={tileHeight} noPadding onPress={() => router.push({ pathname: '/trip/[id]/past-photos', params: { id: tripId } })}>
            {cover && <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
            <LinearGradient colors={[Colors.scrimClear, Colors.scrimStrong]} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.photoInner}>
              <Text style={[styles.title, styles.onDark]}>PHOTOS</Text>
              <View style={styles.photoBottom}>
                <Text style={styles.photoCount}>{photoCount}</Text>
                <TouchableOpacity style={styles.plusLight} onPress={importPhotos} disabled={p.uploading} accessibilityLabel="Ajouter des photos">
                  {p.uploading ? <ActivityIndicator size="small" color={Colors.textPrimary} /> : <Ionicons name="add" size={20} color={Colors.textPrimary} />}
                </TouchableOpacity>
              </View>
            </View>
          </GlassCard>
        )}
      </View>

      {/* Carte du parcours (pleine largeur) */}
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
              <Ionicons name="footsteps-outline" size={12} color={Colors.white} />
              <Text style={styles.mapLabelText}>Notre parcours</Text>
            </View>
          </GlassCard>
        </View>
      </View>

      {/* Avis + Bilan */}
      <View style={styles.row}>
        <GlassCard
          flex={1}
          height={tileHeight}
          variant={p.toRateCount > 0 ? 'accent' : 'light'}
          onPress={() => router.push({ pathname: '/trip/[id]/past-avis', params: { id: tripId } })}
        >
          <Text style={[styles.title, p.toRateCount > 0 && styles.onDark]}>AVIS</Text>
          {p.toRateCount > 0 ? (
            <View>
              <Text style={styles.bigOnAccent}>{p.toRateCount}</Text>
              <Text style={styles.lineOnDark}>{p.toRateCount > 1 ? 'lieux à noter' : 'lieu à noter'}</Text>
            </View>
          ) : p.groupAverage !== null ? (
            <View style={styles.bottom}>
              <Text style={styles.big}>{p.groupAverage.toFixed(1).replace('.', ',')}</Text>
              <StarRating value={p.groupAverage} size={14} />
            </View>
          ) : (
            <Text style={styles.muted}>Rien à noter</Text>
          )}
        </GlassCard>
        <GlassCard flex={1} height={tileHeight} onPress={() => router.push({ pathname: '/trip/[id]/budget', params: { id: tripId } })}>
          <Text style={styles.title}>BILAN</Text>
          {p.budget.expenseCount > 0 ? (
            <View>
              <Text style={styles.big} numberOfLines={1} adjustsFontSizeToFit>{formatEuros(p.budget.total)}</Text>
              <Text
                style={[styles.balance, p.budget.myBalance < 0 && styles.owe, p.budget.myBalance > 0 && styles.owed]}
                numberOfLines={1}
              >
                {balanceLabel(p.budget.myBalance)}
              </Text>
            </View>
          ) : (
            <Text style={styles.muted}>Aucune dépense</Text>
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
  onDark: { color: Colors.white },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm },
  bottom: { gap: Spacing.xs },
  subOnDark: { ...Typography.bodySmall, color: Colors.textOnDark },
  lineOnDark: { ...Typography.body, color: Colors.white },
  empty: { flex: 1, ...Typography.body, color: Colors.accent },
  muted: { ...Typography.body, color: Colors.textMuted },
  big: { ...Typography.displayValue, color: Colors.textPrimary },
  bigOnAccent: { ...Typography.displayValue, fontSize: 32, color: Colors.white },
  balance: { ...Typography.bodySmall, fontWeight: '600', color: Colors.textMuted },
  owe: { color: Colors.accent },
  owed: { color: Colors.positive },
  photoInner: { flex: 1, padding: Spacing.md2, justifyContent: 'space-between' },
  photoBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.sm },
  photoCount: { ...Typography.displayValue, fontSize: 32, color: Colors.white },
  plusAccent: {
    width: PLUS_SIZE, height: PLUS_SIZE, borderRadius: Radii.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent,
  },
  plusLight: {
    width: PLUS_SIZE, height: PLUS_SIZE, borderRadius: Radii.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background,
  },
  mapLabel: {
    position: 'absolute', bottom: 10, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.overlay, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radii.full,
  },
  mapLabelText: { color: Colors.white, fontSize: 11, fontWeight: '600' },
});
