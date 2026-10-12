// HAKO — Trip Match : création
// Titre (placeholder fun aléatoire) + sélection d'amis, puis
// createMatch → partage du lien d'invitation → questionnaire
// (le creator répond en premier).

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, SectionLabel, StepActions, StepTitle, createCardStyles } from '@/components/createTrip/CreateTripChrome';
import { FriendPicker } from '@/components/match/FriendPicker';
import { createMatch } from '@/services/tripMatchService';
import { buildMatchInviteMessage } from '@/utils/shareLinks';

const FIELD_HEIGHT = 60;

const MATCH_TITLE_PLACEHOLDERS: readonly string[] = [
  'Les copains d’abord ✈️',
  'Opération évasion 🕶️',
  'Destination surprise 🎲',
  'Le grand départ 🌍',
  'Squad en vadrouille 🎒',
];

export default function MatchCreateScreen() {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [placeholder] = useState(
    () => MATCH_TITLE_PLACEHOLDERS[Math.floor(Math.random() * MATCH_TITLE_PLACEHOLDERS.length)]
      ?? 'Trip Match',
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFriend = (friendId: string) => {
    setSelectedIds(prev =>
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId],
    );
  };

  const launch = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);

    const finalTitle = title.trim().length > 0 ? title.trim() : placeholder;
    const { data: match, error: createError } = await createMatch(finalTitle, selectedIds);
    if (createError !== null || !match) {
      setError(createError ?? 'Création du match impossible.');
      setCreating(false);
      return;
    }

    try {
      await Share.share({ message: buildMatchInviteMessage(match.id, finalTitle) });
    } catch {
      // Partage annulé — on continue vers le questionnaire
    }
    router.replace(`/match/${match.id}/questionnaire`);
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CreateTripHeader title="Trip Match" />

      <View style={styles.body}>
        <StepTitle title="On part où ?" subtitle="6 questions chacun, et l’IA trouve la destination qui met tout le monde d’accord." />

        <View style={[createCardStyles.whiteCard, styles.field]}>
          <Ionicons name="sparkles-outline" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={placeholder}
            placeholderTextColor={Colors.textSecondary}
            maxLength={60}
            returnKeyType="done"
          />
        </View>

        <View style={styles.pickerHead}>
          <SectionLabel right={selectedIds.length > 0 ? `${selectedIds.length} sélectionné${selectedIds.length > 1 ? 's' : ''}` : undefined}>
            Qui embarque ?
          </SectionLabel>
          {selectedIds.length === 0 && (
            <Text style={styles.hint}>Sélectionne tes potes, ou pars en éclaireur et partage le lien.</Text>
          )}
        </View>
        <View style={styles.pickerZone}>
          <FriendPicker selectedIds={selectedIds} onToggle={toggleFriend} />
        </View>

        {error !== null && <Text style={styles.error}>{error}</Text>}
      </View>

      <StepActions
        onBack={() => router.back()}
        onNext={() => { void launch(); }}
        label="Lancer le match"
        icon="sparkles"
        variant="accent"
        loading={creating}
        bottomInset={insets.bottom}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { flex: 1, paddingHorizontal: Spacing.md2, paddingTop: Spacing.xl },
  field: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, minHeight: FIELD_HEIGHT, paddingHorizontal: Spacing.md },
  input: { flex: 1, ...Typography.cardTitle, color: Colors.textInk, paddingVertical: Spacing.md },
  pickerHead: { marginTop: Spacing.lg },
  hint: { ...Typography.bodySmall, color: Colors.textMuted, marginBottom: Spacing.sm },
  pickerZone: { flex: 1 },
  error: { ...Typography.body, color: Colors.negative, textAlign: 'center', marginTop: Spacing.sm },
});
