import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';

/* ─── Types ──────────────────────────────────────────────────── */
type Category   = 'restaurant' | 'monument' | 'cafe' | 'hotel' | 'activity' | 'photo' | 'bar';
type WishStatus = 'pending' | 'validated' | 'debate' | 'archived';
type VoteType   = 'up' | 'down';
type StatusFilter = 'all' | WishStatus;

interface WishVote {
  id:      string;
  wish_id: string;
  user_id: string;
  vote:    VoteType;
}

interface Wish {
  id:             string;
  trip_id:        string;
  added_by:       string;
  added_by_name?: string;
  title:          string;
  category?:      Category;
  cover_url?:     string;
  status:         WishStatus;
  wish_votes:     WishVote[];
  created_at:     string;
}

/* ─── Config ─────────────────────────────────────────────────── */
const CATEGORY_META: Record<Category, { emoji: string; label: string }> = {
  restaurant: { emoji: '🍽️', label: 'Restaurant' },
  monument:   { emoji: '🏛️', label: 'Monument'   },
  cafe:       { emoji: '☕',  label: 'Café'        },
  hotel:      { emoji: '🏨', label: 'Hôtel'       },
  activity:   { emoji: '🎭', label: 'Activité'    },
  photo:      { emoji: '📸', label: 'Photo spot'  },
  bar:        { emoji: '🍺', label: 'Bar'         },
};

const STATUS_META: Record<WishStatus, { emoji: string; label: string; color: string; bg: string }> = {
  validated: { emoji: '🟢', label: 'Validée',    color: '#22C55E', bg: 'rgba(34,197,94,0.12)'   },
  debate:    { emoji: '🟠', label: 'En débat',   color: '#F97316', bg: 'rgba(249,115,22,0.12)'  },
  pending:   { emoji: '⚪', label: 'En attente', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' },
  archived:  { emoji: '📦', label: 'Archivée',   color: '#ADADAD', bg: 'rgba(173,173,173,0.12)' },
};

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',       label: 'Toutes'        },
  { key: 'validated', label: '🟢 Validées'   },
  { key: 'debate',    label: '🟠 En débat'   },
  { key: 'pending',   label: '⚪ En attente' },
  { key: 'archived',  label: '📦 Archivées'  },
];

/* ─── Mock data ──────────────────────────────────────────────── */
const MOCK_WISHES: Wish[] = [
  {
    id: 'w1', trip_id: '1', added_by: 'u1', added_by_name: 'Alex',
    title: 'Côte Amalfitaine', category: 'photo',
    cover_url: 'https://images.unsplash.com/photo-1533606688076-b6f27e340939?w=400&q=70',
    status: 'validated',
    wish_votes: [
      { id: 'v1', wish_id: 'w1', user_id: 'u1', vote: 'up' },
      { id: 'v2', wish_id: 'w1', user_id: 'u2', vote: 'up' },
      { id: 'v3', wish_id: 'w1', user_id: 'u3', vote: 'up' },
    ],
    created_at: '',
  },
  {
    id: 'w2', trip_id: '1', added_by: 'u2', added_by_name: 'Marie',
    title: 'Trattoria Da Enzo', category: 'restaurant',
    cover_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=70',
    status: 'debate',
    wish_votes: [
      { id: 'v4', wish_id: 'w2', user_id: 'u1', vote: 'up'   },
      { id: 'v5', wish_id: 'w2', user_id: 'u2', vote: 'down' },
    ],
    created_at: '',
  },
  {
    id: 'w3', trip_id: '1', added_by: 'u1', added_by_name: 'Alex',
    title: 'Visite du Vatican', category: 'monument',
    cover_url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&q=70',
    status: 'pending',
    wish_votes: [
      { id: 'v6', wish_id: 'w3', user_id: 'u1', vote: 'up' },
    ],
    created_at: '',
  },
  {
    id: 'w4', trip_id: '1', added_by: 'u3', added_by_name: 'Lucas',
    title: "Sant'Eustachio Caffè", category: 'cafe',
    cover_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=70',
    status: 'pending',
    wish_votes: [],
    created_at: '',
  },
  {
    id: 'w5', trip_id: '1', added_by: 'u2', added_by_name: 'Marie',
    title: 'Fontaine de Trevi', category: 'photo',
    cover_url: 'https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=400&q=70',
    status: 'pending',
    wish_votes: [],
    created_at: '',
  },
  {
    id: 'w6', trip_id: '1', added_by: 'u3', added_by_name: 'Lucas',
    title: 'Bar San Calisto', category: 'bar',
    status: 'archived',
    wish_votes: [],
    created_at: '',
  },
];

