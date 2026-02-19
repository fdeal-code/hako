import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { TripCard } from '@/components/home/TripCard';
import { FilterTabs, TripFilter } from '@/components/home/FilterTabs';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, Spacing } from '@/constants/theme';
import { Trip } from '@/constants/types';

// ─── Mock data (replace with Supabase queries) ───────────────────────────────
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
      { user_id: 'u1', trip_id: '1', role: 'organizer', user: { id: 'u1', email: '', name: 'Alex', created_at: '' } },
      { user_id: 'u2', trip_id: '1', role: 'member', user: { id: 'u2', email: '', name: 'Léa', created_at: '' } },
      { user_id: 'u3', trip_id: '1', role: 'member', user: { id: 'u3', email: '', name: 'Tom', created_at: '' } },
      { user_id: 'u4', trip_id: '1', role: 'member', user: { id: 'u4', email: '', name: 'Chloé', created_at: '' } },
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
      { user_id: 'u2', trip_id: '2', role: 'member', user: { id: 'u2', email: '', name: 'Léa', created_at: '' } },
    ],
  },
];
// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<TripFilter>('all');

  const filteredTrips = MOCK_TRIPS.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'future') return t.status === 'future';
    if (filter === 'past') return t.status === 'past';
    return true;
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Avatar
              name={MOCK_USER.name}
              uri={MOCK_USER.avatar_url}
              size={40}
            />
            <Text style={styles.greeting}>
              Hello, {MOCK_USER.name} !
            </Text>
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
        <Text style={styles.title}>
          {'Prêt pour votre\nprochaine aventure ?'}
        </Text>

        {/* Filter tabs */}
        <FilterTabs
          active={filter}
          onChange={setFilter}
          style={styles.filters}
        />

        {/* Trip list */}
        <View style={styles.tripList}>
          {filteredTrips.length === 0 ? (
            <EmptyState onCreatePress={() => router.push('/trip/create')} />
          ) : (
            filteredTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function EmptyState({ onCreatePress }: { onCreatePress: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>✈️</Text>
      <Text style={styles.emptyTitle}>Aucun voyage pour l'instant</Text>
      <Text style={styles.emptySubtitle}>
        Crée ton premier voyage et invite tes amis !
      </Text>
      <TouchableOpacity style={styles.emptyButton} onPress={onCreatePress} activeOpacity={0.85}>
        <Text style={styles.emptyButtonText}>Créer un voyage</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  settingsBtn: {
    padding: Spacing.xs,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 34,
    marginBottom: Spacing.lg,
  },
  filters: {
    marginBottom: Spacing.lg,
  },
  tripList: {
    gap: Spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 999,
  },
  emptyButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
