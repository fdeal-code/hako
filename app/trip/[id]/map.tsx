// HAKO — Carte du voyage, plein écran (maquette « Carte » 723:2932)
// Une seule carte, ouverte depuis la tuile carte des dashboards.
// • « Tout le voyage » : trajet numéroté, icône du transport entre deux villes,
//   cartes des trajets en bas — un tap ouvre directement le billet (ou
//   propose de l'ajouter).
// • Une ville : zoom sur la ville, lieux du groupe (une couleur par type),
//   cartes des lieux avec « Y aller ».
// Pendant le voyage, la ville du jour est sélectionnée d'emblée.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radii, Spacing, Typography } from '@/constants/theme';
import { NavButton } from '@/components/ui/NavButton';
import { StopMarkers } from '@/components/map/StopMarkers';
import { CARD_WIDTH_RATIO, CityChip, LegCard, LegPin, PlaceCard, PlacePin } from '@/components/map/TripMapParts';
import { useTripMap } from '@/hooks/useTripMap';
import { MapLeg, MapPlace } from '@/types/tripMap';
import { directionsUrl } from '@/utils/ongoingTrip';
import { localDayIso } from '@/utils/tripStops';
import { formatStopRange } from '@/utils/wishLinks';

const TOP_AREA = 150;          // titre + pastilles
const BOTTOM_AREA = 220;       // cartes + barre d'actions
const CARD_GAP = Spacing.sm2;
const ROUTE_WIDTH = 2.5;
const ROUTE_DASH = [8, 6];
const ANIMATION_MS = 450;
const OS: 'ios' | 'android' | 'other' = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other';