/* ─── Écran principal ────────────────────────────────────────── */
export default function EnviesScreen() {
  const { id: tripId }  = useLocalSearchParams<{ id: string }>();
  const insets          = useSafeAreaInsets();
  const { session }     = useAuth();
  const currentUserId   = session?.user?.id ?? '';

  const [wishes,  setWishes]  = useState<Wish[]>(MOCK_WISHES);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState<StatusFilter>('all');

  /* ── Fetch Supabase ── */
  const fetchWishes = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('wishes')
        .select('*, wish_votes(*)')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        setWishes(data as Wish[]);
      }
    } catch {}
    setLoading(false);
  }, [tripId]);

  useEffect(() => { fetchWishes(); }, [fetchWishes]);

  /* ── Stats compteur ── */
  const activeWishes   = wishes.filter(w => w.status !== 'archived');
  const totalCount     = activeWishes.length;
  const validatedCount = wishes.filter(w => w.status === 'validated').length;

  /* ── Liste filtrée ── */
  const filtered = filter === 'all'
    ? activeWishes
    : wishes.filter(w => w.status === filter);

  /* ── Voter (optimistic update + Supabase sync) ── */
  const handleVote = useCallback((wishId: string, vote: VoteType) => {
    setWishes(prev => prev.map(w => {
      if (w.id !== wishId) return w;
      const existing = w.wish_votes.find(v => v.user_id === currentUserId);
      const shouldRemove = existing?.vote === vote;

      // Supabase fire-and-forget
      if (shouldRemove) {
        supabase.from('wish_votes').delete()
          .eq('wish_id', wishId).eq('user_id', currentUserId).then(() => {});
      } else {
        supabase.from('wish_votes').upsert(
          { wish_id: wishId, user_id: currentUserId, vote },
          { onConflict: 'wish_id,user_id' }
        ).then(() => {});
      }

      const newVotes = shouldRemove
        ? w.wish_votes.filter(v => v.user_id !== currentUserId)
        : [
            ...w.wish_votes.filter(v => v.user_id !== currentUserId),
            { id: `${wishId}-${currentUserId}`, wish_id: wishId, user_id: currentUserId, vote },
          ];

      return { ...w, wish_votes: newVotes };
    }));
  }, [currentUserId]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Vos envies</Text>
          <Text style={styles.subtitle}>
            {totalCount} envie{totalCount !== 1 ? 's' : ''} • {validatedCount} validée{validatedCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Filtres */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Liste */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={w => w.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <WishCard wish={item} currentUserId={currentUserId} onVote={handleVote} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>✨</Text>
              <Text style={styles.emptyText}>Aucune envie pour l'instant</Text>
            </View>
          }
        />
      )}

      {/* FAB "+" */}
      <TouchableOpacity
        style={[styles.fab, { bottom: Math.max(insets.bottom, Spacing.md) + Spacing.md }]}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>

    </View>
  );
}

/* ─── WishCard ───────────────────────────────────────────────── */
function WishCard({
  wish,
  currentUserId,
  onVote,
}: {
  wish:          Wish;
  currentUserId: string;
  onVote:        (wishId: string, vote: VoteType) => void;
}) {
  const catMeta    = wish.category ? CATEGORY_META[wish.category] : null;
  const statusMeta = STATUS_META[wish.status];
  const upVotes    = wish.wish_votes.filter(v => v.vote === 'up').length;
  const downVotes  = wish.wish_votes.filter(v => v.vote === 'down').length;
  const myVote     = wish.wish_votes.find(v => v.user_id === currentUserId)?.vote ?? null;

  return (
    <View style={styles.card}>

      {/* Image ou placeholder emoji */}
      <View style={styles.cardImageWrap}>
        {wish.cover_url ? (
          <Image source={{ uri: wish.cover_url }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Text style={styles.cardImageEmoji}>{catMeta?.emoji ?? '📍'}</Text>
          </View>
        )}
      </View>

      {/* Contenu */}
      <View style={styles.cardBody}>
        {/* Titre + badge statut */}
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={2}>{wish.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
            <Text style={styles.statusEmoji}>{statusMeta.emoji}</Text>
          </View>
        </View>

        {/* Catégorie */}
        {catMeta && (
          <Text style={styles.categoryLabel}>{catMeta.emoji} {catMeta.label}</Text>
        )}

        {/* Ajouté par */}
        {wish.added_by_name && (
          <Text style={styles.addedBy}>Ajouté par {wish.added_by_name}</Text>
        )}

        {/* Boutons vote */}
        <View style={styles.voteRow}>
          <TouchableOpacity
            style={[styles.voteBtn, myVote === 'up' && styles.voteLoveActive]}
            onPress={() => onVote(wish.id, 'up')}
            activeOpacity={0.8}
          >
            <Text style={styles.voteEmoji}>❤️</Text>
            <Text style={[styles.voteCount, myVote === 'up' && styles.voteLoveCount]}>{upVotes}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voteBtn, myVote === 'down' && styles.votePassActive]}
            onPress={() => onVote(wish.id, 'down')}
            activeOpacity={0.8}
          >
            <Text style={styles.voteEmoji}>👎</Text>
            <Text style={styles.voteCount}>{downVotes}</Text>
          </TouchableOpacity>
        </View>
      </View>

    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },

  /* Filtres */
  filtersScroll: {
    maxHeight: 44,
    marginBottom: Spacing.md,
  },
  filtersContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.white,
  },

  /* Liste */
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 110,
    gap: Spacing.sm,
  },
  empty: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },

  /* Card */
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 110,
    ...Shadows.sm,
  },
  cardImageWrap: {
    width: 100,
  },
  cardImage: {
    width: 100,
    height: '100%',
  },
  cardImagePlaceholder: {
    width: 100,
    height: '100%',
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImageEmoji: {
    fontSize: 32,
  },
  cardBody: {
    flex: 1,
    padding: 12,
    gap: 3,
    justifyContent: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: 2,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  statusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusEmoji: {
    fontSize: 14,
  },
  categoryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  addedBy: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  voteRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 6,
  },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  voteLoveActive: {
    backgroundColor: '#FFF0F3',
    borderColor: '#FF4B6E',
  },
  votePassActive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.textTertiary,
  },
  voteEmoji: { fontSize: 13 },
  voteCount: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  voteLoveCount: {
    color: '#FF4B6E',
  },

  /* FAB */
  fab: {
    position: 'absolute',
    right: Spacing.md,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },
});
