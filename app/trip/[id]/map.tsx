import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing } from '@/constants/theme';
import { supabase } from '@/services/supabase';

/* ─── Types ──────────────────────────────────────────────────── */
type Category    = 'restaurant' | 'monument' | 'cafe' | 'hotel' | 'activity' | 'photo' | 'photo_spot' | 'bar' | 'autre';
type WishStatus  = 'pending' | 'validated' | 'debate' | 'archived';
type StatusFilter = 'all' | 'pending' | 'validated' | 'debate';

interface WishVote {
  id:      string;
  wish_id: string;
  user_id: string;
  vote:    'up' | 'down';
}

interface Wish {
  id:             string;
  trip_id:        string;
  added_by:       string;
  added_by_name?: string;
  title:          string;
  description?:   string;
  category?:      Category;
  cover_url?:     string;
  image_url?:     string;
  address?:       string;
  status:         WishStatus;
  wish_votes:     WishVote[];
  created_at:     string;
  latitude?:      number;
  longitude?:     number;
}

/* ─── Config ─────────────────────────────────────────────────── */
const CATEGORY_META: Record<Category, { emoji: string; label: string }> = {
  restaurant: { emoji: '🍽️', label: 'Restaurant' },
  monument:   { emoji: '🏛️', label: 'Monument'   },
  cafe:       { emoji: '☕',  label: 'Café'        },
  hotel:      { emoji: '🏨', label: 'Hôtel'       },
  activity:   { emoji: '🎭', label: 'Activités'   },
  photo:      { emoji: '📸', label: 'Photo spot'  },
  photo_spot: { emoji: '📸', label: 'Photo spot'  },
  bar:        { emoji: '🍺', label: 'Bar'         },
  autre:      { emoji: '📦', label: 'Autre'       },
};

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: 'all',       label: 'Toutes'     },
  { key: 'pending',   label: 'En attente' },
  { key: 'validated', label: 'Validées'   },
  { key: 'debate',    label: 'En débat'   },
];

function statusColor(s: WishStatus) {
  if (s === 'validated') return '#22C55E';
  if (s === 'debate')    return '#F97316';
  return '#9CA3AF';
}

/* ─── WishMarker ─────────────────────────────────────────────── */
function WishMarker({ wish, isSelected }: { wish: Wish; isSelected: boolean }) {
  const color    = statusColor(wish.status);
  const catMeta  = wish.category ? CATEGORY_META[wish.category] : null;
  const imageUri = wish.image_url ?? wish.cover_url;

  return (
    <View style={ms.wrap}>
      <View style={[ms.border, { borderColor: color }, isSelected && ms.borderSelected]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={ms.img} />
        ) : (
          <View style={[ms.fallback, { backgroundColor: color + '33' }]}>
            <Text style={ms.fallbackEmoji}>{catMeta?.emoji ?? '📍'}</Text>
          </View>
        )}
      </View>

      {catMeta && (
        <View style={ms.badge}>
          <Text style={ms.badgeEmoji}>{catMeta.emoji}</Text>
        </View>
      )}

      {/* Triangle pointer */}
      <View style={[ms.pointer, { borderTopColor: color }]} />
    </View>
  );
}

const ms = StyleSheet.create({
  wrap: { alignItems: 'center' },

  border: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2.5, overflow: 'hidden',
    backgroundColor: 'white',
  },
  borderSelected: {
    borderWidth: 3.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  img:      { width: '100%', height: '100%' },
  fallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  fallbackEmoji: { fontSize: 22 },

  badge: {
    position: 'absolute',
    bottom: 2, right: -4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'white',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  badgeEmoji: { fontSize: 11 },

  pointer: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: 1,
  },
});

