import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';

/* ─── Password strength ──────────────────────────────────────── */
function getPasswordStrength(pass: string) {
  if (pass.length < 6) return { label: 'Faible', color: '#EF4444', level: 1 };
  if (pass.length >= 9 && (/[0-9]/.test(pass) || /[A-Z]/.test(pass))) {
    return { label: 'Fort', color: '#22C55E', level: 3 };
  }
  return { label: 'Moyen', color: '#F97316', level: 2 };
}

/* ─── Progress dots ──────────────────────────────────────────── */
function ProgressDots({ total, active }: { total: number; active: number }) {
  return (
    <View style={s.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[s.dot, i + 1 === active && s.dotActive]} />
      ))}
    </View>
  );
}

/* ─── Avatar preview (local URI ou initiale) ─────────────────── */
const AVATAR_COLORS = ['#E8C5A5', '#A5B8E0', '#A8D5B5', '#E0A5A5', '#C5A5E8', '#A5E0D5'];

function AvatarPreview({ uri, nickname, size = 120 }: { uri: string | null; nickname: string; size?: number }) {
  const char  = (nickname || '?')[0].toUpperCase();
  const bg    = AVATAR_COLORS[char.charCodeAt(0) % AVATAR_COLORS.length];
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '700', color: '#fff' }}>{char}</Text>
    </View>
  );
}