export default function TripMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = id ?? '';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const m = useTripMap(tripId);
  const mapRef = useRef<MapView>(null);
  const listRef = useRef<ScrollView>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const today = localDayIso(new Date());
  const cardWidth = Math.round(width * CARD_WIDTH_RATIO);

  // Recadre la carte quand on change de ville
  useEffect(() => {
    if (m.region) mapRef.current?.animateToRegion(m.region, ANIMATION_MS);
  }, [m.region]);

  const located = useMemo(() => m.stops.filter(s => s.lat !== null && s.lng !== null), [m.stops]);
  const stopById = useMemo(() => new Map(m.stops.map(s => [s.id, s])), [m.stops]);

  /** Repère d'un trajet : au milieu des deux villes. */
  const legPoint = (leg: MapLeg) => {
    const a = leg.fromStopId ? stopById.get(leg.fromStopId) : undefined;
    const b = leg.toStopId ? stopById.get(leg.toStopId) : undefined;
    if (!a || !b || a.lat === null || a.lng === null || b.lat === null || b.lng === null) return null;
    return { latitude: (a.lat + b.lat) / 2, longitude: (a.lng + b.lng) / 2 };
  };

  const openLeg = (leg: MapLeg) => {
    if (leg.ticket) router.push({ pathname: '/trip/[id]/document/[docId]', params: { id: tripId, docId: leg.ticket.id } });
    else router.push({ pathname: '/trip/[id]/document/new', params: { id: tripId } });
  };

  const focusPlace = (place: MapPlace, index: number) => {
    setSelectedPlaceId(place.id);
    mapRef.current?.animateToRegion({ latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 }, ANIMATION_MS);
    listRef.current?.scrollTo({ x: index * (cardWidth + CARD_GAP), animated: true });
  };

  const goTo = (place: MapPlace) => {
    const url = directionsUrl({ label: place.title, address: place.address, latitude: place.latitude, longitude: place.longitude }, OS);
    if (url) void Linking.openURL(url);
  };

  const recenter = () => { if (m.region) mapRef.current?.animateToRegion(m.region, ANIMATION_MS); };
  const selectCity = (stopId: string | null) => { setSelectedPlaceId(null); m.selectStop(stopId); listRef.current?.scrollTo({ x: 0, animated: false }); };

  const subtitle = m.selectedStop
    ? `${formatStopRange(m.selectedStop.start_date, m.selectedStop.end_date)} · ${m.places.length} lieu${m.places.length > 1 ? 'x' : ''}`
    : `${located.length} étape${located.length > 1 ? 's' : ''} · ${m.legs.length} trajet${m.legs.length > 1 ? 's' : ''}`;

  return (
    <View style={styles.root}>
      {m.region ? (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={m.region}
          mapPadding={{ top: insets.top + TOP_AREA, bottom: insets.bottom + BOTTOM_AREA, left: 0, right: 0 }}
          showsUserLocation
          showsPointsOfInterests={false}
          onPress={() => setSelectedPlaceId(null)}
        >
          {/* Trajet + étapes numérotées */}
          <StopMarkers stops={m.stops} showLabels onStopPress={stop => selectCity(stop.id)} />

          {/* Transport entre deux villes (vue « Tout le voyage ») */}
          {!m.selectedStop && m.legs.map(leg => {
            const point = legPoint(leg);
            if (!point) return null;
            return (
              <Marker key={leg.key} coordinate={point} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} onPress={() => openLeg(leg)}>
                <LegPin leg={leg} todo={!leg.ticket && (leg.date ?? '') >= today} />
              </Marker>
            );
          })}

          {/* Lieux de la ville choisie */}
          {m.selectedStop && m.places.map((place, index) => (
            <Marker
              key={place.id}
              coordinate={{ latitude: place.latitude, longitude: place.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={selectedPlaceId === place.id}
              onPress={() => focusPlace(place, index)}
            >
              <PlacePin place={place} selected={selectedPlaceId === place.id} />
            </Marker>
          ))}

          {/* Lien discret entre le logement et le lieu sélectionné */}
          {(() => {
            const sel = m.places.find(p => p.id === selectedPlaceId);
            const home = m.places.find(p => p.booked);
            return sel && home && sel.id !== home.id ? (
              <Polyline
                coordinates={[{ latitude: home.latitude, longitude: home.longitude }, { latitude: sel.latitude, longitude: sel.longitude }]}
                strokeColor={Colors.accent}
                strokeWidth={ROUTE_WIDTH}
                lineDashPattern={ROUTE_DASH}
              />
            ) : null;
          })()}
        </MapView>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          {m.loaded ? <Text style={styles.muted}>Ajoute des étapes pour voir la carte.</Text> : <ActivityIndicator color={Colors.primary} />}
        </View>
      )}

      {/* ── Haut : titre + villes ── */}
      <LinearGradient
        colors={[Colors.background, Colors.background, Colors.scrimClear]}
        locations={[0, 0.7, 1]}
        style={[styles.top, { paddingTop: insets.top + Spacing.sm }]}
        pointerEvents="box-none"
      >
        <Text style={styles.title}>{m.selectedStop ? m.selectedStop.place_name : 'Carte'}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <CityChip label="Tout le voyage" active={!m.selectedStop} onPress={() => selectCity(null)} />
          {m.stops.map(stop => (
            <CityChip
              key={stop.id}
              label={`${stop.position + 1} · ${stop.place_name}`}
              active={m.selectedStopId === stop.id}
              today={m.todayStop?.id === stop.id}
              onPress={() => selectCity(stop.id)}
            />
          ))}
        </ScrollView>
      </LinearGradient>

      {/* ── Bas : trajets ou lieux, puis actions ── */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, Spacing.sm) + Spacing.sm }]} pointerEvents="box-none">
        <ScrollView
          ref={listRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + CARD_GAP}
          decelerationRate="fast"
          contentContainerStyle={styles.cards}
        >
          {!m.selectedStop
            ? m.legs.map(leg => (
              <LegCard key={leg.key} leg={leg} width={cardWidth} isPast={(leg.date ?? '') < today} onPress={() => openLeg(leg)} />
            ))
            : m.places.length === 0
              ? <Text style={[styles.muted, styles.emptyCity]}>Aucun lieu géolocalisé dans cette ville pour l’instant.</Text>
              : m.places.map((place, index) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  width={cardWidth}
                  selected={selectedPlaceId === place.id}
                  onPress={() => focusPlace(place, index)}
                  onGo={() => goTo(place)}
                />
              ))}
        </ScrollView>

        <View style={styles.nav}>
          <NavButton icon="arrow-back-outline" onPress={() => router.back()} />
          <NavButton
            icon="add"
            iconSize={28}
            variant="accent"
            onPress={() => router.push({ pathname: '/trip/[id]/wish/new', params: { id: tripId, mode: 'place' } })}
          />
          <NavButton icon="scan-outline" onPress={recenter} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingBottom: Spacing.lg, gap: 2 },
  title: { paddingHorizontal: Spacing.md2, fontFamily: Fonts.display, fontSize: 32, color: Colors.textPrimary },
  subtitle: { paddingHorizontal: Spacing.md2, ...Typography.body, color: Colors.textMuted },
  chips: { gap: Spacing.sm, paddingHorizontal: Spacing.md2, paddingTop: Spacing.sm2 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: Spacing.md },
  cards: { gap: CARD_GAP, paddingHorizontal: Spacing.md2 },
  nav: { flexDirection: 'row', justifyContent: 'center', gap: 14 },
  muted: { ...Typography.body, color: Colors.textMuted },
  emptyCity: { padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radii.sm },
});
