// HAKO — Accueil (maquettes « Accueil · Actif » / « Premier lancement »)
// Salutation + cloche, titre, invitation en attente, carte du prochain
// voyage (J-x + prochaine action), « Tes autres voyages », Trip Match.
// La cloche ouvre la page app/notifications.tsx.

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Easing, withTiming } from 'react-native-reanimated';

import { ExpandedDashboard, CardLayout } from '@/components/home/ExpandedDashboard';
import { FirstTripEmpty } from '@/components/home/FirstTripEmpty';
import { InvitationBanner } from '@/components/home/InvitationBanner';
import { NextTripCard } from '@/components/home/NextTripCard';
import { OtherTripCard } from '@/components/home/OtherTripCard';
import { TripMatchEntryCard } from '@/components/match/TripMatchEntryCard';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, Fonts, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { Trip } from '@/constants/types';
import { useAuth } from '@/contexts/AuthContext';
import { useHomeExpand } from '@/contexts/HomeExpandContext';
import { useInbox } from '@/hooks/useInbox';
import { supabase } from '@/services/supabase';
import { tripEvents } from '@/utils/events';
import { localDayIso } from '@/utils/tripStops';

const OTHER_TRIPS_PREVIEW = 2;
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
  const { session } = useAuth();
  const inbox = useInbox();
  const [profileNick, setProfileNick] = useState<string | null>(null);
  const avatarUrl = session?.user?.user_metadata?.avatar_url as string | undefined;
  const nickname = profileNick ?? session?.user?.user_metadata?.nickname ?? session?.user?.email?.split('@')[0] ?? '';

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [showAllTrips, setShowAllTrips] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
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

  /* ── Prochain voyage = en cours ou départ le plus proche ; puis les autres
     voyages à venir ; les voyages terminés ont leur propre section ── */
  const today = localDayIso(new Date());
  const upcoming = trips.filter(t => t.end_date >= today).sort((a, b) => (a.start_date > b.start_date ? 1 : -1));
  const nextTrip = upcoming[0] ?? null;
  const others = upcoming.slice(1);
  const pastTrips = trips.filter(t => t.end_date < today).sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
  const toRows = (list: Trip[]): Trip[][] => {
    const rows: Trip[][] = [];
    for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2));
    return rows;
  };
  const otherRows = toRows(showAllTrips ? others : others.slice(0, OTHER_TRIPS_PREVIEW));
  const pastRows = toRows(showAllPast ? pastTrips : pastTrips.slice(0, OTHER_TRIPS_PREVIEW));

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
            {nextTrip && <NextTripCard trip={nextTrip} onExpand={layout => handleExpand(nextTrip, layout)} />}

            {others.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>TES AUTRES VOYAGES</Text>
                  {others.length > OTHER_TRIPS_PREVIEW && (
                    <TouchableOpacity onPress={() => setShowAllTrips(v => !v)}>
                      <Text style={styles.sectionLink}>{showAllTrips ? 'Moins' : 'Tout voir'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {otherRows.map(row => (
                  <View key={row.map(t => t.id).join('-')} style={styles.otherRow}>
                    {row.map(trip => (
                      <OtherTripCard key={trip.id} trip={trip} onExpand={layout => handleExpand(trip, layout)} />
                    ))}
                    {row.length === 1 && <View style={styles.otherSpacer} />}
                  </View>
                ))}
              </View>
            )}
            {pastTrips.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>TES SOUVENIRS</Text>
                  {pastTrips.length > OTHER_TRIPS_PREVIEW && (
                    <TouchableOpacity onPress={() => setShowAllPast(v => !v)}>
                      <Text style={styles.sectionLink}>{showAllPast ? 'Moins' : 'Tout voir'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {pastRows.map(row => (
                  <View key={row.map(t => t.id).join('-')} style={styles.otherRow}>
                    {row.map(trip => (
                      <OtherTripCard key={trip.id} trip={trip} onExpand={layout => handleExpand(trip, layout)} />
                    ))}
                    {row.length === 1 && <View style={styles.otherSpacer} />}
                  </View>
                ))}
              </View>
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
  sectionLink: { fontSize: 12, fontWeight: '600', color: Colors.accent },
  otherRow: { flexDirection: 'row', gap: Spacing.sm2 - 2 },
  otherSpacer: { flex: 1 },
});
