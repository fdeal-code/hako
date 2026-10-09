// HAKO — Modifier le profil (page plein écran, remplace l'ancienne feuille)
// Photo (tap pour changer) + pseudo ; « Enregistrer » en bas.

import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, SectionLabel, StepActions, StepTitle, createCardStyles } from '@/components/createTrip/CreateTripChrome';
import { useEditProfile } from '@/hooks/useEditProfile';

const AVATAR = 132;
const BADGE = 40;
const FIELD_HEIGHT = 60;
const MAX_NICKNAME = 30;

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const e = useEditProfile();
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const err = await e.save();
    if (err) setError(err); else router.back();
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CreateTripHeader title="Mon profil" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <StepTitle title="Modifier le profil" subtitle="Ce que voient tes potes dans les voyages." />

        <View style={styles.avatarWrap}>
          <TouchableOpacity onPress={() => { void e.pickPhoto(); }} activeOpacity={0.85} accessibilityLabel="Changer la photo">
            {e.previewUri
              ? <Image source={{ uri: e.previewUri }} style={styles.avatar} />
              : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <Text style={styles.initial}>{(e.nickname.trim()[0] ?? '?').toUpperCase()}</Text>
                </View>
              )}
            <View style={styles.badge}><Ionicons name="camera" size={18} color={Colors.white} /></View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { void e.pickPhoto(); }} hitSlop={8}>
            <Text style={styles.link}>Changer la photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <SectionLabel>Pseudo</SectionLabel>
          <View style={[createCardStyles.whiteCard, styles.field]}>
            <Ionicons name="person-outline" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={e.nickname}
              onChangeText={e.setNickname}
              placeholder="Ton prénom ou ton pseudo"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="words"
              maxLength={MAX_NICKNAME}
              returnKeyType="done"
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>E-mail</SectionLabel>
          <View style={[createCardStyles.whiteCard, styles.field]}>
            <Ionicons name="mail-outline" size={20} color={Colors.textMuted} />
            <Text style={[styles.input, styles.readonly]} numberOfLines={1}>{e.email}</Text>
            <Ionicons name="lock-closed" size={16} color={Colors.textSecondary} />
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <StepActions
        onBack={() => router.back()}
        onNext={() => { void save(); }}
        label="Enregistrer"
        icon="checkmark"
        variant="accent"
        disabled={!e.canSave}
        loading={e.saving}
        bottomInset={insets.bottom}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.lg },
  avatarWrap: { alignItems: 'center', gap: Spacing.sm2 },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: Radii.full, backgroundColor: Colors.line },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  initial: { ...Typography.displayTitle, color: Colors.textMuted },
  badge: {
    position: 'absolute', right: 0, bottom: 0, width: BADGE, height: BADGE, borderRadius: Radii.full,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.background,
  },
  link: { ...Typography.chip, color: Colors.accent },
  section: { gap: 0 },
  field: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, minHeight: FIELD_HEIGHT, paddingHorizontal: Spacing.md },
  input: { flex: 1, ...Typography.cardTitle, color: Colors.textInk, paddingVertical: Spacing.md },
  readonly: { color: Colors.textMuted },
  error: { ...Typography.body, color: Colors.negative },
});
