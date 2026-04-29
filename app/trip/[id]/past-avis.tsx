import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Image, Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii } from '@/constants/theme';
import { NavButton } from '@/components/ui/NavButton';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment?: string | null;
  created_at?: string;
  reviewer_name?: string;
  reviewer_avatar?: string | null;
}

interface Place {
  id: string;
  title: string;
  image_url?: string | null;
  address?: string | null;
  reviews: Review[];
  avgRating: number;
}

export default function PastAvisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [places,   setPlaces]   = useState<Place[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<Place | null>(null);

  const loadPlaces = useCallback(async () => {
    const { data: wishData } = await supabase
      .from('wishes')
      .select('id, title, image_url, address')
      .eq('trip_id', id)
      .eq('type', 'place')
      .eq('status', 'validated');

    const enriched = await Promise.all((wishData ?? []).map(async place => {
      const { data: rvws } = await supabase
        .from('activity_reviews').select('*').eq('wish_id', place.id);
      const enrichedRvws = await Promise.all((rvws ?? []).map(async r => {
        const { data: prof } = await supabase
          .from('profiles').select('nickname, avatar_url').eq('id', r.user_id).single();
        return {
          ...r,
          reviewer_name:   prof?.nickname   ?? 'Membre',
          reviewer_avatar: prof?.avatar_url ?? null,
        } as Review;
      }));
      const avgRating = enrichedRvws.length > 0
        ? enrichedRvws.reduce((s, r) => s + r.rating, 0) / enrichedRvws.length
        : 0;
      return { ...place, reviews: enrichedRvws, avgRating } as Place;
    }));

    setPlaces(enriched);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadPlaces(); }, [loadPlaces]);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Vos avis</Text>
        <Text style={s.sub}>
          {places.length} lieu{places.length > 1 ? 'x' : ''} visité{places.length > 1 ? 's' : ''}
        </Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.textSecondary} />
        </View>
      ) : places.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyEmoji}>⭐</Text>
          <Text style={s.emptyTitle}>Notez vos visites !</Text>
          <Text style={s.emptySub}>Aucun lieu validé pour ce voyage</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 110 }]}
        >
          {places.map(place => (
            <TouchableOpacity
              key={place.id}
              style={s.placeRow}
              onPress={() => setSelected(place)}
              activeOpacity={0.8}
            >
              {place.image_url
                ? <Image source={{ uri: place.image_url }} style={s.placeImg} resizeMode="cover" />
                : <View style={[s.placeImg, s.placeImgFallback]}>
                    <Text style={{ fontSize: 22 }}>📍</Text>
                  </View>
              }
              <View style={{ flex: 1 }}>
                <Text style={s.placeName} numberOfLines={1}>{place.title}</Text>
                {place.address && (
                  <Text style={s.placeAddr} numberOfLines={1}>{place.address}</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                {place.avgRating > 0 ? (
                  <StarRow value={Math.round(place.avgRating)} size={14} />
                ) : (
                  <Text style={s.placeNoRating}>–</Text>
                )}
                <Text style={s.placeCount}>{place.reviews.length} avis</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Bottom nav */}
      <View style={[s.bottomNav, { bottom: Math.max(insets.bottom, 10) + 16 }]} pointerEvents="box-none">
        <NavButton icon="arrow-back-outline" onPress={() => router.back()} />
      </View>

      {/* Review modal */}
      {selected && (
        <ReviewModal
          place={selected}
          currentUserId={session?.user?.id ?? ''}
          onClose={() => setSelected(null)}
          onSaved={(updated) => {
            setPlaces(prev => prev.map(p => p.id === updated.id ? updated : p));
            setSelected(updated);
          }}
        />
      )}
    </View>
  );
}

/* ─── StarRow ────────────────────────────────────────────────── */
function StarRow({
  value, size = 28, onSelect,
}: {
  value: number;
  size?: number;
  onSelect?: (n: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onSelect?.(n)} activeOpacity={0.8} disabled={!onSelect}>
          <Text style={{ fontSize: size, color: n <= value ? '#FFC107' : '#E0E0E0' }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/* ─── ReviewModal ────────────────────────────────────────────── */
function ReviewModal({
  place, currentUserId, onClose, onSaved,
}: {
  place: Place;
  currentUserId: string;
  onClose: () => void;
  onSaved: (updated: Place) => void;
}) {
  const insets = useSafeAreaInsets();
  const [myRating, setMyRating] = useState(0);
  const [comment,  setComment]  = useState('');
  const [saving,   setSaving]   = useState(false);

  const existing = place.reviews.find(r => r.user_id === currentUserId);
  useEffect(() => {
    if (existing) { setMyRating(existing.rating); setComment(existing.comment ?? ''); }
  }, [existing]);

  const avgRating = place.reviews.length > 0
    ? place.reviews.reduce((s, r) => s + r.rating, 0) / place.reviews.length
    : 0;

  const handlePublish = async () => {
    if (myRating === 0) { Alert.alert('Note requise', 'Sélectionne au moins 1 étoile.'); return; }
    setSaving(true);
    try {
      await supabase.from('activity_reviews').upsert({
        wish_id: place.id, user_id: currentUserId, rating: myRating, comment: comment.trim() || null,
      });
      const { data: rvws } = await supabase.from('activity_reviews').select('*').eq('wish_id', place.id);
      const enriched = await Promise.all((rvws ?? []).map(async r => {
        const { data: prof } = await supabase
          .from('profiles').select('nickname, avatar_url').eq('id', r.user_id).single();
        return {
          ...r,
          reviewer_name:   prof?.nickname   ?? 'Membre',
          reviewer_avatar: prof?.avatar_url ?? null,
        } as Review;
      }));
      const newAvg = enriched.length > 0 ? enriched.reduce((s, r) => s + r.rating, 0) / enriched.length : 0;
      onSaved({ ...place, reviews: enriched, avgRating: newAvg });
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer l'avis.");
    }
    setSaving(false);
  };

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[rm.root, { paddingTop: insets.top }]}>
        <View style={rm.topBar}>
          <TouchableOpacity onPress={onClose} style={rm.backBtn} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={rm.topTitle} numberOfLines={1}>{place.title}</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[rm.scroll, { paddingBottom: insets.bottom + 24 }]}
        >
          {place.image_url && (
            <Image source={{ uri: place.image_url }} style={rm.heroImg} resizeMode="cover" />
          )}
          <Text style={rm.placeName}>{place.title}</Text>
          {place.address && <Text style={rm.placeAddr}>{place.address}</Text>}

          {avgRating > 0 && (
            <View style={rm.avgRow}>
              <Text style={rm.avgNum}>{avgRating.toFixed(1)} / 5</Text>
              <StarRow value={Math.round(avgRating)} size={20} />
              <Text style={rm.avgCount}>({place.reviews.length} avis)</Text>
            </View>
          )}

          <View style={rm.divider} />
          <Text style={rm.subTitle}>Ton avis</Text>
          <StarRow value={myRating} size={40} onSelect={setMyRating} />

          <TextInput
            style={rm.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Ton avis sur ce lieu..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity
            style={[rm.publishBtn, (saving || myRating === 0) && { opacity: 0.4 }]}
            onPress={handlePublish}
            disabled={saving || myRating === 0}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={rm.publishBtnTxt}>Publier</Text>
            }
          </TouchableOpacity>

          {place.reviews.length > 0 && (
            <>
              <View style={rm.divider} />
              <Text style={rm.subTitle}>Avis du groupe</Text>
              {place.reviews.map((r, i) => (
                <View key={r.id ?? i} style={rm.reviewItem}>
                  <MemberAvatar
                    member={{ nickname: r.reviewer_name, avatar_url: r.reviewer_avatar }}
                    size={36}
                    index={i}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={rm.reviewerName}>{r.reviewer_name ?? 'Membre'}</Text>
                      <StarRow value={r.rating} size={13} />
                    </View>
                    {r.comment && <Text style={rm.reviewComment}>{r.comment}</Text>}
                    {r.created_at && (
                      <Text style={rm.reviewDate}>
                        {new Date(r.created_at).toLocaleDateString('fr-FR')}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </>
          )}

          {place.reviews.length === 0 && (
            <Text style={rm.noReview}>Soyez les premiers à noter !</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ─── Styles liste ───────────────────────────────────────────── */
const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: Colors.background },
  header:        { paddingHorizontal: Spacing.md, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:         { fontSize: 28, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5 },
  sub:           { fontSize: 14, color: Colors.textSecondary, fontWeight: '500', marginTop: 4 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyEmoji:    { fontSize: 48 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptySub:      { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
  list:          { paddingHorizontal: Spacing.md, paddingTop: 8 },
  placeRow:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  placeImg:      { width: 60, height: 60, borderRadius: 30, flexShrink: 0 },
  placeImgFallback: { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  placeName:     { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  placeAddr:     { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  placeNoRating: { fontSize: 16, color: Colors.textTertiary },
  placeCount:    { fontSize: 11, color: Colors.textTertiary },
  bottomNav:     { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 14 },
});

/* ─── Styles modal review ────────────────────────────────────── */
const rm = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#fff' },
  topBar:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:       { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle:      { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  scroll:        { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  heroImg:       { width: '100%', height: 200, borderRadius: Radii.sm, marginBottom: 8 },
  placeName:     { fontSize: 24, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5 },
  placeAddr:     { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  avgRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  avgNum:        { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  avgCount:      { fontSize: 12, color: Colors.textSecondary },
  divider:       { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  subTitle:      { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },
  commentInput:  { backgroundColor: Colors.background, borderRadius: Radii.sm, padding: 14, fontSize: 14, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, minHeight: 80, textAlignVertical: 'top', marginTop: 12 },
  publishBtn:    { backgroundColor: Colors.primary, borderRadius: Radii.full, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  publishBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  noReview:      { fontSize: 14, color: Colors.textTertiary, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },
  reviewItem:    { flexDirection: 'row', gap: 12, marginBottom: 14 },
  reviewerName:  { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  reviewComment: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  reviewDate:    { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
});
