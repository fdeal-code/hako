import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Fonts, Spacing, Radii, Shadows, Typography } from '@/constants/theme';
import { NavButton } from '@/components/ui/NavButton';
import { FutureBento } from '@/components/dashboard/FutureBento';
import { PastBento } from '@/components/past/PastBento';
import { NOW_CARD_HEIGHT, NowCard } from '@/components/ongoing/NowCard';
import { useOngoingTrip } from '@/hooks/useOngoingTrip';
import { usePastTrip } from '@/hooks/usePastTrip';
import { useTripStops } from '@/hooks/useTripStops';
import { Region as MapRegion, regionForPoints, stopPoints } from '@/utils/mapRegion';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

/* ─── Constants ──────────────────────────────────────────────── */
const AVATAR_COLORS = ['#E8C5A5', '#A5B8E0', '#A8D5B5', '#F0B0B0'];
const REGION_DELTA = 0.5;
const NAV_BUTTON_SIZE = 64;    // bouton + accent de la barre du bas
/* Dashboard V2 (maquette « V2 · Dashboard ») */
const AVATAR_OVERLAP = -16;
const NAV_WIDTH = 287;

const MONTHS   = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

interface MemberDisplay {
  user_id: string;
  name: string;
  avatar_url?: string;
}
/* ─── Types ──────────────────────────────────────────────────── */

interface TripData {
  id: string;
  name: string;
  destination: string;
  cover_image_url: string | null;
  start_date: string;
  end_date: string;
  owner_id: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
}

type TripStatus = 'future' | 'ongoing' | 'past';

/* ─── Helpers ─────────────────────────────────────────────────── */
function formatDateBadge(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end   + 'T00:00:00');
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${MONTHS[s.getMonth()]} – ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
}

function getDayBadge(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end   + 'T00:00:00');
  const now = new Date();
  const current = Math.floor((now.getTime() - s.getTime()) / 86_400_000) + 1;
  const total   = Math.floor((e.getTime() - s.getTime()) / 86_400_000) + 1;
  return `Jour ${current}/${total}`;
}


