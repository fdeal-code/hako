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
import { BlurView } from 'expo-blur';
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
  const slideY   = useRef(new Animated.Value(600)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (wish) {
      setVisible(true);
      Animated.spring(slideY, {
        toValue: 0, useNativeDriver: true, tension: 70, friction: 12,
      }).start();
    } else {
      Animated.timing(slideY, {
        toValue: 600, duration: 260, useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [wish]);

  if (!visible) return null;

  const color       = statusColor(wish!.status);
  const statusLabel =
    wish!.status === 'validated' ? 'Validée ✓' :
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

      {/* Image */}
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={ss.heroImage} resizeMode="cover" />
      ) : (
        <View style={[ss.heroFallback, { backgroundColor: color + '18' }]}>
          <Text style={{ fontSize: 52 }}>{catMeta?.emoji ?? '📍'}</Text>
        </View>
      )}

      {/* Content */}
      <View style={ss.content}>
        <Text style={ss.title} numberOfLines={2}>{wish!.title}</Text>

        {/* Badges */}
        <View style={ss.badges}>
          <View style={[ss.badge, { backgroundColor: color + '18' }]}>
            <View style={[ss.dot, { backgroundColor: color }]} />
            <Text style={[ss.badgeText, { color }]}>{statusLabel}</Text>
          </View>
          {catMeta && (
            <View style={ss.badge}>
              <Text style={ss.badgeText}>{catMeta.emoji} {catMeta.label}</Text>
            </View>
          )}
          <View style={ss.badge}>
            <Text style={ss.badgeText}>❤️ {ups}  👎 {downs}</Text>
          </View>
        </View>

        {wish!.address ? (
          <View style={ss.addressRow}>
            <Ionicons name="location-outline" size={13} color="#999" />
            <Text style={ss.address} numberOfLines={2}>{wish!.address}</Text>
          </View>
        ) : null}
      </View>

      {/* Actions */}
      <View style={ss.actions}>
        <TouchableOpacity
          style={ss.planBtn}
          onPress={() => router.push(`/trip/${wish!.trip_id}/planning`)}
          activeOpacity={0.85}
        >
          <Ionicons name="calendar-outline" size={16} color="#fff" />
          <Text style={ss.planBtnText}>Ajouter au planning</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={ss.detailBtn}
          onPress={() => { onClose(); router.push(`/trip/${wish!.trip_id}/envies`); }}
          activeOpacity={0.8}
        >
          <Text style={ss.detailBtnText}>Voir les détails</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
          <Text style={ss.closeTxt}>Fermer</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 20,
    minHeight: '55%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginBottom: 16,
  },
  heroImage: {
    width: '100%',
    height: 200,
    marginHorizontal: 0,
  },
  heroFallback: {
    width: '100%',
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.4,
    marginBottom: 12,
    lineHeight: 28,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F5F5F5',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dot:          { width: 7, height: 7, borderRadius: 4 },
  badgeText:    { fontSize: 12, fontWeight: '600', color: '#555' },
  addressRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginBottom: 4 },
  address:      { flex: 1, fontSize: 13, color: '#888', lineHeight: 18 },
  actions:      { paddingHorizontal: 20, marginTop: 12, gap: 10 },
  planBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1A1A1A', borderRadius: 14, paddingVertical: 15 },
  planBtnText:  { fontSize: 15, fontWeight: '700', color: '#fff' },
  detailBtn:    { backgroundColor: '#F5F5F5', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  detailBtnText: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  closeTxt:     { textAlign: 'center', fontSize: 14, color: '#999', paddingVertical: 6, fontWeight: '500' },
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
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.countBadgeContent}>
            <Text style={styles.countText}>
              {filtered.length} envie{filtered.length > 1 ? 's' : ''}
            </Text>
          </View>
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
    width: 56, height: 56, borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
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
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  countBadgeContent: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  countText: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },

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
