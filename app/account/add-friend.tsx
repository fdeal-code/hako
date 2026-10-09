// HAKO — Ajouter un ami (page plein écran, remplace AddFriendSheet)
// On cherche par e-mail ; trouvé → carte avec « Envoyer la demande »,
// introuvable → proposer de l'inviter sur Hako (menu Partager).

import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, StepTitle, createCardStyles } from '@/components/createTrip/CreateTripChrome';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { useAddFriend } from '@/hooks/useAddFriend';

const AVATAR = 64;
const FIELD_HEIGHT = 60;
const SEARCH_BTN = 44;
const INVITE_MESSAGE = 'On organise nos voyages sur Hako, rejoins-moi ! Télécharge l’app et inscris-toi avec cette adresse e-mail.';

export default function AddFriendScreen() {
  const insets = useSafeAreaInsets();
  const f = useAddFriend();
  const [error, setError] = useState<string | null>(null);

  const search = async () => { setError(null); setError(await f.search()); };
  const send = async () => { setError(null); setError(await f.send()); };
  const invite = () => { void Share.share({ message: INVITE_MESSAGE }); };

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CreateTripHeader title="Ajouter un ami" onClose={() => router.back()} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StepTitle title="Qui on ajoute ?" subtitle="Entre l’e-mail avec lequel ton pote s’est inscrit sur Hako." />

        <View style={[createCardStyles.whiteCard, styles.field]}>
          <Ionicons name="mail-outline" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.input}
            value={f.email}
            onChangeText={f.setEmail}
            placeholder="email@exemple.com"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => { void search(); }}
          />
          <TouchableOpacity
            style={[styles.searchBtn, !f.canSearch && styles.disabled]}
            onPress={() => { void search(); }}
            disabled={!f.canSearch || f.state === 'searching'}
            accessibilityLabel="Rechercher"
          >
            {f.state === 'searching'
              ? <ActivityIndicator color={Colors.white} />
              : <Ionicons name="search" size={20} color={Colors.white} />}
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {f.state === 'found' && f.found && (
          <Animated.View entering={FadeInDown.duration(300)} style={[createCardStyles.whiteCard, styles.result]}>
            <MemberAvatar member={f.found} size={AVATAR} />
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>{f.found.nickname ?? 'Voyageur'}</Text>
              <Text style={styles.sub} numberOfLines={1}>{f.found.email}</Text>
            </View>
            {f.found.link === 'none' ? (
              <TouchableOpacity style={styles.sendBtn} onPress={() => { void send(); }} disabled={f.sending} activeOpacity={0.85}>
                {f.sending ? <ActivityIndicator color={Colors.white} /> : (
                  <>
                    <Ionicons name="person-add" size={16} color={Colors.white} />
                    <Text style={styles.sendText}>Ajouter</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.status}>
                <Ionicons name={f.found.link === 'accepted' ? 'checkmark-circle' : 'time-outline'} size={16} color={Colors.textMuted} />
                <Text style={styles.statusText}>{f.found.link === 'accepted' ? 'Déjà ami' : 'Demande envoyée'}</Text>
              </View>
            )}
          </Animated.View>
        )}

        {f.state === 'missing' && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.missing}>
            <Ionicons name="paper-plane-outline" size={28} color={Colors.white} />
            <Text style={styles.missingTitle}>Pas encore sur Hako</Text>
            <Text style={styles.missingText}>Personne n’est inscrit avec cette adresse. Envoie-lui un message pour l’inviter à vous rejoindre.</Text>
            <TouchableOpacity style={styles.inviteBtn} onPress={invite} activeOpacity={0.85}>
              <Ionicons name="share-outline" size={18} color={Colors.textPrimary} />
              <Text style={styles.inviteText}>Inviter sur Hako</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.xl, gap: Spacing.md },
  field: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, minHeight: FIELD_HEIGHT, paddingLeft: Spacing.md, paddingRight: Spacing.sm },
  input: { flex: 1, ...Typography.cardTitle, color: Colors.textInk, paddingVertical: Spacing.md },
  searchBtn: { width: SEARCH_BTN, height: SEARCH_BTN, borderRadius: Radii.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  error: { ...Typography.body, color: Colors.negative },
  result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.md },
  name: { ...Typography.cardTitle, color: Colors.textInk },
  sub: { ...Typography.bodySmall, color: Colors.textMuted },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, paddingHorizontal: Spacing.md, height: SEARCH_BTN,
    borderRadius: Radii.full, backgroundColor: Colors.accent,
  },
  sendText: { ...Typography.chip, color: Colors.white },
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  statusText: { ...Typography.chip, color: Colors.textMuted },
  missing: { alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radii.lg, backgroundColor: Colors.primary, ...Shadows.md },
  missingTitle: { ...Typography.cardTitle, color: Colors.white },
  missingText: { ...Typography.body, color: Colors.textOnDark, textAlign: 'center' },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md2, paddingVertical: Spacing.sm2, borderRadius: Radii.full, backgroundColor: Colors.background,
  },
  inviteText: { ...Typography.chip, color: Colors.textPrimary },
});