/* ─── LoginScreen ────────────────────────────────────────────── */
export default function LoginScreen() {
  const insets       = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { signIn }   = useAuth();

  const [mode,     setMode]     = useState<'signin' | 'signup'>('signin');

  /* Sign-in */
  const [siEmail,  setSiEmail]  = useState('');
  const [siPass,   setSiPass]   = useState('');
  const [siLoad,   setSiLoad]   = useState(false);

  /* Sign-up */
  const [step,     setStep]     = useState(1);
  const [nickname, setNickname] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  /* Slide animation */
  const slideX     = useSharedValue(0);
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slideX.value }] }));

  const goToStep = (next: number, dir: 'forward' | 'back' = 'forward') => {
    const out   = dir === 'forward' ? -W : W;
    const enter = dir === 'forward' ?  W : -W;
    slideX.value = withTiming(out, { duration: 260, easing: Easing.in(Easing.cubic) }, () => {
      runOnJS(setStep)(next);
      slideX.value = enter;
      slideX.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    });
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorise l'accès à ta galerie.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const handleSignUp = async () => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nickname } },
      });
      if (authError) throw authError;

      let avatarUrl: string | null = null;
      if (photoUri && authData.user) {
        const ext      = photoUri.split('.').pop() ?? 'jpg';
        const filePath = `${authData.user.id}/profile.${ext}`;
        const formData = new FormData();
        formData.append('file', { uri: photoUri, name: `profile.${ext}`, type: `image/${ext}` } as any);
        await supabase.storage.from('avatars').upload(filePath, formData, { upsert: true, contentType: `image/${ext}` });
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatarUrl = publicUrl;
        await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
      }

      if (authData.user) {
        await supabase.from('profiles').upsert({
          id:         authData.user.id,
          nickname,
          avatar_url: avatarUrl,
          email,
        });
      }

      goToStep(5);
      setTimeout(() => router.replace('/'), 2500);
    } catch (e: unknown) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!siEmail.trim() || !siPass.trim()) {
      Alert.alert('Champs requis', 'Remplis tous les champs.');
      return;
    }
    setSiLoad(true);
    try {
      await signIn(siEmail.trim(), siPass.trim());
    } catch (e: unknown) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Identifiants incorrects.');
    } finally {
      setSiLoad(false);
    }
  };

  const strength = password.length > 0 ? getPasswordStrength(password) : null;

  /* ── Écran de connexion ── */
  if (mode === 'signin') {
    return (
      <KeyboardAvoidingView style={s.siRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[s.siScroll, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.hero}>
            <Text style={s.logo}>HAKO</Text>
            <Text style={s.tagline}>Vos voyages, ensemble.</Text>
          </View>

          <View style={s.siCard}>
            <Text style={s.siCardTitle}>Bon retour ! 👋</Text>

            <View style={s.field}>
              <Text style={s.label}>Adresse email</Text>
              <TextInput
                style={s.input}
                placeholder="vous@exemple.com"
                placeholderTextColor={Colors.textTertiary}
                value={siEmail}
                onChangeText={setSiEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
                editable={!siLoad}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Mot de passe</Text>
              <TextInput
                style={s.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textTertiary}
                value={siPass}
                onChangeText={setSiPass}
                secureTextEntry
                autoComplete="current-password"
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
                editable={!siLoad}
              />
            </View>

            <TouchableOpacity style={[s.btn, siLoad && s.btnDisabled]} onPress={handleSignIn} activeOpacity={0.85} disabled={siLoad}>
              {siLoad ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Se connecter</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setMode('signup'); setStep(1); }} activeOpacity={0.7}>
              <Text style={s.switchText}>
                Pas encore de compte ?{' '}
                <Text style={s.switchLink}>S'inscrire</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  /* ── Flow d'inscription ── */
  return (
    <KeyboardAvoidingView
      style={[s.suRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header : retour + dots */}
      {step < 5 && (
        <View style={s.suHeader}>
          <TouchableOpacity
            style={s.suBack}
            onPress={() => step === 1 ? setMode('signin') : goToStep(step - 1, 'back')}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <ProgressDots total={4} active={step} />
          <View style={{ width: 40 }} />
        </View>
      )}

      {/* Contenu animé */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View style={[{ flex: 1 }, slideStyle]}>

          {/* ── Étape 1 : Prénom ── */}
          {step === 1 && (
            <View style={s.step}>
              <View>
                <Text style={s.stepTitle}>Comment tu{'\n'}t'appelles ?</Text>
                <TextInput
                  style={s.bigInput}
                  placeholder="Ton prénom ou surnom"
                  placeholderTextColor={Colors.textTertiary}
                  value={nickname}
                  onChangeText={setNickname}
                  autoCapitalize="words"
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={() => nickname.trim() && goToStep(2)}
                />
              </View>
              <TouchableOpacity
                style={[s.nextBtn, !nickname.trim() && s.nextBtnDisabled]}
                onPress={() => goToStep(2)}
                disabled={!nickname.trim()}
                activeOpacity={0.85}
              >
                <Text style={s.nextBtnText}>Suivant</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Étape 2 : Photo ── */}
          {step === 2 && (
            <View style={s.step}>
              <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
                <Text style={[s.stepTitle, { textAlign: 'center' }]}>Montre-toi !</Text>
                <Text style={[s.stepSubtitle, { textAlign: 'center' }]}>Choisis ta photo de profil</Text>
                <TouchableOpacity style={s.avatarWrap} onPress={handlePickPhoto} activeOpacity={0.8}>
                  <AvatarPreview uri={photoUri} nickname={nickname} size={120} />
                  <View style={s.cameraBtn}>
                    <Ionicons name="camera" size={18} color="#fff" />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => goToStep(3)} activeOpacity={0.6} style={{ marginTop: Spacing.md }}>
                  <Text style={s.skipText}>Passer</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={s.nextBtn} onPress={() => goToStep(3)} activeOpacity={0.85}>
                <Text style={s.nextBtnText}>Suivant</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Étape 3 : Email ── */}
          {step === 3 && (
            <View style={s.step}>
              <View>
                <Text style={s.stepTitle}>Ton email</Text>
                <Text style={s.stepSubtitle}>On ne t'enverra pas de spam, promis 😉</Text>
                <TextInput
                  style={s.bigInput}
                  placeholder="tu@exemple.com"
                  placeholderTextColor={Colors.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={() => email.trim() && goToStep(4)}
                />
              </View>
              <TouchableOpacity
                style={[s.nextBtn, !email.trim() && s.nextBtnDisabled]}
                onPress={() => goToStep(4)}
                disabled={!email.trim()}
                activeOpacity={0.85}
              >
                <Text style={s.nextBtnText}>Suivant</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Étape 4 : Mot de passe ── */}
          {step === 4 && (
            <View style={s.step}>
              <View>
                <Text style={s.stepTitle}>Choisis un{'\n'}mot de passe</Text>
                <View style={s.passWrap}>
                  <TextInput
                    style={[s.bigInput, { marginTop: 0, paddingRight: 52 }]}
                    placeholder="••••••••"
                    placeholderTextColor={Colors.textTertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                    autoComplete="new-password"
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => password.length >= 6 && handleSignUp()}
                  />
                  <TouchableOpacity onPress={() => setShowPass(v => !v)} style={s.eyeBtn} activeOpacity={0.7}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={22} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                {strength && (
                  <View style={s.strengthRow}>
                    <View style={s.strengthBars}>
                      {[1, 2, 3].map(lvl => (
                        <View
                          key={lvl}
                          style={[s.strengthBar, { backgroundColor: lvl <= strength.level ? strength.color : Colors.border }]}
                        />
                      ))}
                    </View>
                    <Text style={[s.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[s.nextBtn, (password.length < 6 || loading) && s.nextBtnDisabled]}
                onPress={handleSignUp}
                disabled={password.length < 6 || loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.nextBtnText}>Créer mon compte</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* ── Étape 5 : Bienvenue ── */}
          {step === 5 && (
            <View style={s.welcomeStep}>
              <AvatarPreview uri={photoUri} nickname={nickname} size={120} />
              <Text style={[s.stepTitle, { textAlign: 'center', marginTop: Spacing.xl }]}>
                Bienvenue {nickname} ! 🎉
              </Text>
              <Text style={[s.stepSubtitle, { textAlign: 'center' }]}>
                Prêt pour ta prochaine aventure ?
              </Text>
            </View>
          )}

        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  /* ── Sign-in ── */
  siRoot:      { flex: 1, backgroundColor: Colors.primary },
  siScroll:    { flexGrow: 1, justifyContent: 'space-between' },
  hero:        { alignItems: 'center', paddingBottom: 48, gap: Spacing.sm },
  logo:        { fontSize: 60, fontWeight: '900', color: '#fff', letterSpacing: 10 },
  tagline:     { fontSize: 15, color: 'rgba(255,255,255,0.60)', fontWeight: '500', letterSpacing: 0.5 },
  siCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  siCardTitle: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', lineHeight: 33, letterSpacing: -0.3, marginBottom: Spacing.sm },
  field:       { gap: 6 },
  label:       { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.2 },
  input: {
    height: 52,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.offWhite,
  },
  btn:         { height: 52, borderRadius: Radii.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs, ...Shadows.md },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  switchText:  { textAlign: 'center', fontSize: 13, color: Colors.textTertiary, marginTop: Spacing.xs },
  switchLink:  { color: Colors.primary, fontWeight: '700' },

  /* ── Sign-up ── */
  suRoot:   { flex: 1, backgroundColor: Colors.background },
  suHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  suBack:   { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  dotsRow:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { width: 24, backgroundColor: Colors.primary },

  step: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: Spacing.lg,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  stepTitle:    { fontSize: 34, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5, lineHeight: 40 },
  stepSubtitle: { fontSize: 15, color: Colors.textSecondary, marginTop: 8, lineHeight: 22 },

  bigInput: {
    height: 56,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    fontSize: 17,
    color: Colors.textPrimary,
    backgroundColor: Colors.offWhite,
    marginTop: Spacing.xl,
  },

  nextBtn:         { height: 56, borderRadius: Radii.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadows.md },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  /* Photo */
  avatarWrap: { position: 'relative', marginTop: Spacing.xxl },
  cameraBtn: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  skipText: { fontSize: 14, color: Colors.textTertiary, fontWeight: '500', textAlign: 'center' },

  /* Password */
  passWrap:     { position: 'relative', marginTop: Spacing.xl },
  eyeBtn:       { position: 'absolute', right: 14, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  strengthRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
  strengthBar:  { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '700', minWidth: 44 },

  /* Welcome */
  welcomeStep: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: Spacing.sm,
  },
});