function formatPastDates(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end   + 'T00:00:00');
  const year = e.getFullYear();
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()} → ${e.getDate()} ${MONTHS[e.getMonth()]} ${year}`;
  }
  return `${s.getDate()} ${MONTHS[s.getMonth()]} → ${e.getDate()} ${MONTHS[e.getMonth()]} ${year}`;
}




/* ─── Main screen ─────────────────────────────────────────────── */
export default function DashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();
  const { session } = useAuth();

  const mapCardRef = useRef<View>(null);
  /* Tuiles « à venir » : hauteur ajustée pour tenir au-dessus de la barre du bas */
  const [sheetHeight, setSheetHeight] = useState(0);
  const navReserve = Math.max(insets.bottom, 10) + Spacing.md + NAV_BUTTON_SIZE + Spacing.md;

  /* Trip & members */
  const [trip,    setTrip]    = useState<TripData | null>(null);
  const [members, setMembers] = useState<MemberDisplay[]>([]);
  const [isOwner, setIsOwner] = useState(false);

  /* Sheets */

  /* Future dashboard data */
  /* Région de la carte : coordonnées stockées (Trip Match), sinon géocodage
     de la destination ; null si tout échoue → état vide (pas de Paris) */
  const [region, setRegion] = useState<MapRegion | null>(null);

  /* Étapes du voyage : la carte cadre tout l'itinéraire dès qu'une étape est géolocalisée */
  const { stops } = useTripStops(id);
  const stopsRegion = useMemo(() => regionForPoints(stopPoints(stops)), [stops]);
  const futureMapRegion: MapRegion | null = stopsRegion ?? region;


  /* Ongoing dashboard data */

  /* ── Trip status ── */
  const tripStatus = useMemo<TripStatus>(() => {
    if (!trip) return 'future';
    const now       = new Date();
    const startDate = new Date(trip.start_date + 'T00:00:00');
    const endDate   = new Date(trip.end_date   + 'T23:59:59');

    console.log('=== TRIP STATUS DEBUG ===');
    console.log('NOW:        ', now.toISOString());
    console.log('START:      ', startDate.toISOString());
    console.log('END:        ', endDate.toISOString());
    console.log('start_date raw:', trip.start_date);
    console.log('end_date raw:  ', trip.end_date);
    console.log('NOW >= START:', now >= startDate);
    console.log('NOW <= END:  ', now <= endDate);

    let status: TripStatus = 'future';
    if (now >= startDate && now <= endDate) status = 'ongoing';
    else if (now > endDate) status = 'past';

    console.log('TRIP STATUS:', status);
    return status;
  }, [trip]);

  /* Après le voyage : album, avis, récap (partagé avec la barre du bas) */
  const past = usePastTrip(tripStatus === 'past' ? id : undefined);
  /* Pendant le voyage : programme du jour, billet, dépenses, photos */
  const ongoing = useOngoingTrip(tripStatus === 'ongoing' ? id : undefined, trip?.start_date ?? '', trip?.end_date ?? '');

  /* ── Fetch base data ── */
  useEffect(() => {
    if (!id) return;

    supabase
      .from('trips')
      .select('id, name, destination, cover_image_url, start_date, end_date, owner_id, destination_lat, destination_lng')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          setTrip(data);
          setIsOwner(data.owner_id === session?.user?.id);
          if (data.destination_lat != null && data.destination_lng != null) {
            // Coordonnées stockées à la création (Trip Match) — pas de géocodage
            setRegion({
              latitude: data.destination_lat, longitude: data.destination_lng,
              latitudeDelta: REGION_DELTA, longitudeDelta: REGION_DELTA,
            });
            return;
          }
          const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
          if (key && data.destination) {
            fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(data.destination)}&key=${key}`)
              .then(r => r.json())
              .then(json => {
                if (json.status === 'OK' && json.results?.[0]) {
                  const { lat, lng } = json.results[0].geometry.location;
                  setRegion({ latitude: lat, longitude: lng, latitudeDelta: REGION_DELTA, longitudeDelta: REGION_DELTA });
                }
              })
              .catch(() => {});
          }
        }
      });

    supabase
      .from('trip_members')
      .select('user_id, role, profile:profiles(nickname, avatar_url)')
      .eq('trip_id', id)
      .then(({ data }) => {
        setMembers((data ?? []).map((m: any) => ({
          user_id:    m.user_id,
          name:       m.profile?.nickname ?? 'Membre',
          avatar_url: m.profile?.avatar_url ?? undefined,
        })));
      });

  }, [id, session?.user?.id]);


  /* Mini-carte « en cours » : cadrée sur l'étape du jour */
  const ongoingRegion = useMemo(
    () => (ongoing.stop && ongoing.stop.lat !== null && ongoing.stop.lng !== null
      ? { latitude: ongoing.stop.lat, longitude: ongoing.stop.lng, latitudeDelta: 0.25, longitudeDelta: 0.25 }
      : null),
    [ongoing.stop],
  );

  /* La carte plein écran (app/trip/[id]/map.tsx) remplace l'ancienne ExpandedMapView */
  const handleMapPress = useCallback(() => {
    router.push({ pathname: '/trip/[id]/map', params: { id: id ?? '' } });
  }, [id]);

  const badgeText = trip
    ? (tripStatus === 'ongoing' ? getDayBadge(trip.start_date, trip.end_date)
      : tripStatus === 'past'   ? 'Terminé ✈️'
      : formatDateBadge(trip.start_date, trip.end_date))
    : '';
  const pastDateRange = trip ? formatPastDates(trip.start_date, trip.end_date) : '';

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ animation: 'fade', headerShown: false }} />

      {/* ── Background photo ── */}
      {trip?.cover_image_url ? (
        <Image source={{ uri: trip.cover_image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0D1B2A' }]} />
      )}
      <View style={styles.bgDim} />

      <View style={[styles.fg, { paddingTop: insets.top }]}>

        {/* ── HEADER (shared) ── */}
        <Animated.View entering={FadeIn.duration(350).delay(180)} style={styles.header}>
          <Text
            style={[styles.destText, tripStatus === 'past' && styles.destTextPast]}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {tripStatus === 'past' ? (trip?.name ?? '') : (trip?.destination?.toUpperCase() ?? '')}
          </Text>
          {tripStatus === 'past' && trip && (
            <Text style={styles.pastDateLine}>{pastDateRange}</Text>
          )}

          <View style={styles.headerMeta}>
            <View style={styles.dateBadge}>
              {tripStatus === 'ongoing' && <View style={styles.liveDot} />}
              <Text style={styles.dateBadgeText}>{badgeText}</Text>
            </View>

            <View style={styles.avatarsRow}>
              {members.slice(0, 3).map((m, i) => (
                <View
                  key={m.user_id}
                  style={[styles.avatar, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length], marginLeft: i > 0 ? AVATAR_OVERLAP : 0, zIndex: 10 - i }]}
                >
                  {m.avatar_url
                    ? <Image source={{ uri: m.avatar_url }} style={styles.avatarImg} />
                    : <Text style={styles.avatarInitial}>{m.name[0]?.toUpperCase() ?? '?'}</Text>
                  }
                </View>
              ))}
              {isOwner && (
                <TouchableOpacity style={styles.addMemberBtn} activeOpacity={0.8} onPress={() => router.push({ pathname: '/trip/[id]/invite', params: { id: id ?? '' } })}>
                  <Ionicons name="add" size={22} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>

        {/* ── BODY ── */}
        <Animated.View entering={FadeInUp.duration(500).delay(300)} style={{ flex: 1 }}>

          {/* ─── FUTURE dashboard ─── */}
          {tripStatus === 'future' && (
            <ScrollView
              style={styles.sheet}
              showsVerticalScrollIndicator={false}
              onLayout={e => setSheetHeight(e.nativeEvent.layout.height)}
              contentContainerStyle={[styles.scroll, { paddingBottom: navReserve }]}
            >
              <FutureBento
                availableHeight={sheetHeight > 0 ? sheetHeight - styles.scroll.paddingTop - navReserve : undefined}
                tripId={id ?? ''}
                startDate={trip?.start_date ?? ''}
                destination={trip?.destination ?? ''}
                stops={stops}
                region={futureMapRegion}
                mapCardRef={mapCardRef}
                onMapPress={handleMapPress}
              />
            </ScrollView>
          )}

          {/* ─── PAST dashboard (tuiles partagées avec ExpandedDashboard) ─── */}
          {tripStatus === 'past' && (
            <ScrollView
              style={styles.sheet}
              showsVerticalScrollIndicator={false}
              onLayout={e => setSheetHeight(e.nativeEvent.layout.height)}
              contentContainerStyle={[styles.scroll, { paddingBottom: navReserve }]}
            >
              <PastBento
                past={past}
                availableHeight={sheetHeight > 0 ? sheetHeight - styles.scroll.paddingTop - navReserve : undefined}
                tripId={id ?? ''}
                stops={stops}
                region={futureMapRegion}
                mapCardRef={mapCardRef}
                onMapPress={handleMapPress}
              />
            </ScrollView>
          )}

          {/* ─── ONGOING dashboard : carte « en ce moment » + tuiles habituelles ─── */}
          {tripStatus === 'ongoing' && (
            <ScrollView
              style={styles.sheet}
              showsVerticalScrollIndicator={false}
              onLayout={e => setSheetHeight(e.nativeEvent.layout.height)}
              contentContainerStyle={[styles.scroll, { paddingBottom: navReserve }]}
            >
              <NowCard tripId={id ?? ''} ongoing={ongoing} />
              <FutureBento
                availableHeight={sheetHeight > 0 ? sheetHeight - styles.scroll.paddingTop - navReserve - NOW_CARD_HEIGHT - styles.scroll.gap : undefined}
                tripId={id ?? ''}
                startDate={trip?.start_date ?? ''}
                destination={trip?.destination ?? ''}
                stops={stops}
                region={ongoingRegion ?? futureMapRegion}
                mapCardRef={mapCardRef}
                onMapPress={handleMapPress}
                today={{
                  day: ongoing.today,
                  count: ongoing.schedule.left > 0 ? `encore ${ongoing.schedule.left} au programme` : 'fini pour aujourd’hui',
                  badge: `J${ongoing.day.day}/${ongoing.day.total}`,
                  place: ongoing.stop?.place_name ?? '',
                }}
              />
            </ScrollView>
          )}

        </Animated.View>
      </View>

      {/* ── BOTTOM NAV ── */}
      <View
        style={[styles.bottomNav, { bottom: Math.max(insets.bottom, 10) + 16 }]}
        pointerEvents="box-none"
      >
        <View style={styles.bottomNavInner} pointerEvents="box-none">
          <NavButton icon="arrow-back-outline" onPress={() => router.back()} />
          <View style={styles.bottomNavRight}>
            {tripStatus === 'past'
              ? <NavButton icon="share-social-outline" iconSize={24} variant="accent" onPress={past.share} />
              : <NavButton icon="add" iconSize={28} variant="accent" onPress={() => router.push({ pathname: '/trip/[id]/add', params: { id: id ?? '' } })} />
            }
            <NavButton icon="settings-outline" onPress={() => router.push({ pathname: '/trip/[id]/settings', params: { id: id ?? '' } })} />
          </View>
        </View>
      </View>




    </View>
  );
}


