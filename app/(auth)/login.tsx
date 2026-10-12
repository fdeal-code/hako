// HAKO — Connexion / inscription (maquettes V2)
// Accueil (logo, promesse, deux boutons) → connexion (+ mot de passe oublié)
// ou inscription en 4 étapes : pseudo, photo, e-mail, mot de passe. Si le
// projet demande de confirmer l'e-mail, on termine sur « vérifie ta boîte ».
// Une fois la session ouverte, AuthGate (app/_layout.tsx) redirige.

import { ComponentProps, ReactNode, useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TextInputProps,
  TouchableOpacity, View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Fonts, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import {
  CreateTripHeader, ProgressSegments, StepActions, StepTitle, createCardStyles,
} from '@/components/createTrip/CreateTripChrome';
import { SIGNUP_STEPS, useAuthFlow } from '@/hooks/useAuthFlow';
import { MIN_NICKNAME, MIN_PASSWORD, PasswordStrength } from '@/utils/authValidation';

type IconName = ComponentProps<typeof Ionicons>['name'];

const AVATAR = 132;
const CTA_HEIGHT = 60;
const BADGE = 40;
const STRENGTH_BAR = 6;

const PROMISES: { icon: IconName; text: string }[] = [
  { icon: 'heart-outline', text: 'Les envies de tout le groupe, TikTok compris' },
  { icon: 'calendar-outline', text: 'Un planning jour par jour, sur une carte' },
  { icon: 'wallet-outline', text: 'Les comptes faits tout seuls à la fin' },
];

const STRENGTH: Record<PasswordStrength, { label: string; color: string; level: number }> = {
  faible: { label: 'Faible', color: Colors.negative, level: 1 },
  moyen: { label: 'Moyen', color: Colors.accent, level: 2 },
  fort: { label: 'Fort', color: Colors.positive, level: 3 },
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const a = useAuthFlow();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const run = async (action: () => Promise<string | null>) => {
    setError(null);
    setError(await action());
  };

  const forgot = async () => {
    setError(null);
    const err = await a.resetPassword();
    if (err) { setError(err); return; }
    Alert.alert('E-mail envoyé', `Un lien pour choisir un nouveau mot de passe est parti vers ${a.email.trim()}.`);
  };

  const switchTo = (mode: Parameters<typeof a.go>[0]) => { setError(null); a.go(mode); };

  // ─── Accueil ──────────────────────────────────────────────────────────────
  if (a.mode === 'welcome') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + Spacing.xxl, paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.welcomeTop}>
          <Text style={styles.logo}>hako</Text>
          <Text style={styles.tagline}>La boîte où tu mets tout pour organiser un voyage entre potes.</Text>
        </Animated.View>

        <View style={styles.promises}>
          {PROMISES.map((p, i) => (
            <Animated.View key={p.text} entering={FadeInDown.delay(150 + i * 100).duration(400)} style={styles.promise}>
              <View style={styles.promiseIcon}><Ionicons name={p.icon} size={20} color={Colors.white} /></View>
              <Text style={styles.promiseText}>{p.text}</Text>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeIn.delay(500)} style={styles.welcomeActions}>
          <TouchableOpacity style={styles.ctaAccent} onPress={() => switchTo('signup')} activeOpacity={0.85} accessibilityRole="button">
            <Text style={styles.ctaText}>Créer mon compte</Text>
            <Ionicons name="arrow-forward" size={22} color={Colors.textInverted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaGhost} onPress={() => switchTo('signin')} activeOpacity={0.85} accessibilityRole="button">
            <Text style={styles.ctaGhostText}>J’ai déjà un compte</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // ─── Fin d'inscription ────────────────────────────────────────────────────
  if (a.mode === 'signup' && a.step === 'done') {
    return (
      <View style={[styles.root, styles.done, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.doneBody}>
          <View style={styles.doneIcon}>
            <Ionicons name={a.needsConfirmation ? 'mail-unread-outline' : 'sparkles'} size={36} color={Colors.white} />
          </View>
          <Text style={styles.doneTitle}>{a.needsConfirmation ? 'Vérifie ta boîte mail' : `Bienvenue ${a.nickname.trim()} !`}</Text>
          <Text style={styles.doneText}>
            {a.needsConfirmation
              ? `On t’a envoyé un lien de confirmation à ${a.email.trim()}. Clique dessus, puis reviens te connecter.`
              : 'Ton compte est prêt. On t’emmène à tes voyages…'}
          </Text>
        </Animated.View>
        {a.needsConfirmation && (
          <TouchableOpacity style={styles.ctaAccent} onPress={() => switchTo('signin')} activeOpacity={0.85} accessibilityRole="button">
            <Text style={styles.ctaText}>J’ai confirmé, me connecter</Text>
            <Ionicons name="arrow-forward" size={22} color={Colors.textInverted} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ─── Connexion ou étape d'inscription ─────────────────────────────────────
  const signin = a.mode === 'signin';
  const step = a.step === 'done' ? SIGNUP_STEPS : a.step;
  const strength = a.strength ? STRENGTH[a.strength] : null;

  const passwordField = (
    <Field
      icon="lock-closed-outline"
      value={a.password}
      onChangeText={a.setPassword}
      placeholder="Mot de passe"
      secureTextEntry={!showPassword}
      autoComplete={signin ? 'current-password' : 'new-password'}
      textContentType={signin ? 'password' : 'newPassword'}
      returnKeyType="go"
      onSubmitEditing={() => { void run(signin ? a.signIn : a.next); }}
      right={(
        <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={12} accessibilityLabel={showPassword ? 'Masquer' : 'Afficher'}>
          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      )}
    />
  );

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CreateTripHeader title={signin ? 'Connexion' : 'Inscription'} />
      {!signin && <ProgressSegments total={SIGNUP_STEPS} current={step} />}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View key={signin ? 'signin' : `step-${step}`} entering={FadeInRight.duration(300)}>
          {signin && (
            <>
              <StepTitle title="Content de te revoir" subtitle="Connecte-toi pour retrouver tes voyages." />
              <View style={[createCardStyles.whiteCard, styles.card]}>
                <Field
                  icon="mail-outline"
                  value={a.email}
                  onChangeText={a.setEmail}
                  placeholder="ton@email.com"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  autoFocus
                />
                <View style={styles.divider} />
                {passwordField}
              </View>
              <TouchableOpacity onPress={() => { void forgot(); }} style={styles.link} hitSlop={8}>
                <Text style={styles.linkText}>Mot de passe oublié ?</Text>
              </TouchableOpacity>
            </>
          )}

          {!signin && step === 1 && (
            <>
              <StepTitle title="Comment on t’appelle ?" subtitle="C’est ce que verront tes potes dans le groupe." />
              <View style={[createCardStyles.whiteCard, styles.card]}>
                <Field
                  icon="person-outline"
                  value={a.nickname}
                  onChangeText={a.setNickname}
                  placeholder="Ton prénom ou ton pseudo"
                  autoCapitalize="words"
                  autoComplete="nickname"
                  autoFocus
                  maxLength={30}
                  returnKeyType="next"
                  onSubmitEditing={() => { void run(a.next); }}
                />
              </View>
              <Text style={styles.hint}>{MIN_NICKNAME} caractères minimum.</Text>
            </>
          )}

          {!signin && step === 2 && (
            <>
              <StepTitle title="Une photo ?" subtitle="Pour qu’on te reconnaisse sur les envies et les votes. Tu pourras la changer plus tard." />
              <View style={styles.avatarWrap}>
                <TouchableOpacity onPress={() => { void a.pickPhoto(); }} activeOpacity={0.85} accessibilityLabel="Choisir une photo">
                  {a.photoUri
                    ? <Image source={{ uri: a.photoUri }} style={styles.avatar} />
                    : (
                      <View style={[styles.avatar, styles.avatarEmpty]}>
                        <Text style={styles.avatarInitial}>{(a.nickname.trim()[0] ?? '?').toUpperCase()}</Text>
                      </View>
                    )}
                  <View style={styles.avatarBadge}>
                    <Ionicons name={a.photoUri ? 'pencil' : 'camera'} size={18} color={Colors.white} />
                  </View>
                </TouchableOpacity>
                {a.photoUri && (
                  <TouchableOpacity onPress={() => a.setPhotoUri(null)} hitSlop={8}>
                    <Text style={styles.linkText}>Retirer la photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {!signin && step === 3 && (
            <>
              <StepTitle title="Ton e-mail" subtitle="Pour te connecter et recevoir les invitations de tes potes." />
              <View style={[createCardStyles.whiteCard, styles.card]}>
                <Field
                  icon="mail-outline"
                  value={a.email}
                  onChangeText={a.setEmail}
                  placeholder="ton@email.com"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={() => { void run(a.next); }}
                />
              </View>
            </>
          )}

          {!signin && step === 4 && (
            <>
              <StepTitle title="Un mot de passe" subtitle={`Au moins ${MIN_PASSWORD} caractères. Un chiffre ou une majuscule le rend plus solide.`} />
              <View style={[createCardStyles.whiteCard, styles.card]}>{passwordField}</View>
              {strength && (
                <View style={styles.strength}>
                  <View style={styles.strengthBars}>
                    {[1, 2, 3].map(l => (
                      <View key={l} style={[styles.strengthBar, l <= strength.level && { backgroundColor: strength.color }]} />
                    ))}
                  </View>
                  <Text style={[styles.strengthText, { color: strength.color }]}>{strength.label}</Text>
                </View>
              )}
            </>
          )}

          {error ? (
            <Animated.View entering={FadeIn} style={styles.error}>
              <Ionicons name="alert-circle" size={18} color={Colors.negative} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <StepActions
        onBack={() => { setError(null); a.back(); }}
        onNext={() => { void run(signin ? a.signIn : a.next); }}
        label={signin ? 'Se connecter' : step === SIGNUP_STEPS ? 'Créer mon compte' : step === 2 && !a.photoUri ? 'Passer' : 'Continuer'}
        icon={!signin && step === SIGNUP_STEPS ? 'checkmark' : 'arrow-forward'}
        variant={signin || step === SIGNUP_STEPS ? 'accent' : 'dark'}
        disabled={!signin && !a.canContinue}
        loading={a.busy}
        bottomInset={insets.bottom}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Champ de saisie d'une carte blanche ────────────────────────────────────
function Field({ icon, right, ...input }: TextInputProps & { icon: IconName; right?: ReactNode }) {
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={20} color={Colors.textMuted} />
      <TextInput
        style={styles.input}
        placeholderTextColor={Colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        {...input}
      />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.xl, paddingBottom: Spacing.xl },

  // Accueil
  welcomeTop: { paddingHorizontal: Spacing.md2, gap: Spacing.sm },
  logo: { ...Typography.titleHero, fontFamily: Fonts.displayBold, fontWeight: undefined, color: Colors.textPrimary },
  tagline: { ...Typography.section, color: Colors.textMuted },
  promises: { flex: 1, justifyContent: 'center', gap: Spacing.sm2, paddingHorizontal: Spacing.md2 },
  promise: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.sm2,
    borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card,
  },
  promiseIcon: { width: BADGE, height: BADGE, borderRadius: Radii.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  promiseText: { flex: 1, ...Typography.rowTitle, color: Colors.textInk },
  welcomeActions: { paddingHorizontal: Spacing.md2, gap: Spacing.sm },
  ctaAccent: {
    height: CTA_HEIGHT, borderRadius: Radii.full, backgroundColor: Colors.accent,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, ...Shadows.md,
  },
  ctaText: { ...Typography.button, color: Colors.textInverted },
  ctaGhost: {
    height: CTA_HEIGHT, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaGhostText: { ...Typography.button, color: Colors.textPrimary },

  // Champs
  card: { paddingHorizontal: Spacing.md },
  field: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, minHeight: CTA_HEIGHT },
  input: { flex: 1, ...Typography.cardTitle, color: Colors.textInk, paddingVertical: Spacing.md },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  hint: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: Spacing.sm, marginLeft: Spacing.xs },
  link: { alignSelf: 'flex-end', marginTop: Spacing.sm2 },
  linkText: { ...Typography.chip, color: Colors.accent },

  // Photo
  avatarWrap: { alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: Radii.full, backgroundColor: Colors.line },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.borderDark },
  avatarInitial: { ...Typography.displayTitle, color: Colors.textMuted },
  avatarBadge: {
    position: 'absolute', right: 0, bottom: 0, width: BADGE, height: BADGE, borderRadius: Radii.full,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.background,
  },

  // Force du mot de passe
  strength: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, marginTop: Spacing.sm2, marginHorizontal: Spacing.xs },
  strengthBars: { flex: 1, flexDirection: 'row', gap: Spacing.xs },
  strengthBar: { flex: 1, height: STRENGTH_BAR, borderRadius: Radii.full, backgroundColor: Colors.line },
  strengthText: { ...Typography.chip },

  // Erreur
  error: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md,
    padding: Spacing.sm2, borderRadius: Radii.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.negative,
  },
  errorText: { flex: 1, ...Typography.body, color: Colors.textInk },

  // Fin
  done: { justifyContent: 'space-between', paddingHorizontal: Spacing.md2 },
  doneBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  doneIcon: { width: AVATAR * 0.6, height: AVATAR * 0.6, borderRadius: Radii.full, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', ...Shadows.md },
  doneTitle: { ...Typography.displayTitle, color: Colors.textPrimary, textAlign: 'center' },
  doneText: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
});
