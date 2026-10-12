import { FutureBento } from '@/components/dashboard/FutureBento';
import { PastBento } from '@/components/past/PastBento';
import { NOW_CARD_HEIGHT, NowCard } from '@/components/ongoing/NowCard';
import { useOngoingTrip } from '@/hooks/useOngoingTrip';
import { usePastTrip } from '@/hooks/usePastTrip';
import { useTripStops } from '@/hooks/useTripStops';
import { Region as MapRegion, regionForPoints, stopPoints } from '@/utils/mapRegion';
import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  useWindowDimensions,
  PanResponder,
} from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Colors, Fonts, Radii, Spacing } from '@/constants/theme';
import { BACK_ICON, NavButton, floatingNavBottom, floatingNavSpace } from '@/components/ui/NavButton';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { Trip } from '@/constants/types';
import { useHomeExpand } from '@/contexts/HomeExpandContext';
import { supabase } from '@/services/supabase';

/* ─── Constants ──────────────────────────────────────────────── */
const REGION_DELTA = 0.5;

/* Hero V2 : bandeau photo en haut, crème dessous. Ratio réduit pour que le
   cover se cale sur la LARGEUR des photos paysage (pas de crop latéral). */
const HERO_PHOTO_RATIO = 0.26; // bandeau compact : laisse la place aux tuiles (dont la carte « en ce moment »)
/* Swipe-down : seuils de fermeture et amplitude du drag interactif */
const HERO_TITLE_SIZE = 56;
const HEADER_AVATAR = 32;
const MAX_HEADER_AVATARS = 4;
const DRAG_DISMISS_DY = 120;
const DRAG_DISMISS_VELOCITY = 0.9;
const DRAG_RANGE = 420;
const DRAG_MIN_PROGRESS = 0.25;

/* ─── Types ──────────────────────────────────────────────────── */
type TripStatus = 'future' | 'ongoing' | 'past';

/* ─── Catégories ─────────────────────────────────────────────── */

/* ─── Helpers ongoing ─────────────────────────────────────────── */
const MONTHS_OG = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

function getDayBadge(start: string, end: string): string {
  const s   = new Date(start + 'T00:00:00');
  const e   = new Date(end   + 'T00:00:00');
  const now = new Date();
  const cur   = Math.floor((now.getTime() - s.getTime()) / 86_400_000) + 1;
  const total = Math.floor((e.getTime() - s.getTime()) / 86_400_000) + 1;
  return `Jour ${cur}/${total}`;
}

function formatPastDates(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end   + 'T00:00:00');
  const year = e.getFullYear();
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()} → ${e.getDate()} ${MONTHS_OG[e.getMonth()]} ${year}`;
  }
  return `${s.getDate()} ${MONTHS_OG[s.getMonth()]} → ${e.getDate()} ${MONTHS_OG[e.getMonth()]} ${year}`;
}

function formatDateLabel(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const M = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${M[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${M[s.getMonth()]} – ${M[e.getMonth()]} ${e.getFullYear()}`;
}

/* ─── ExpandedDashboard ──────────────────────────────────────── */
export interface CardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  trip: Trip;
  cardLayout: CardLayout;
  progress: SharedValue<number>;
}

