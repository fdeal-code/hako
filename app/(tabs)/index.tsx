import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

import { TripCard } from '@/components/home/TripCard';
import { ExpandedDashboard, CardLayout } from '@/components/home/ExpandedDashboard';
import { FilterTabs, TripFilter, SortBy } from '@/components/home/FilterTabs';
import { Avatar } from '@/components/ui/Avatar';
import { PendingInvitationsSheet, PendingInvitation, FriendRequest } from '@/components/invitations/PendingInvitationsSheet';
import { useHomeExpand } from '@/contexts/HomeExpandContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { Colors, Spacing } from '@/constants/theme';
import { Trip } from '@/constants/types';
import { tripEvents } from '@/utils/events';

/* ── Helpers Supabase → Trip ───────────────────────────────── */
function dbRowToTrip(row: any): Trip {
  const now   = new Date();
  const start = new Date(row.start_date);
  const end   = new Date(row.end_date);
  let status: Trip['status'] = 'future';
  if (now > end)         status = 'past';
  else if (now >= start) status = 'active';

  return {
    id:          row.id,
    name:        row.name,
    destination: row.destination,
    cover_url:   row.cover_image_url ?? undefined,
    start_date:  row.start_date,
    end_date:    row.end_date,
    status,
    created_by:  row.owner_id,
    members:     [],
    created_at:  row.created_at,
  };
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [profileNick, setProfileNick] = useState<string | null>(null);
  const avatarUrl = session?.user?.user_metadata?.avatar_url as string | undefined;
  const nickname = profileNick ?? session?.user?.user_metadata?.nickname ?? session?.user?.email?.split('@')[0] ?? '';

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    supabase.from('profiles').select('nickname').eq('id', uid).single()
      .then(({ data }) => { if (data?.nickname) setProfileNick(data.nickname); });
  }, [session?.user?.id]);

  const [trips,               setTrips]               = useState<Trip[]>([]);
  const [loadingTrips,        setLoadingTrips]        = useState(true);
  const [filter,              setFilter]              = useState<TripFilter>('all');
  const [sortBy,              setSortBy]              = useState<SortBy>('recent');
  const [showSortMenu,        setShowSortMenu]        = useState(false);
  const [expandedTrip,        setExpandedTrip]        = useState<Trip | null>(null);
  const [cardLayout,          setCardLayout]          = useState<CardLayout>({ x: 0, y: 0, width: 0, height: 0 });
  const [pendingInvitations,  setPendingInvitations]  = useState<PendingInvitation[]>([]);
  const [friendRequests,      setFriendRequests]      = useState<FriendRequest[]>([]);
  const [showInvitationsSheet, setShowInvitationsSheet] = useState(false);

  /* ── Animation fade liste ── */
  const listOpacity = useSharedValue(1);
  const listStyle   = useAnimatedStyle(() => ({ opacity: listOpacity.value }));

  const { expandProgress, triggerCollapse } = useHomeExpand();

  /* ── Date locale YYYY-MM-DD (timezone-safe, partagée par filtre + badge) ── */
  const todayISO = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  /* ── Filtre par dates réelles ── */
  const filtered = trips.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'future') return !!t.start_date && t.start_date > todayISO;
    if (filter === 'past')   return !!t.end_date   && t.end_date   < todayISO;
    return true;
  });

  /* ── Tri ── */
  const STATUS_ORDER: Record<string, number> = { active: 0, future: 1, past: 2 };
  const displayedTrips = [...filtered].sort((a, b) => {
    // Toujours : actif → à venir → terminé
    const statusDiff = (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1);
    if (statusDiff !== 0) return statusDiff;
    // Puis le tri choisi par l'utilisateur
    if (sortBy === 'recent')    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    if (sortBy === 'departure') return new Date(a.start_date || '9999-12-31').getTime() - new Date(b.start_date || '9999-12-31').getTime();
    return 0;
  });

  /* ── Prochain voyage : voyage actif ou futur avec le départ le plus proche ── */
  const nextTripId = [...trips]
    .filter((t) => !!t.end_date && t.end_date >= todayISO)
    .sort((a, b) => (a.start_date > b.start_date ? 1 : -1))[0]?.id;

  /* ── Changement de filtre avec fade ── */
  const handleFilterChange = (f: TripFilter) => {
    console.log('FILTER PRESSED:', f);
    setFilter(f);
    listOpacity.value = withTiming(0, { duration: 80 }, () => {
      listOpacity.value = withTiming(1, { duration: 200 });
    });
  };

  const handleSortChange = (s: SortBy) => {
    console.log('SORT PRESSED:', s);
    setSortBy(s);
    listOpacity.value = withTiming(0, { duration: 80 }, () => {
      listOpacity.value = withTiming(1, { duration: 200 });
    });
  };

  const unmountDashboard = useCallback(() => { setExpandedTrip(null); }, []);

  const handleCollapse = useCallback(() => {
    expandProgress.value = withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) });
    setTimeout(unmountDashboard, 420);
  }, [expandProgress, unmountDashboard]);

  useEffect(() => {
    triggerCollapse.current = handleCollapse;
  }, [handleCollapse, triggerCollapse]);

  /* ── Fetch pending invitations ── */
  const fetchInvitations = useCallback(() => {
    const email = session?.user?.email?.toLowerCase();
    if (!email) return;
    console.log('CHECKING INVITES FOR:', email);
    supabase
      .from('invitations')
      .select('*, trips(name, destination, cover_image_url, start_date, end_date)')
      .eq('invited_email', email)
      .eq('status', 'pending')
      .then(({ data, error }) => {
        console.log('INVITATIONS FOUND:', data?.length);
        console.log('INVITATIONS ERROR:', JSON.stringify(error));
        console.log('INVITATIONS DATA:', JSON.stringify(data));
        setPendingInvitations((data ?? []) as PendingInvitation[]);
      });
  }, [session?.user?.email]);

  useFocusEffect(fetchInvitations);

  /* ── Fetch friend requests ── */
  const fetchFriendRequests = useCallback(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    (async () => {
      const { data: requests } = await supabase
        .from('friendships')
        .select('id, requester_id')
        .eq('addressee_id', userId)
        .eq('status', 'pending');

      if (!requests?.length) { setFriendRequests([]); return; }

      const full: FriendRequest[] = [];
      for (const req of requests) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_url, email')
          .eq('id', req.requester_id)
          .single();
        full.push({ id: req.id, requester_id: req.requester_id, requester: profile ?? null });
      }
      setFriendRequests(full);
    })();
  }, [session?.user?.id]);

  useFocusEffect(fetchFriendRequests);

  /* ── Fetch voyages ── */
  const fetchTrips = useCallback(() => {
    const userId = session?.user?.id ?? '00000000-0000-0000-0000-000000000000';
    setLoadingTrips(true);
    supabase
      .from('trip_members')
      .select('trip:trips(*)')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (!error && data) {
          setTrips(data.map((row: any) => dbRowToTrip(row.trip)));
        }
        setLoadingTrips(false);
      });
  }, [session?.user?.id]);

  useFocusEffect(fetchTrips);

  useEffect(() => {
    return tripEvents.subscribe(fetchTrips);
  }, [fetchTrips]);

  const handleExpand = (trip: Trip, layout: CardLayout) => {
    setCardLayout(layout);
    setExpandedTrip(trip);
    expandProgress.value = 0;
    expandProgress.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
  };

  return (
    <Pressable style={styles.root} onPress={() => showSortMenu && setShowSortMenu(false)}>

      {/* ── Contenu home ── */}
      <View style={[styles.home, { paddingTop: insets.top }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Avatar name={nickname} uri={avatarUrl} size={40} />
              <Text style={styles.greeting}>Hello, {nickname} !</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowInvitationsSheet(true)}
              style={styles.bellBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={24} color={Colors.textSecondary} />
              {(pendingInvitations.length > 0 || friendRequests.length > 0) && (
                <View style={styles.bellBadge} />
              )}
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.title}>{'Prêt pour votre\nprochaine aventure ?'}</Text>

          {/* Filter tabs + tri */}
          <FilterTabs
            active={filter}
            onChange={handleFilterChange}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            showSortMenu={showSortMenu}
            onToggleSortMenu={() => setShowSortMenu(v => !v)}
            style={styles.filters}
          />

          {/* Trip list avec fade */}
          <Animated.View style={[styles.tripList, listStyle]}>
            {loadingTrips ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
            ) : displayedTrips.length === 0 ? (
              <EmptyState onCreatePress={() => router.push('/trip/create')} />
            ) : (
              displayedTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onExpand={(layout) => handleExpand(trip, layout)}
                  isNextTrip={trip.id === nextTripId}
                />
              ))
            )}
          </Animated.View>
        </ScrollView>
      </View>

      {/* ── Dashboard overlay ── */}
      {expandedTrip && (
        <ExpandedDashboard
          trip={expandedTrip}
          cardLayout={cardLayout}
          progress={expandProgress}
        />
      )}

      {/* ── Pending invitations sheet ── */}
      <PendingInvitationsSheet
        visible={showInvitationsSheet}
        onClose={() => setShowInvitationsSheet(false)}
        invitations={pendingInvitations}
        onRefresh={() => {
          fetchInvitations();
          setShowInvitationsSheet(false);
        }}
        friendRequests={friendRequests}
        onFriendRequestsRefresh={fetchFriendRequests}
      />

    </Pressable>
  );
}

/* ─── Empty state ────────────────────────────────────────────── */
function EmptyState({ onCreatePress }: { onCreatePress: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>✈️</Text>
      <Text style={styles.emptyTitle}>Aucun voyage pour l'instant</Text>
      <Text style={styles.emptySubtitle}>Crée ton premier voyage et invite tes amis !</Text>
      <TouchableOpacity style={styles.emptyButton} onPress={onCreatePress} activeOpacity={0.85}>
        <Text style={styles.emptyButtonText}>Créer un voyage</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.background },
  home:  { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 110 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  greeting:   { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  bellBtn: { padding: Spacing.xs, position: 'relative' },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, lineHeight: 34, marginBottom: Spacing.lg },
  filters: { marginBottom: Spacing.lg },
  tripList: { gap: Spacing.md },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyIcon:       { fontSize: 48, marginBottom: Spacing.sm },
  emptyTitle:      { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptySubtitle:   { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  emptyButton:     { marginTop: Spacing.md, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: 999 },
  emptyButtonText: { color: Colors.white, fontWeight: '700', fontSize: 15 },

});
