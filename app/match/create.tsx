// HAKO — Trip Match : création
// Titre (placeholder fun aléatoire) + sélection d'amis, puis
// createMatch → partage du lien d'invitation → questionnaire
// (le creator répond en premier).

import { useState } from 'react';
import { Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Spacing } from '@/constants/theme';
import { FriendPicker } from '@/components/match/FriendPicker';
import { createMatch } from '@/services/tripMatchService';
import { buildMatchInviteMessage } from '@/utils/shareLinks';

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
    <View style={[styles.root, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Nouveau Trip Match</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Nom du match</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        maxLength={60}
        returnKeyType="done"
      />

      <Text style={styles.label}>Qui embarque ?</Text>
      <Text style={styles.hint}>
        {selectedIds.length === 0
          ? 'Sélectionne tes compagnons de voyage (tu peux aussi partir en éclaireur solo)'
          : `${selectedIds.length} ami${selectedIds.length > 1 ? 's' : ''} dans l’aventure`}
      </Text>
      <View style={styles.pickerZone}>
        <FriendPicker selectedIds={selectedIds} onToggle={toggleFriend} />
      </View>

      {error !== null && <Text style={styles.error}>{error}</Text>}

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <TouchableOpacity
          style={[styles.cta, creating && styles.ctaDisabled]}
          onPress={() => { void launch(); }}
          disabled={creating}
          activeOpacity={0.85}
        >
          <Ionicons name="sparkles" size={18} color={Colors.textInverted} />
          <Text style={styles.ctaLabel}>{creating ? 'Création…' : 'Lancer le match'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.md2 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm2,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  hint: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary, marginBottom: Spacing.sm },
  pickerZone: { flex: 1 },
  error: { textAlign: 'center', color: Colors.negative, fontSize: 13, fontWeight: '600' },
  footer: { paddingTop: Spacing.sm },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radii.pill,
    paddingVertical: Spacing.md,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaLabel: { color: Colors.textInverted, fontSize: 16, fontWeight: '700' },
});
