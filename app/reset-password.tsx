// HAKO — Nouveau mot de passe (ouvert par le lien « Mot de passe oublié »)
// Lien reçu par e-mail → hako://reset-password#access_token=… → on ouvre la
// session de récupération, on choisit le nouveau mot de passe, puis direction
// l'accueil (déjà connecté).

import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, StepActions, StepTitle, createCardStyles } from '@/components/createTrip/CreateTripChrome';
import { useResetPassword } from '@/hooks/useResetPassword';
import { MIN_PASSWORD, PasswordStrength } from '@/utils/authValidation';

const FIELD_HEIGHT = 60;
const BIG_ICON = 72;
const STRENGTH_BAR = 6;

const STRENGTH: Record<PasswordStrength, { label: string; color: string; level: number }> = {
  faible: { label: 'Faible', color: Colors.negative, level: 1 },
  moyen: { label: 'Moyen', color: Colors.accent, level: 2 },
  fort: { label: 'Fort', color: Colors.positive, level: 3 },
};

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const r = useResetPassword();
  const [visible, setVisible] = useState(false);
  const home = () => router.replace('/(tabs)');
  const toLogin = () => router.replace('/(auth)/login');

  if (r.step === 'opening') {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.muted}>On vérifie ton lien…</Text>
      </View>
    );
  }

  if (r.step === 'invalid' || r.step === 'done') {
    const done = r.step === 'done';
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <CreateTripHeader title="Mot de passe" />
        <View style={[styles.center, styles.flex]}>
          <Animated.View entering={ZoomIn.springify()} style={[styles.bigIcon, done ? styles.bigIconDone : styles.bigIconError]}>
            <Ionicons name={done ? 'checkmark' : 'alert'} size={34} color={Colors.white} />
          </Animated.View>
          <Text style={styles.bigTitle}>{done ? 'C’est fait !' : 'Lien expiré'}</Text>
          <Text style={styles.muted}>{done ? 'Ton nouveau mot de passe est enregistré.' : r.error}</Text>
        </View>
        <StepActions
          onBack={done ? home : toLogin}
          onNext={done ? home : toLogin}
          label={done ? 'Aller à mes voyages' : 'Retour à la connexion'}
          variant="accent"
          bottomInset={insets.bottom}
        />
      </View>
    );
  }

  const strength = r.strength ? STRENGTH[r.strength] : null;
  const field = (value: string, onChange: (v: string) => void, placeholder: string, autoFocus = false) => (
    <View style={[createCardStyles.whiteCard, styles.field]}>
      <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSecondary}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        autoFocus={autoFocus}
      />
      <TouchableOpacity onPress={() => setVisible(v => !v)} hitSlop={12} accessibilityLabel={visible ? 'Masquer' : 'Afficher'}>
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CreateTripHeader title="Mot de passe" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <StepTitle title="Nouveau mot de passe" subtitle={`Au moins ${MIN_PASSWORD} caractères. Un chiffre ou une majuscule le rend plus solide.`} />
        <View style={styles.fields}>
          {field(r.password, r.setPassword, 'Nouveau mot de passe', true)}
          {strength && (
            <View style={styles.strength}>
              <View style={styles.bars}>
                {[1, 2, 3].map(l => <View key={l} style={[styles.bar, l <= strength.level && { backgroundColor: strength.color }]} />)}
              </View>
              <Text style={[styles.strengthText, { color: strength.color }]}>{strength.label}</Text>
            </View>
          )}
          {field(r.confirm, r.setConfirm, 'Confirme le mot de passe')}
          {r.mismatch && <Text style={styles.error}>Les deux mots de passe ne sont pas identiques.</Text>}
          {r.error ? <Text style={styles.error}>{r.error}</Text> : null}
        </View>
      </ScrollView>
      <StepActions
        onBack={toLogin}
        onNext={() => { void r.save(); }}
        label="Enregistrer"
        icon="checkmark"
        variant="accent"
        disabled={!r.canSave}
        loading={r.step === 'saving'}
        bottomInset={insets.bottom}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.xl, paddingBottom: Spacing.xl },
  fields: { gap: Spacing.sm2 },
  field: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, minHeight: FIELD_HEIGHT, paddingHorizontal: Spacing.md },
  input: { flex: 1, ...Typography.cardTitle, color: Colors.textInk, paddingVertical: Spacing.md },
  strength: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, marginHorizontal: Spacing.xs },
  bars: { flex: 1, flexDirection: 'row', gap: Spacing.xs },
  bar: { flex: 1, height: STRENGTH_BAR, borderRadius: Radii.full, backgroundColor: Colors.line },
  strengthText: { ...Typography.chip },
  error: { ...Typography.body, color: Colors.negative, marginLeft: Spacing.xs },
  muted: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  bigIcon: { width: BIG_ICON, height: BIG_ICON, borderRadius: Radii.full, alignItems: 'center', justifyContent: 'center', ...Shadows.md },
  bigIconDone: { backgroundColor: Colors.positive },
  bigIconError: { backgroundColor: Colors.negative },
  bigTitle: { ...Typography.displayTitle, color: Colors.textPrimary, textAlign: 'center' },
});