/* ─── Main styles ────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#0D1B2A' },
  bgDim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,15,30,0.25)' },
  fg:    { flex: 1 },

  header: {
    paddingHorizontal: Spacing.md2,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  destText: {
    fontFamily: Fonts.displayBold, fontSize: 56,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 64,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },
  headerMeta: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: Spacing.sm,
  },
  dateBadge: {
    height: 40, borderRadius: Radii.pill,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.background,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    ...Shadows.md,
  },
  liveDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  dateBadgeText: {
    color: Colors.textPrimary, ...Typography.filter,
  },
  avatarsRow:    { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: '#fff',
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  avatarImg:     { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  addMemberBtn: {
    width: 40, height: 40, borderRadius: Radii.full,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: AVATAR_OVERLAP, zIndex: 20,
    ...Shadows.lg,
  },

  sheet: {
    backgroundColor: Colors.surfaceAlt,
    borderTopLeftRadius: Radii.sheet,
    borderTopRightRadius: Radii.sheet,
  },
  scroll: {
    paddingHorizontal: Spacing.md2, paddingTop: Spacing.lg, gap: Spacing.sm2 - 2,
  },
  row: { flexDirection: 'row', gap: Spacing.sm2 - 2 },

  cardTitle:       { ...Typography.displayLabel, color: Colors.textPrimary },
  cardTitleOnDark: { color: Colors.surfaceAlt },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  docList:      { gap: Spacing.xs },
  docLine:      { ...Typography.body, color: Colors.textMuted },
  planningRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  planningDate: { ...Typography.displayLabel, color: Colors.accent },
  budgetInner:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm2 - 2 },
  planningInfo: { flex: 1, ...Typography.body, color: Colors.offWhite },
  enviesEmpty:  { ...Typography.body, color: Colors.accent },
  enviesCount:  { ...Typography.displayValue, fontSize: 28, color: Colors.textPrimary },
  enviesToVote: { fontSize: 12, color: Colors.accent, fontWeight: '700' },
  enviesSub:    { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  halfCell:     { flex: 1, flexBasis: 0 },
  itineraryBtn: {
    position: 'absolute', top: Spacing.sm, right: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: Radii.full, backgroundColor: Colors.surface,
  },
  itineraryTxt: { fontSize: 11, fontWeight: '700', color: Colors.textPrimary },
  mapLabelWrap: {
    position: 'absolute', bottom: 10, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.full,
  },
  mapLabel:  { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  addCircle: {
    width: 32, height: 32, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  bottomNav: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center',
  },
  bottomNavInner: {
    width: NAV_WIDTH,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  bottomNavRight: { flexDirection: 'row', gap: Spacing.sm },
  destTextPast: { fontSize: 38, lineHeight: 44 },
  pastDateLine: {
    fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.75)',
    marginTop: 4, marginBottom: 4,
  },
});