export function ExpandedDashboard({ trip, cardLayout, progress }: Props) {
  /* ── Statut du voyage ── */
  const tripStatus: TripStatus = (() => {
    const n     = new Date();
    const start = new Date(trip.start_date + 'T00:00:00');
    const end   = new Date(trip.end_date   + 'T23:59:59');
    if (n >= start && n <= end) return 'ongoing';
    if (n > end)                return 'past';
    return 'future';
  })();

  /* Après le voyage : album, avis, récap (partagé avec la barre du bas) */
  const past = usePastTrip(tripStatus === 'past' ? trip.id : undefined);
  /* Pendant le voyage : programme du jour, billet, dépenses, photos */
  const ongoing = useOngoingTrip(tripStatus === 'ongoing' ? trip.id : undefined, trip.start_date, trip.end_date);

  /* ── État ongoing ── */

  const insets = useSafeAreaInsets();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();

  const mapCardRef = useRef<View>(null);
  /* Étapes du voyage : carte cadrée sur tout l'itinéraire */
  const { stops } = useTripStops(trip.id);
  const stopsRegion = useMemo(() => regionForPoints(stopPoints(stops)), [stops]);
  /* Tuiles « à venir » : hauteur ajustée pour tenir entre le haut de la
     feuille et la barre du bas, sans scroll */
  const [sheetHeight, setSheetHeight] = useState(0);
  const navReserve = floatingNavSpace(insets.bottom);
  const [members,      setMembers]      = useState<any[]>([]);

  /* ── Région de la carte : coordonnées stockées (Trip Match), sinon
     géocodage de la destination ; null si tout échoue → état vide ── */
  const [region, setRegion] = useState<MapRegion | null>(null);

  useEffect(() => {
    if (trip.destination_lat != null && trip.destination_lng != null) {
      setRegion({
        latitude: trip.destination_lat, longitude: trip.destination_lng,
        latitudeDelta: REGION_DELTA, longitudeDelta: REGION_DELTA,
      });
      return;
    }
    const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
    if (!key || !trip.destination) return;
    fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trip.destination)}&key=${key}`)
      .then(r => r.json())
      .then(json => {
        if (json.status === 'OK' && json.results.length > 0) {
          const { lat, lng } = json.results[0].geometry.location;
          setRegion({ latitude: lat, longitude: lng, latitudeDelta: REGION_DELTA, longitudeDelta: REGION_DELTA });
        }
      })
      .catch(() => {});
  }, [trip.destination, trip.destination_lat, trip.destination_lng]);


  /* ── Fetch real members via profiles table ── */
  useEffect(() => {
    if (!trip.id) return;
    const loadMembers = async () => {
      const { data: membersList } = await supabase
        .from('trip_members')
        .select('user_id')
        .eq('trip_id', trip.id);

      if (membersList) {
        const profiles: any[] = [];
        for (const m of membersList) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', m.user_id)
            .single();
          console.log('PROFILE LOADED:', JSON.stringify(data));
          if (data) profiles.push(data);
        }
        setMembers(profiles);
      }
    };
    loadMembers();
  }, [trip.id]);


  const { triggerCollapse } = useHomeExpand();
  const handleBack = useCallback(() => {
    triggerCollapse.current?.();
  }, [triggerCollapse]);

  /* Mini-carte « en cours » : cadrée sur l'étape du jour */
  const ongoingRegion = useMemo(
    () => (ongoing.stop && ongoing.stop.lat !== null && ongoing.stop.lng !== null
      ? { latitude: ongoing.stop.lat, longitude: ongoing.stop.lng, latitudeDelta: 0.25, longitudeDelta: 0.25 }
      : null),
    [ongoing.stop],
  );

  /* La carte plein écran (app/trip/[id]/map.tsx) remplace l'ancienne ExpandedMapView */
  const handleMapPress = useCallback(() => {
    router.push({ pathname: '/trip/[id]/map', params: { id: trip.id } });
  }, [trip.id]);

  /* ── Hero : s'anime depuis la card vers le plein écran ── */
  const heroStyle = useAnimatedStyle(() => {
    'worklet';
    const p = progress.value;
    return {
      left:         interpolate(p, [0, 1], [cardLayout.x, 0]),
      top:          interpolate(p, [0, 1], [cardLayout.y, 0]),
      width:        interpolate(p, [0, 1], [cardLayout.width,  SCREEN_W]),
      height:       interpolate(p, [0, 1], [cardLayout.height, SCREEN_H]),
      borderRadius: interpolate(p, [0, 1], [20, 0]),
    };
  });

  /* ── Zone photo du hero : pleine card au départ → bandeau haut V2.
     L'image est en absoluteFill + cover : recadrage propre sur la zone. ── */
  const photoZoneStyle = useAnimatedStyle(() => {
    'worklet';
    const p = progress.value;
    return {
      height: interpolate(p, [0, 1], [cardLayout.height, SCREEN_H * HERO_PHOTO_RATIO]),
    };
  });

  /* ── Swipe-down : le drag pilote `progress` (la photo se re-morphe vers la
     card en direct), le relâchement ferme via triggerCollapse ou revient. ── */
  const panResponder = useRef(
    PanResponder.create({
      // Phase capture : prend la main même quand le drag démarre sur un
      // enfant touchable (badges, réglages, MaskedView du titre).
      onMoveShouldSetPanResponderCapture: (_, gs) =>
        gs.dy > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          progress.value = Math.max(DRAG_MIN_PROGRESS, 1 - gs.dy / DRAG_RANGE);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > DRAG_DISMISS_DY || gs.vy > DRAG_DISMISS_VELOCITY) {
          triggerCollapse.current?.();
        } else {
          progress.value = withTiming(1, { duration: 220 });
        }
      },
      onPanResponderTerminate: () => {
        progress.value = withTiming(1, { duration: 220 });
      },
    })
  ).current;

  /* ── Header : fade in + slide down ── */
  const headerStyle = useAnimatedStyle(() => {
    'worklet';
    const p = progress.value;
    return {
      opacity:   interpolate(p, [0.55, 0.9], [0, 1], 'clamp'),
      transform: [{ translateY: interpolate(p, [0.55, 0.9], [-14, 0], 'clamp') }],
    };
  });

  /* ── Bento : fade in + slide up ── */
  const bentoStyle = useAnimatedStyle(() => {
    'worklet';
    const p = progress.value;
    return {
      opacity:   interpolate(p, [0.65, 1], [0, 1], 'clamp'),
      transform: [{ translateY: interpolate(p, [0.65, 1], [28, 0], 'clamp') }],
    };
  });

  const dateLabel = formatDateLabel(trip.start_date, trip.end_date);
  const pastDateRange = tripStatus === 'past' ? formatPastDates(trip.start_date, trip.end_date) : '';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {/* ── Hero (layer bas) : photo recadrée en haut, crème dessous.
          Swipe vers le bas sur la photo → retour accueil. ── */}
      <Animated.View style={[styles.hero, heroStyle]}>
        <Animated.View style={[styles.heroPhotoZone, photoZoneStyle]} {...panResponder.panHandlers}>
          <Image
            source={trip.cover_url ? { uri: trip.cover_url } : require('@/assets/images/icon.png')}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <View style={styles.bgDim} />
        </Animated.View>
        <View style={styles.heroBelow} />
      </Animated.View>

      {/* ── Contenu dashboard (layer haut) ── */}
      <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top }]} pointerEvents="box-none">

        {/* Header — swipe vers le bas pour revenir à l'accueil */}
        <Animated.View style={[styles.header, headerStyle]} {...panResponder.panHandlers}>
          {/* Top badges row */}
          <View style={styles.topBadgesRow}>
            {tripStatus === 'ongoing' ? (
              <View style={[styles.heroBadge, styles.heroBadgeOngoing]}>
                <View style={styles.liveDot} />
                <Text style={styles.heroBadgeText}>En cours</Text>
              </View>
            ) : tripStatus === 'past' ? (
              <View style={[styles.heroBadge, styles.heroBadgePast]}>
                <Text style={[styles.heroBadgeText, { opacity: 0.85 }]}>Terminé ✈️</Text>
              </View>
            ) : (
              <View style={[styles.heroBadge, styles.heroBadgeFuture]}>
                <Text style={[styles.heroBadgeText, styles.heroBadgeTextFuture]}>À venir</Text>
              </View>
            )}
            <View style={styles.avatarsInline}>
              {members.slice(0, MAX_HEADER_AVATARS).map((m, i) => (
                <MemberAvatar key={m.id} member={m} size={HEADER_AVATAR} index={i} />
              ))}
            </View>
            <View style={styles.dateBadge}>
              {tripStatus === 'ongoing' && <View style={styles.liveDot} />}
              <Text style={styles.dateBadgeText}>
                {tripStatus === 'ongoing'
                  ? getDayBadge(trip.start_date, trip.end_date)
                  : dateLabel}
              </Text>
            </View>
          </View>

          <MaskedView
            style={styles.destinationMask}
            maskElement={
              <LinearGradient
                colors={['rgba(255,255,255,1.0)', 'rgba(255,255,255,0.10)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            }
          >
            <Text style={[styles.destText, tripStatus === 'past' && styles.destTextPast]} adjustsFontSizeToFit numberOfLines={1}>
              {trip.name.toUpperCase()}
            </Text>
          </MaskedView>
          {tripStatus === 'past' && (
            <Text style={styles.pastDateLine}>{pastDateRange}</Text>
          )}

        </Animated.View>

        {/* Bento / Ongoing dashboard — nappe crème V2 */}
        <Animated.View style={[styles.sheet, bentoStyle]}>
          {tripStatus === 'ongoing' ? (
            /* ── Dashboard EN COURS : carte « en ce moment » + tuiles habituelles ── */
            <ScrollView
              showsVerticalScrollIndicator={false}
              onLayout={e => setSheetHeight(e.nativeEvent.layout.height)}
              contentContainerStyle={[styles.scroll, { paddingBottom: navReserve }]}
            >
              <NowCard tripId={trip.id} ongoing={ongoing} />
              <FutureBento
                availableHeight={sheetHeight > 0 ? sheetHeight - styles.scroll.paddingTop - navReserve - NOW_CARD_HEIGHT - styles.scroll.gap : undefined}
                tripId={trip.id}
                startDate={trip.start_date}
                destination={trip.destination}
                stops={stops}
                region={ongoingRegion ?? stopsRegion ?? region}
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
          ) : tripStatus === 'past' ? (
            /* ── Dashboard PASSÉ (tuiles partagées avec app/trip/[id]/dashboard.tsx) ── */
            <ScrollView
              showsVerticalScrollIndicator={false}
              onLayout={e => setSheetHeight(e.nativeEvent.layout.height)}
              contentContainerStyle={[styles.scroll, { paddingBottom: navReserve }]}
            >
              <PastBento
                past={past}
                availableHeight={sheetHeight > 0 ? sheetHeight - styles.scroll.paddingTop - navReserve : undefined}
                tripId={trip.id}
                stops={stops}
                region={stopsRegion ?? region}
                mapCardRef={mapCardRef}
                onMapPress={handleMapPress}
              />
            </ScrollView>
          ) : (
            /* ── Dashboard FUTUR (tuiles partagées avec app/trip/[id]/dashboard.tsx) ── */
            <ScrollView
              showsVerticalScrollIndicator={false}
              onLayout={e => setSheetHeight(e.nativeEvent.layout.height)}
              contentContainerStyle={[styles.scroll, { paddingBottom: navReserve }]}
            >
              <FutureBento
                availableHeight={sheetHeight > 0 ? sheetHeight - styles.scroll.paddingTop - navReserve : undefined}
                tripId={trip.id}
                startDate={trip.start_date}
                destination={trip.destination}
                stops={stops}
                region={stopsRegion ?? region}
                mapCardRef={mapCardRef}
                onMapPress={handleMapPress}
              />
            </ScrollView>
          )}
        </Animated.View>

        {/* ── Bottom nav ── */}
        <Animated.View
          style={[styles.bottomNav, { bottom: floatingNavBottom(insets.bottom) }, bentoStyle]}
          pointerEvents="box-none"
        >
          <NavButton icon={BACK_ICON} onPress={handleBack} />
          {tripStatus === 'past'
            ? <NavButton icon="share-social-outline" iconSize={24} variant="accent" onPress={past.share} />
            : <NavButton icon="add" iconSize={28} variant="accent" onPress={() => router.push({ pathname: '/trip/[id]/add', params: { id: trip.id } })} />
          }
          <NavButton icon="settings-outline" onPress={() => router.push({ pathname: '/trip/[id]/settings', params: { id: trip.id } })} />
        </Animated.View>

      </View>



    </View>
  );
}


/* ─── Main styles ────────────────────────────────────────────── */
const styles = StyleSheet.create({
  /* Hero */
  hero: {
    position: 'absolute',
    overflow: 'hidden',
  },
  heroPhotoZone: {
    width: '100%',
    overflow: 'hidden',
  },
  heroBelow: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
  },
  bgDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10,15,30,0.28)',
  },

  /* Header */
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
  destinationMask: {
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  destText: {
    fontFamily: Fonts.displayBold,
    fontSize: HERO_TITLE_SIZE,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  topBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroBadge: {
    overflow: 'hidden',
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,1)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  heroBadgeOngoing: {
    backgroundColor: 'rgba(34,197,94,0.35)',
    borderColor: 'rgba(34,197,94,0.25)',
  },
  heroBadgePast: {
    backgroundColor: 'rgba(110,110,110,0.65)',
    borderColor: 'rgba(110,110,110,0.4)',
  },
  heroBadgeFuture: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  heroBadgeTextFuture: {
    color: Colors.white,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dateBadge: {
    overflow: 'hidden',
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateBadgeText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  avatarsInline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addMemberBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -9,
  },

  /* Settings gear button */
  settingsGearBtn: {
    width: 40,
    height: 40,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  settingsGearBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.50)',
  },

  /* Scroll / Bento — nappe crème V2 */
  sheet: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderTopLeftRadius: Radii.sheet,
    borderTopRightRadius: Radii.sheet,
    marginTop: Spacing.sm,
  },
  scroll: {
    paddingHorizontal: Spacing.md2,
    paddingTop: Spacing.lg,
    gap: Spacing.sm2 - 2,
  },
  row: { flexDirection: 'row', gap: Spacing.sm },

  /* Card text styles */
  cardTitle: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 0.8 },
  cardTitleOnDark: { color: Colors.textInverted },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  /* Documents */
  docList: { gap: 7, marginTop: Spacing.sm },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.accent },
  docText: { fontSize: 12, color: Colors.textPrimary, fontWeight: '500' },

  /* Planning */
  planningInfoOnLight: { color: Colors.textPrimary },
  planningInfo: {
    fontSize: 13,
    color: Colors.textInverted,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: Spacing.sm,
  },

  /* Map */
  mapLabelWrap: { position: 'absolute', bottom: 10, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.28)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999 },
  mapLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },

  /* Envies (card avec image de fond → contenu clair) */
  enviesEmpty: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontStyle: 'italic', marginTop: Spacing.xs },
  enviesCount: { fontSize: 13, color: '#FFFFFF', fontWeight: '600', marginTop: Spacing.xs, lineHeight: 18 },

  /* Budget */
  addCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.accent, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginVertical: 2 },
  budgetAmount: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary, marginTop: 6, letterSpacing: -0.5 },
  budgetSub: { fontSize: 10, color: Colors.textSecondary, fontWeight: '500', marginTop: 2 },

  /* Bottom nav */
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },

  /* Past trip header overrides */
  destTextPast: {
    fontSize: 38,
    letterSpacing: 0.5,
    lineHeight: 44,
  },
  pastDateLine: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
    marginBottom: 4,
  },
});
