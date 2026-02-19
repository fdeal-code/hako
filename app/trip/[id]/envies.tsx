import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { Envie, EnvieStatus } from '@/constants/types';
import { Chip } from '@/components/ui/Chip';

type StatusFilter = 'all' | EnvieStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'validated', label: '✅ Validées' },
  { key: 'debate', label: '🔥 En débat' },
  { key: 'pending', label: '⏳ En attente' },
  { key: 'archived', label: 'Archivées' },
];

const MOCK_ENVIES: Envie[] = [
  {
    id: 'e1', trip_id: '1', added_by: 'u1',
    title: 'Côte Amalfitaine', description: 'Road trip sur la côte, villages colorés',
    cover_url: 'https://images.unsplash.com/photo-1533606688076-b6f27e340939?w=600&q=80',
    status: 'validated', votes_love: 4, votes_pass: 0, user_vote: 'love', created_at: '',
  },
  {
    id: 'e2', trip_id: '1', added_by: 'u2',
    title: 'Rome en 2 jours', description: 'Colisée, Vatican, Trevi',
    cover_url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&q=80',
    status: 'debate', votes_love: 2, votes_pass: 1, user_vote: null, created_at: '',
  },
  {
    id: 'e3', trip_id: '1', added_by: 'u3',
    title: 'Cinque Terre', description: 'Randonnée entre les villages',
    cover_url: 'https://images.unsplash.com/photo-1534650075489-7e2d8e2a5eda?w=600&q=80',
    status: 'pending', votes_love: 1, votes_pass: 0, user_vote: null, created_at: '',
  },
];

const STATUS_COLOR: Record<EnvieStatus, string> = {
  validated: Colors.vote.love,
  debate: Colors.vote.debate,
  pending: Colors.vote.pending,
  archived: Colors.vote.archived,
};

export default function EnviesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<StatusFilter>('all');

  const filtered = MOCK_ENVIES.filter((e) => filter === 'all' || e.status === filter);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Vos envies</Text>
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.8}>
          <Ionicons name="add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Status filter */}
      <View style={styles.filtersWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(f) => f.key}
          contentContainerStyle={styles.filtersContent}
          renderItem={({ item }) => (
            <Chip
              label={item.label}
              active={filter === item.key}
              onPress={() => setFilter(item.key)}
            />
          )}
        />
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <EnvieCard envie={item} />}
      />
    </View>
  );
}

function EnvieCard({ envie }: { envie: Envie }) {
  const [userVote, setUserVote] = useState(envie.user_vote);

  return (
    <View style={styles.card}>
      {envie.cover_url && (
        <Image source={{ uri: envie.cover_url }} style={styles.cardImage} />
      )}
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{envie.title}</Text>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[envie.status] }]} />
        </View>
        {envie.description && (
          <Text style={styles.cardDesc} numberOfLines={2}>{envie.description}</Text>
        )}
        <View style={styles.cardFooter}>
          {/* Vote buttons */}
          <View style={styles.votes}>
            <TouchableOpacity
              style={[styles.voteBtn, userVote === 'love' && styles.voteBtnActive]}
              onPress={() => setUserVote(userVote === 'love' ? null : 'love')}
              activeOpacity={0.8}
            >
              <Text style={styles.voteBtnIcon}>❤️</Text>
              <Text style={[styles.voteBtnCount, userVote === 'love' && { color: Colors.vote.love }]}>
                {envie.votes_love}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.voteBtn, userVote === 'pass' && styles.voteBtnPassActive]}
              onPress={() => setUserVote(userVote === 'pass' ? null : 'pass')}
              activeOpacity={0.8}
            >
              <Text style={styles.voteBtnIcon}>👎</Text>
              <Text style={styles.voteBtnCount}>{envie.votes_pass}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  backBtn: {
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersWrapper: {
    marginBottom: Spacing.md,
  },
  filtersContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  cardImage: {
    width: '100%',
    height: 160,
  },
  cardContent: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  votes: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  voteBtnActive: {
    backgroundColor: Colors.vote.love + '15',
    borderColor: Colors.vote.love,
  },
  voteBtnPassActive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.textTertiary,
  },
  voteBtnIcon: {
    fontSize: 14,
  },
  voteBtnCount: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
