// HAKO — Accueil (maquettes « Accueil · Actif » / « Premier lancement »)
// Salutation + cloche, titre, invitation en attente, carte du prochain
// voyage (J-x + prochaine action), « Tes autres voyages » (à venir puis
// terminés) en slider horizontal ou en liste de grandes cartes, Trip Match.
// La cloche ouvre la page app/notifications.tsx.

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { Easing, FadeInDown, ReduceMotion, withTiming } from 'react-native-reanimated';

import { ExpandedDashboard, CardLayout } from '@/components/home/ExpandedDashboard';
import { FirstTripEmpty } from '@/components/home/FirstTripEmpty';
import { InvitationBanner } from '@/components/home/InvitationBanner';
import { NextTripCard } from '@/components/home/NextTripCard';
import { OtherTripCard } from '@/components/home/OtherTripCard';
import { TripMatchEntryCard } from '@/components/match/TripMatchEntryCard';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, Fonts, Motion, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { Trip } from '@/constants/types';
import { useAuth } from '@/contexts/AuthContext';
import { useHomeExpand } from '@/contexts/HomeExpandContext';
import { useInbox } from '@/hooks/useInbox';
import { supabase } from '@/services/supabase';
import { tripEvents } from '@/utils/events';
import { splitHomeTrips } from '@/utils/homeTrips';
import { localDayIso } from '@/utils/tripStops';

const SLIDER_VISIBLE_CARDS = 2.3; // la carte coupée à droite invite à faire glisser
const BELL_SIZE = 56;
const EXPAND_MS = 500;
const COLLAPSE_MS = 400;

interface TripRowDb {
  id: string;
  name: string;
  destination: string;
  cover_image_url: string | null;
  start_date: string;
  end_date: string;
  owner_id: string;
  created_at: string;
  destination_lat: number | null;
  destination_lng: number | null;
}

