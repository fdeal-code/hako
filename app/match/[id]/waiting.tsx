// HAKO — Trip Match : salle d'attente
// Liste des participants (répondu / en attente) en temps réel via
// useTripMatch ; passage automatique au reveal quand le status
// bascule en 'voting' (Realtime sur trip_matches).

import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, StepActions, StepTitle, createCardStyles } from '@/components/createTrip/CreateTripChrome';
import { Avatar } from '@/components/ui/Avatar';
import { useTripMatch } from '@/hooks/useTripMatch';
import { buildMatchWhatsAppReminderUrl } from '@/utils/shareLinks';

const TAG_ANSWERED = 'A répondu';
const TAG_WAITING = 'En attente…';
const AVATAR_SIZE = 42;
const TRACK_HEIGHT = 6;

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

  const total = Math.max(participants.length, 1);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader title="Trip Match" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StepTitle
          title={isGenerating ? 'L’IA cherche vos destinations…' : 'Réponse envoyée !'}
          subtitle={isGenerating
            ? 'Quelques secondes, on croise les envies du groupe.'
            : 'Dès que tout le monde a répondu, on vous dévoile le match.'}
        />

        {/* Avancement */}
        <View style={styles.progressCard}>
          <View style={styles.progressHead}>
            <Text style={styles.progressCount}>{responsesCount}/{participants.length}</Text>
            <Text style={styles.progressLabel}>{isGenerating ? 'réponses, c’est complet' : 'ont répondu'}</Text>
            {isGenerating && <ActivityIndicator color={Colors.white} />}
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round((responsesCount / total) * 100)}%` }]} />
          </View>
        </View>

        {loading && participants.length === 0 ? (
          <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
        ) : (
          <View style={[createCardStyles.whiteCard, styles.list]}>
            {participants.map((participant, i) => {
              const answered = respondedIds.has(participant.user_id);
              return (
                <Animated.View key={participant.id} entering={FadeInDown.delay(i * 60)} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <Avatar name={participant.user?.nickname} uri={participant.user?.avatar_url} size={AVATAR_SIZE} />
                  <Text style={styles.name} numberOfLines={1}>{participant.user?.nickname ?? 'Voyageur'}</Text>
                  <View style={[styles.tag, answered && styles.tagDone]}>
                    <Ionicons name={answered ? 'checkmark' : 'time-outline'} size={12} color={answered ? Colors.white : Colors.textMuted} />
                    <Text style={[styles.tagText, answered && styles.tagTextDone]}>{answered ? TAG_ANSWERED : TAG_WAITING}</Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        )}

        {error !== null && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      <StepActions
        onBack={() => router.back()}
        onNext={remindOnWhatsApp}
        label="Relancer sur WhatsApp"
        icon="logo-whatsapp"
        variant="accent"
        disabled={isGenerating}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.md },
  progressCard: { padding: Spacing.md2, borderRadius: Radii.lg, backgroundColor: Colors.primary, gap: Spacing.sm2, ...Shadows.md },
  progressHead: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  progressCount: { ...Typography.displayValue, color: Colors.white },
  progressLabel: { flex: 1, ...Typography.body, color: Colors.textOnDark },
  track: { height: TRACK_HEIGHT, borderRadius: Radii.full, backgroundColor: Colors.textMuted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radii.full, backgroundColor: Colors.accent },
  loader: { marginTop: Spacing.xxl },
  list: { paddingHorizontal: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, paddingVertical: Spacing.sm2 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  name: { flex: 1, ...Typography.rowTitle, color: Colors.textInk },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    borderRadius: Radii.full, paddingHorizontal: Spacing.sm2, paddingVertical: Spacing.xs, backgroundColor: Colors.surfaceAlt,
  },
  tagDone: { backgroundColor: Colors.positive },
  tagText: { ...Typography.bodySmall, color: Colors.textMuted },
  tagTextDone: { color: Colors.white },
  errorText: { ...Typography.body, color: Colors.negative, textAlign: 'center' },
});
