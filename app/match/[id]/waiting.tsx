// HAKO — Trip Match : salle d'attente
// Liste des participants (répondu / en attente) en temps réel via
// useTripMatch ; passage automatique au reveal quand le status
// bascule en 'voting' (Realtime sur trip_matches).

import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

import { Colors, Radii, Shadows, Spacing } from '@/constants/theme';
import { Avatar } from '@/components/ui/Avatar';
import { useTripMatch } from '@/hooks/useTripMatch';
import { buildMatchWhatsAppReminderUrl } from '@/utils/shareLinks';

const TAG_ANSWERED = 'A répondu ✓';
const TAG_WAITING = 'En attente…';
const AVATAR_SIZE = 42;

export default function MatchWaitingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { match, participants, responses, responsesCount, loading, error } = useTripMatch(id);

  const respondedIds = new Set(responses.map(r => r.user_id));
  const isGenerating = match?.status === 'proposing';

  /* Propositions prêtes → reveal ; match déjà clos → état final */
  useEffect(() => {
    if (!id) return;
    if (match?.status === 'voting') router.replace(`/match/${id}/reveal`);
    else if (match?.status === 'completed') router.replace(`/match/${id}/proposals`);
  }, [match?.status, id]);

  const remindOnWhatsApp = () => {
    if (!id) return;
    void Linking.openURL(buildMatchWhatsAppReminderUrl(id));
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.sm }]}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
      </TouchableOpacity>

      <Text style={styles.title}>
        {isGenerating ? 'L’IA cherche vos destinations…' : 'Réponse envoyée !'}
      </Text>
      <Text style={styles.subtitle}>
        {isGenerating
          ? 'Quelques secondes, on croise les données du groupe ✨'
          : `${responsesCount}/${participants.length} ont répondu — on relance les retardataires ?`}
      </Text>

      {loading && participants.length === 0 ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {participants.map(participant => {
            const answered = respondedIds.has(participant.user_id);
            return (
              <View key={participant.id} style={styles.row}>
                <Avatar
                  name={participant.user?.nickname}
                  uri={participant.user?.avatar_url}
                  size={AVATAR_SIZE}
                />
                <Text style={styles.name} numberOfLines={1}>
                  {participant.user?.nickname ?? 'Voyageur'}
                </Text>
                <View style={[styles.tag, answered ? styles.tagDone : styles.tagWaiting]}>
                  <Text style={[styles.tagText, answered ? styles.tagTextDone : styles.tagTextWaiting]}>
                    {answered ? TAG_ANSWERED : TAG_WAITING}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {isGenerating && <ActivityIndicator size="small" color={Colors.primary} />}
      {error !== null && <Text style={styles.errorText}>{error}</Text>}

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <TouchableOpacity style={styles.whatsappBtn} onPress={remindOnWhatsApp} activeOpacity={0.85}>
          <Ionicons name="logo-whatsapp" size={20} color={Colors.textInverted} />
          <Text style={styles.whatsappLabel}>Relancer sur WhatsApp</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.md2 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  loader: { marginTop: Spacing.xxl },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm2,
    backgroundColor: Colors.surface,
    borderRadius: Radii.sm,
    padding: Spacing.sm2,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  tag: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.sm2,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
  },
  tagDone: { borderColor: Colors.positive, backgroundColor: Colors.surface },
  tagWaiting: { borderColor: Colors.border, backgroundColor: Colors.background },
  tagText: { fontSize: 12, fontWeight: '600' },
  tagTextDone: { color: Colors.positive },
  tagTextWaiting: { color: Colors.textSecondary },
  errorText: { textAlign: 'center', color: Colors.negative, fontSize: 13, fontWeight: '600' },
  footer: { paddingTop: Spacing.sm },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.positive,
    borderRadius: Radii.pill,
    paddingVertical: Spacing.md,
  },
  whatsappLabel: { color: Colors.textInverted, fontSize: 16, fontWeight: '700' },
});