/* ── Ligne Supabase → Trip (dates comparées en chaînes locales) ── */
function dbRowToTrip(row: TripRowDb, today: string): Trip {
  const status: Trip['status'] = row.end_date < today ? 'past' : row.start_date <= today ? 'active' : 'future';
  return {
    id: row.id,
    name: row.name,
    destination: row.destination,
    cover_url: row.cover_image_url ?? undefined,
    start_date: row.start_date,
    end_date: row.end_date,
    status,
    created_by: row.owner_id,
    members: [],
    created_at: row.created_at,
    destination_lat: row.destination_lat,
    destination_lng: row.destination_lng,
  };
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const inbox = useInbox();
  const [profileNick, setProfileNick] = useState<string | null>(null);
  const avatarUrl = session?.user?.user_metadata?.avatar_url as string | undefined;
  const nickname = profileNick ?? session?.user?.user_metadata?.nickname ?? session?.user?.email?.split('@')[0] ?? '';

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [showAllTrips, setShowAllTrips] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [expandedTrip, setExpandedTrip] = useState<Trip | null>(null);
  const [cardLayout, setCardLayout] = useState<CardLayout>({ x: 0, y: 0, width: 0, height: 0 });
  const { expandProgress, triggerCollapse } = useHomeExpand();

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    void supabase.from('profiles').select('nickname').eq('id', uid).single()
      .then(({ data }) => { if (data?.nickname) setProfileNick(data.nickname as string); });
  }, [session?.user?.id]);

  /* ── Voyages ── */
  const fetchTrips = useCallback(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    setLoadingTrips(true);
    const today = localDayIso(new Date());
    void supabase
      .from('trip_members')
      .select('trip:trips(*)')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (!error && data) {
          const rows = (data as unknown as { trip: TripRowDb | null }[]).flatMap(r => (r.trip ? [r.trip] : []));
          setTrips(rows.map(row => dbRowToTrip(row, today)));
        }
        setLoadingTrips(false);
      });
  }, [session?.user?.id]);

  useFocusEffect(fetchTrips);
  useEffect(() => tripEvents.subscribe(fetchTrips), [fetchTrips]);

  /* ── En vedette : en cours ou prochain départ ; tous les autres (à venir
     puis terminés) dans une seule section, en slider ou en liste ── */
  const { featured: nextTrip, others } = splitHomeTrips(trips, localDayIso(new Date()));
  const sliderCardWidth = Math.round((width - Spacing.md2 * 2 - Spacing.sm2) / SLIDER_VISIBLE_CARDS);

  /* ── Ouverture animée du dashboard (overlay existant) ── */
  const handleExpand = (trip: Trip, layout: CardLayout) => {
    setCardLayout(layout);
    setExpandedTrip(trip);
    expandProgress.set(0);
    expandProgress.set(withTiming(1, { duration: EXPAND_MS, easing: Easing.out(Easing.cubic) }));
  };
  const handleCollapse = useCallback(() => {
    expandProgress.set(withTiming(0, { duration: COLLAPSE_MS, easing: Easing.in(Easing.cubic) }));
    setTimeout(() => setExpandedTrip(null), COLLAPSE_MS + 20);
  }, [expandProgress]);
  useEffect(() => { triggerCollapse.current = handleCollapse; }, [handleCollapse, triggerCollapse]);

  /* ── Invitation en attente ── */
  const invitation = inbox.invitations[0] ?? null;
  const respond = async (accept: boolean) => {
    if (!invitation) return;
    setJoiningId(invitation.id);
    const error = accept
      ? await inbox.acceptTripInvitation(invitation)
      : await inbox.declineTripInvitation(invitation.id);
    setJoiningId(null);
    if (error) Alert.alert('Oups', error);
    else if (accept) { fetchTrips(); Alert.alert('Bienvenue !', `Tu fais partie de « ${invitation.trips.name} ».`); }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={{ paddingTop: insets.top }}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Avatar name={nickname} uri={avatarUrl} size={48} />
            <Text style={styles.greeting} numberOfLines={1}>Hello, {nickname} !</Text>
          </View>
          <TouchableOpacity style={styles.bell} onPress={() => router.push('/notifications')} activeOpacity={0.85} accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
            {inbox.badgeCount > 0 && <View style={styles.bellBadge} />}
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>
          {trips.length === 0 && !loadingTrips ? 'Bienvenue dans la boîte !' : 'Prêt pour votre\nprochaine aventure ?'}
        </Text>

        {invitation && (
          <InvitationBanner
            invitation={invitation}
            busy={joiningId === invitation.id}
            onJoin={() => { void respond(true); }}
            onDecline={() => { void respond(false); }}
          />
        )}

        {loadingTrips ? (
          <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
        ) : trips.length === 0 ? (
          <FirstTripEmpty onCreate={() => router.push('/trip/create')} />
        ) : (
          <>
            {nextTrip && (
              <Animated.View entering={FadeInDown.duration(Motion.enter).reduceMotion(ReduceMotion.System)}>
                <NextTripCard trip={nextTrip} onExpand={layout => handleExpand(nextTrip, layout)} />
              </Animated.View>
            )}

            {others.length > 0 && (
              <Animated.View entering={FadeInDown.delay(Motion.stagger * 2).duration(Motion.enter).reduceMotion(ReduceMotion.System)} style={styles.section}>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>{nextTrip ? 'TES AUTRES VOYAGES' : 'TES VOYAGES'}</Text>
                  <TouchableOpacity onPress={() => setShowAllTrips(v => !v)} hitSlop={10}>
                    <Text style={styles.sectionLink}>{showAllTrips ? 'Réduire' : `Tout voir (${others.length})`}</Text>
                  </TouchableOpacity>
                </View>

                {showAllTrips ? (
                  /* Tout voir : chaque voyage en grande carte, comme celui en cours */
                  <View style={styles.allList}>
                    {others.map((trip, i) => (
                      <Animated.View key={trip.id} entering={FadeInDown.delay(Math.min(i, Motion.maxStaggerItems) * Motion.stagger).duration(Motion.enter).reduceMotion(ReduceMotion.System)}>
                        <NextTripCard trip={trip} onExpand={layout => handleExpand(trip, layout)} />
                      </Animated.View>
                    ))}
                  </View>
                ) : (
                  /* Slider horizontal : on fait glisser les cartes */
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.slider}
                    contentContainerStyle={styles.sliderContent}
                    snapToInterval={sliderCardWidth + Spacing.sm2}
                    decelerationRate="fast"
                  >
                    {others.map(trip => (
                      <OtherTripCard key={trip.id} trip={trip} width={sliderCardWidth} onExpand={layout => handleExpand(trip, layout)} />
                    ))}
                  </ScrollView>
                )}
              </Animated.View>
            )}
          </>
        )}

        {/* Trip Match — création ou reprise du match en cours */}
        <TripMatchEntryCard />
      </ScrollView>

      {expandedTrip && (
        <ExpandedDashboard trip={expandedTrip} cardLayout={cardLayout} progress={expandProgress} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.md2, gap: Spacing.md },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2 - 2 },
  greeting: { flexShrink: 1, ...Typography.headerSmall, color: Colors.textMuted },
  bell: {
    width: BELL_SIZE, height: BELL_SIZE, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center', ...Shadows.md,
  },
  bellBadge: {
    position: 'absolute', top: 12, right: 14,
    width: 10, height: 10, borderRadius: Radii.full,
    backgroundColor: Colors.accent, borderWidth: 1.5, borderColor: Colors.background,
  },
  title: { fontFamily: Fonts.display, fontSize: 28, lineHeight: 34, color: Colors.textPrimary },
  loader: { marginTop: Spacing.xxl },
  section: { gap: Spacing.sm2 - 2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { ...Typography.displayLabel, color: Colors.textPrimary },
  sectionLink: { ...Typography.chip, color: Colors.accent },
  allList: { gap: Spacing.md },
  // Le slider déborde jusqu'aux bords de l'écran
  slider: { marginHorizontal: -Spacing.md2 },
  sliderContent: { paddingHorizontal: Spacing.md2, gap: Spacing.sm2 },
});