/* ─── WishSheet ──────────────────────────────────────────────── */
function WishSheet({ wish, onClose }: { wish: Wish | null; onClose: () => void }) {
  const insets   = useSafeAreaInsets();
  const slideY   = useRef(new Animated.Value(300)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (wish) {
      setVisible(true);
      Animated.spring(slideY, {
        toValue: 0, useNativeDriver: true, tension: 80, friction: 12,
      }).start();
    } else {
      Animated.timing(slideY, {
        toValue: 300, duration: 220, useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [wish]);

  if (!visible) return null;

  const color       = statusColor(wish!.status);
  const statusLabel =
    wish!.status === 'validated' ? 'Validée' :
    wish!.status === 'debate'    ? 'En débat' : 'En attente';
  const catMeta  = wish!.category ? CATEGORY_META[wish!.category] : null;
  const imageUri = wish!.image_url ?? wish!.cover_url;
  const ups      = wish!.wish_votes.filter(v => v.vote === 'up').length;
  const downs    = wish!.wish_votes.filter(v => v.vote === 'down').length;

  return (
    <Animated.View
      style={[
        ss.container,
        { paddingBottom: insets.bottom + 12, transform: [{ translateY: slideY }] },
      ]}
    >
      {/* Handle */}
      <View style={ss.handle} />

      <View style={ss.row}>
        {/* Thumbnail */}
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={ss.thumb} />
        ) : (
          <View style={[ss.thumbFallback, { backgroundColor: color + '22' }]}>
            <Text style={{ fontSize: 30 }}>{catMeta?.emoji ?? '📍'}</Text>
          </View>
        )}

        {/* Info */}
        <View style={ss.info}>
          <Text style={ss.title} numberOfLines={2}>{wish!.title}</Text>

          <View style={ss.metaRow}>
            <View style={[ss.dot, { backgroundColor: color }]} />
            <Text style={ss.metaText}>{statusLabel}</Text>
            {catMeta && (
              <Text style={ss.metaText}> · {catMeta.label}</Text>
            )}
          </View>

          {wish!.address ? (
            <Text style={ss.address} numberOfLines={1}>
              <Ionicons name="location-outline" size={11} color={Colors.textTertiary} />
              {' '}{wish!.address}
            </Text>
          ) : null}

          <View style={ss.votesRow}>
            <Ionicons name="heart" size={13} color="#22C55E" />
            <Text style={ss.voteNum}>{ups}</Text>
            <Ionicons name="thumbs-down" size={13} color="#EF4444" style={{ marginLeft: 10 }} />
            <Text style={ss.voteNum}>{downs}</Text>
          </View>
        </View>

        {/* Close */}
        <TouchableOpacity onPress={onClose} style={ss.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={20} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginBottom: 16,
  },
  row:          { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  thumb:        { width: 72, height: 72, borderRadius: 14 },
  thumbFallback:{
    width: 72, height: 72, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  info:         { flex: 1 },
  title:        { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6, lineHeight: 22 },
  metaRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' },
  dot:          { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  metaText:     { fontSize: 13, color: Colors.textSecondary },
  address:      { fontSize: 12, color: Colors.textTertiary, marginBottom: 4 },
  votesRow:     { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  voteNum:      { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginLeft: 4 },
  closeBtn:     { paddingTop: 2 },
});

/* ─── MapScreen ──────────────────────────────────────────────── */
export default function MapScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const insets   = useSafeAreaInsets();
  const mapRef   = useRef<MapView>(null);

  const [wishes,        setWishes]        = useState<Wish[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [selectedWish,  setSelectedWish]  = useState<Wish | null>(null);
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('all');

  /* ── Load wishes with coordinates ── */
  const loadWishes = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    console.log('[MAP] TRIP ID USED FOR MAP:', id);
    try {
      // 1. All wishes for this trip (to detect coord issues)
      const { data: allWishes } = await supabase
        .from('wishes')
        .select('id, title, latitude, longitude, status')
        .eq('trip_id', id);
      console.log('[MAP] ALL WISHES:', JSON.stringify(allWishes));
      console.log('[MAP] WISHES WITH COORDS:', JSON.stringify(
        allWishes?.filter(w => w.latitude && w.longitude)
      ));

      // 2. Wishes with coordinates (full data for map)
      const { data, error } = await supabase
        .from('wishes')
        .select('*, wish_votes(*)')
        .eq('trip_id', id)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);
      console.log('[MAP] MAP WISHES COUNT:', data?.length ?? 0);
      console.log('[MAP] MAP WISHES:', JSON.stringify(data));
      console.log('[MAP] MAP ERROR:', JSON.stringify(error));
      if (!error && data) setWishes(data as Wish[]);
    } catch (e) {
      console.warn('[map] load wishes error', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  /* ── Reload every time the screen comes into focus ── */
  useFocusEffect(
    useCallback(() => {
      loadWishes();
    }, [loadWishes])
  );

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return wishes.filter(w => w.status !== 'archived');
    return wishes.filter(w => w.status === statusFilter);
  }, [wishes, statusFilter]);

  /* ── Auto-fit map when data / filter changes ── */
  useEffect(() => {
    if (filtered.length === 0) return;
    const coords = filtered.map(w => ({
      latitude:  w.latitude!,
      longitude: w.longitude!,
    }));
    // Slight delay so MapView has time to mount
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 140, right: 60, bottom: 260, left: 60 },
        animated: true,
      });
    }, 500);
    return () => clearTimeout(t);
  }, [filtered.length, statusFilter]);

  /* ── Deselect when filter changes ── */
  useEffect(() => {
    setSelectedWish(null);
  }, [statusFilter]);

  const CHIP_TOP = insets.top + 64;

  return (
    <View style={styles.container}>

      {/* ── Map ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        showsUserLocation
        showsMyLocationButton={false}
        initialRegion={{
          latitude: 48.8566, longitude: 2.3522,
          latitudeDelta: 6, longitudeDelta: 6,
        }}
        onPress={() => setSelectedWish(null)}
      >
        {filtered.map(w => (
          <Marker
            key={w.id}
            coordinate={{ latitude: w.latitude!, longitude: w.longitude! }}
            onPress={(e) => { e.stopPropagation(); setSelectedWish(w); }}
            tracksViewChanges={false}
          >
            <WishMarker wish={w} isSelected={selectedWish?.id === w.id} />
          </Marker>
        ))}
      </MapView>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.title}>Carte</Text>

        <View style={styles.headerBtn} />
      </View>

      {/* ── Status filter chips ── */}
      <ScrollView
        horizontal
        style={[styles.filtersBar, { top: CHIP_TOP }]}
        contentContainerStyle={styles.filtersContent}
        showsHorizontalScrollIndicator={false}
      >
        {STATUS_CHIPS.map(c => (
          <TouchableOpacity
            key={c.key}
            onPress={() => setStatusFilter(c.key)}
            style={[styles.chip, statusFilter === c.key && styles.chipActive]}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, statusFilter === c.key && styles.chipTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Count badge ── */}
      {!loading && filtered.length > 0 && (
        <View style={[styles.countBadge, { top: CHIP_TOP + 48 }]}>
          <Text style={styles.countText}>
            {filtered.length} envie{filtered.length > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* ── Loading overlay ── */}
      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}

      {/* ── Empty state ── */}
      {!loading && filtered.length === 0 && (
        <View style={styles.emptyCard}>
          <Ionicons name="location-outline" size={44} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>Aucune envie avec adresse</Text>
          <Text style={styles.emptySub}>
            Ajoutez une adresse à vos envies{'\n'}pour les voir apparaître ici
          </Text>
        </View>
      )}

      {/* ── Wish detail bottom sheet ── */}
      <WishSheet wish={selectedWish} onClose={() => setSelectedWish(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8E8E0' },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },

  /* Filter chips */
  filtersBar: {
    position: 'absolute', left: 0, right: 0,
  },
  filtersContent: {
    paddingHorizontal: Spacing.md,
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  chipActive:     { backgroundColor: Colors.primary },
  chipText:       { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  chipTextActive: { color: 'white' },

  /* Count badge */
  countBadge: {
    position: 'absolute', right: Spacing.md,
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  countText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },

  /* Loading */
  loadingWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },

  /* Empty */
  emptyCard: {
    position: 'absolute',
    left: 20, right: 20, bottom: 100,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  emptyTitle: {
    fontSize: 16, fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },
});
