import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { withTiming, Easing, runOnJS } from 'react-native-reanimated';

import { TripCard } from '@/components/home/TripCard';
import { ExpandedDashboard, CardLayout } from '@/components/home/ExpandedDashboard';
import { FilterTabs, TripFilter } from '@/components/home/FilterTabs';
import { Avatar } from '@/components/ui/Avatar';
import { useHomeExpand } from '@/contexts/HomeExpandContext';
import { Colors, Spacing } from '@/constants/theme';
import { Trip } from '@/constants/types';

// ─── Mock data ────────────────────────────────────────────────
const MOCK_USER = { name: 'Alex', avatar_url: undefined };

const MOCK_TRIPS: Trip[] = [
  {
    id: '1',
    name: 'Road trip Italie',
    destination: 'Italie',
    cover_url: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800&q=80',
    start_date: '2026-06-10',
    end_date: '2026-06-24',
    status: 'future',
    created_by: 'user-1',
    created_at: '2025-12-01',
    members: [
      { user_id: 'u1', trip_id: '1', role: 'organizer', user: { id: 'u1', email: '', name: 'Alex',  created_at: '' } },
      { user_id: 'u2', trip_id: '1', role: 'member',    user: { id: 'u2', email: '', name: 'Léa',   created_at: '' } },
      { user_id: 'u3', trip_id: '1', role: 'member',    user: { id: 'u3', email: '', name: 'Tom',   created_at: '' } },
      { user_id: 'u4', trip_id: '1', role: 'member',    user: { id: 'u4', email: '', name: 'Chloé', created_at: '' } },
    ],
  },
  {
    id: '2',
    name: 'Week-end Barcelone',
    destination: 'Barcelone',
    cover_url: 'https://images.unsplash.com/photo-1511527661048-7fe73d85e9a4?w=800&q=80',
    start_date: '2025-10-03',
    end_date: '2025-10-06',
    status: 'past',
    created_by: 'user-1',
    created_at: '2025-08-01',
    members: [
      { user_id: 'u1', trip_id: '2', role: 'organizer', user: { id: 'u1', email: '', name: 'Alex', created_at: '' } },
      { user_id: 'u2', trip_id: '2', role: 'member',    user: { id: 'u2', email: '', name: 'Léa',  created_at: '' } },
    ],
  },
];
// ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter]             = useState<TripFilter>('all');
  const [expandedTrip, setExpandedTrip] = useState<Trip | null>(null);
  const [cardLayout, setCardLayout]     = useState<CardLayout>({ x: 0, y: 0, width: 0, height: 0 });

  /* SharedValue et callback partagés avec la TabBar via le contexte */
  const { expandProgress, triggerCollapse } = useHomeExpand();

  const filteredTrips = MOCK_TRIPS.filter((t) => {
    if (filter === 'all')    return true;
    if (filter === 'future') return t.status === 'future';
    if (filter === 'past')   return t.status === 'past';
    return true;
  });

  /* Wrapper nommé pour éviter l'overload déprécié de runOnJS */
  const unmountDashboard = useCallback(() => { setExpandedTrip(null); }, []);

  /* Animation de fermeture — utilisée par ExpandedDashboard ET la TabBar */
  const handleCollapse = useCallback(() => {
    expandProgress.value = withTiming(
      0,
      { duration: 400, easing: Easing.in(Easing.cubic) },
      (finished) => { if (finished) runOnJS(unmountDashboard)(); }
    );
  }, [expandProgress, unmountDashboard]);

  /* Enregistre handleCollapse dans le ref partagé dès qu'il change */
  useEffect(() => {
    triggerCollapse.current = handleCollapse;
  }, [handleCollapse, triggerCollapse]);

  /* Ouvre le dashboard */
  const handleExpand = (trip: Trip, layout: CardLayout) => {
    setCardLayout(layout);
    setExpandedTrip(trip);
    expandProgress.value = 0;
    expandProgress.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
  };

  return (
    <View style={styles.root}>

      {/* ── Contenu home ── */}
      <View style={[styles.home, { paddingTop: insets.top }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Avatar name={MOCK_USER.name} uri={MOCK_USER.avatar_url} size={40} />
              <Text style={styles.greeting}>Hello, {MOCK_USER.name} !</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile')}
              style={styles.settingsBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.title}>{'Prêt pour votre\nprochaine aventure ?'}</Text>

          {/* Filter tabs */}
          <FilterTabs active={filter} onChange={setFilter} style={styles.filters} />

          {/* Trip list */}
          <View style={styles.tripList}>
            {filteredTrips.length === 0 ? (
              <EmptyState onCreatePress={() => router.push('/trip/create')} />
            ) : (
              filteredTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onExpand={(layout) => handleExpand(trip, layout)}
                />
              ))
            )}
          </View>
        </ScrollView>
      </View>

      {/* ── Dashboard overlay — zéro Modal, position absolute ── */}
      {expandedTrip && (
        <ExpandedDashboard
          trip={expandedTrip}
          cardLayout={cardLayout}
          progress={expandProgress}
        />
      )}

    </View>
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
  settingsBtn: { padding: Spacing.xs },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, lineHeight: 34, marginBottom: Spacing.lg },
  filters: { marginBottom: Spacing.lg },
  tripList: { gap: Spacing.md },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyIcon:     { fontSize: 48, marginBottom: Spacing.sm },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  emptyButton:   { marginTop: Spacing.md, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: 999 },
  emptyButtonText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
