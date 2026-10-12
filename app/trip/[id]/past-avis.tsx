// HAKO — Avis après le voyage : noter les logements et les activités
// Une carte par envie validée (ou réservée) : moyenne du groupe, ma note
// en un tap (enregistrée tout de suite), un mot optionnel, et ce qu'en
// pensent les autres.

import { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { BackBar, CreateTripHeader } from '@/components/createTrip/CreateTripChrome';
import { StarRating } from '@/components/past/StarRating';
import { usePastTrip } from '@/hooks/usePastTrip';
import { PastMember, ReviewableItem, ReviewRow } from '@/types/pastTrip';

const THUMB = 64;
const MAX_OTHER_COMMENTS = 2;

export default function ReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const p = usePastTrip(id);

  const members = useMemo(() => new Map((p.data?.members ?? []).map(m => [m.userId, m])), [p.data]);
  const stopNames = useMemo(() => new Map(p.stops.map(s => [s.id, s.place_name])), [p.stops]);
  const lodging = p.reviewables.filter(r => r.kind === 'lodging');
  const activities = p.reviewables.filter(r => r.kind === 'activity');
  const rated = p.reviewables.length - p.toRateCount;

  const rate = (item: ReviewableItem, rating: number, comment: string | null) => {
    void p.rate(item.wishId, rating, comment).then(error => { if (error) Alert.alert('Oups', error); });
  };

  const renderSection = (title: string, items: readonly ReviewableItem[]) => items.length > 0 && (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map(item => (
        <ReviewCard
          key={item.wishId}
          item={item}
          stopName={item.stopId ? stopNames.get(item.stopId) ?? null : null}
          others={(p.data?.reviews ?? []).filter(r => r.wish_id === item.wishId && r.user_id !== p.userId && r.comment)}
          members={members}
          onRate={(rating, comment) => rate(item, rating, comment)}
        />
      ))}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader title="Avis" />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleBlock}>
            <Text style={styles.title}>C’était comment ?</Text>
            <Text style={styles.subtitle}>
              {p.reviewables.length === 0
                ? 'Les envies validées pendant le voyage apparaîtront ici.'
                : p.toRateCount > 0
                  ? `Il te reste ${p.toRateCount} ${p.toRateCount > 1 ? 'lieux' : 'lieu'} à noter.`
                  : 'Merci ! Tu as tout noté.'}
            </Text>
          </View>

          {p.reviewables.length > 0 && (
            <View style={styles.progress} accessibilityLabel={`${rated} sur ${p.reviewables.length} notés`}>
              <View style={[styles.progressFill, { flex: rated }]} />
              <View style={{ flex: p.toRateCount }} />
            </View>
          )}

          {!p.data ? (p.error
            ? <Text style={styles.subtitle}>Chargement impossible : {p.error}</Text>
            : <ActivityIndicator color={Colors.primary} style={styles.loader} />) : (
            <>
              {renderSection('LOGEMENTS', lodging)}
              {renderSection('ACTIVITÉS & LIEUX', activities)}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <BackBar onBack={() => router.back()} bottomInset={insets.bottom} />
    </View>
  );
}

// ─── Carte d'un lieu à noter ─────────────────────────────────────────────────
function ReviewCard({ item, stopName, others, members, onRate }: {
  item: ReviewableItem;
  stopName: string | null;
  others: readonly ReviewRow[];
  members: ReadonlyMap<string, PastMember>;
  onRate: (rating: number, comment: string | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null); // null = commentaire enregistré
  const comment = draft ?? item.myComment ?? '';

  const saveComment = () => {
    if (draft === null || item.myRating === null) return;
    onRate(item.myRating, draft);
    setDraft(null);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Ionicons name={item.kind === 'lodging' ? 'bed-outline' : 'location-outline'} size={24} color={Colors.textMuted} />
          </View>
        )}
        <View style={styles.headText}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          {stopName ? <Text style={styles.meta} numberOfLines={1}>{stopName}</Text> : null}
          {item.avgRating !== null && (
            <View style={styles.avgRow}>
              <StarRating value={item.avgRating} size={12} />
              <Text style={styles.meta}>
                {item.avgRating.toFixed(1).replace('.', ',')} · {item.reviewCount} avis
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.mine}>
        <Text style={styles.mineLabel}>{item.myRating === null ? 'Ta note' : 'Ta note · modifiable'}</Text>
        <StarRating value={item.myRating} size={30} onChange={rating => onRate(rating, item.myComment)} />
      </View>

      {item.myRating !== null && (
        <TextInput
          style={styles.comment}
          value={comment}
          onChangeText={setDraft}
          onBlur={saveComment}
          placeholder="Un mot pour le groupe ? (optionnel)"
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={280}
        />
      )}

      {others.slice(0, MAX_OTHER_COMMENTS).map(r => (
        <View key={r.user_id} style={styles.other}>
          <Text style={styles.otherName}>{members.get(r.user_id)?.nickname ?? 'Membre'} · {r.rating}/5</Text>
          <Text style={styles.otherText}>« {r.comment} »</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.lg, gap: Spacing.md2 },
  titleBlock: { gap: 6 },
  title: { ...Typography.displayTitle, color: Colors.textPrimary },
  subtitle: { ...Typography.body, color: Colors.textMuted },
  loader: { marginTop: Spacing.xxl },
  progress: { flexDirection: 'row', height: 6, borderRadius: Radii.full, backgroundColor: Colors.line, overflow: 'hidden' },
  progressFill: { backgroundColor: Colors.accent },
  section: { gap: Spacing.sm2 },
  sectionTitle: { ...Typography.displayLabel, color: Colors.textPrimary },
  card: { gap: Spacing.sm2, padding: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card },
  head: { flexDirection: 'row', gap: Spacing.sm2 },
  thumb: { width: THUMB, height: THUMB, borderRadius: Radii.sm, backgroundColor: Colors.line },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  headText: { flex: 1, gap: 2, justifyContent: 'center' },
  cardTitle: { ...Typography.rowTitle, color: Colors.textInk },
  meta: { ...Typography.bodySmall, color: Colors.textMuted },
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  mine: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Spacing.sm2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.line,
  },
  mineLabel: { ...Typography.body, fontWeight: '600', color: Colors.textInk },
  comment: {
    minHeight: 44, padding: Spacing.sm2, borderRadius: Radii.sm,
    backgroundColor: Colors.background, ...Typography.body, color: Colors.textInk,
  },
  other: { gap: 2 },
  otherName: { ...Typography.bodySmall, fontWeight: '600', color: Colors.textInk },
  otherText: { ...Typography.body, color: Colors.textMuted },
});
