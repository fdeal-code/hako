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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [mode,     setMode]     = useState<'signin' | 'signup'>('signin');
  const [email,    setEmail]    = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const isSignUp = mode === 'signup';

  const handleSubmit = async () => {
    const trimmedEmail    = email.trim();
    const trimmedNickname = nickname.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Champs requis', 'Veuillez remplir tous les champs.');
      return;
    }
    if (isSignUp && !trimmedNickname) {
      Alert.alert('Champs requis', 'Veuillez choisir un surnom.');
      return;
    }

    try {
      setLoading(true);
      if (isSignUp) {
        await signUp(trimmedEmail, trimmedPassword, trimmedNickname);
        Alert.alert(
          'Compte créé !',
          'Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.',
        );
      } else {
        await signIn(trimmedEmail, trimmedPassword);
        // onAuthStateChange → AuthGate redirige automatiquement vers /(tabs)
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Une erreur est survenue.';
      Alert.alert('Erreur', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <Text style={styles.logo}>HAKO</Text>
          <Text style={styles.tagline}>Vos voyages, ensemble.</Text>
        </View>

        {/* ── Card ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Prêt pour votre{'\n'}prochaine aventure ?
          </Text>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Adresse email</Text>
            <TextInput
              style={styles.input}
              placeholder="vous@exemple.com"
              placeholderTextColor={Colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
              editable={!loading}
            />
          </View>

          {/* Nickname — signup only */}
          {isSignUp && (
            <View style={styles.field}>
              <Text style={styles.label}>Surnom</Text>
              <TextInput
                style={styles.input}
                placeholder="Comment on t'appelle ?"
                placeholderTextColor={Colors.textTertiary}
                value={nickname}
                onChangeText={setNickname}
                autoCapitalize="words"
                autoComplete="nickname"
                returnKeyType="next"
                editable={!loading}
              />
            </View>
          )}

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              editable={!loading}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>
                  {isSignUp ? "S'inscrire" : 'Se connecter'}
                </Text>
            }
          </TouchableOpacity>

          {/* Switch mode */}
          <TouchableOpacity
            onPress={() => setMode(isSignUp ? 'signin' : 'signup')}
            activeOpacity={0.7}
            disabled={loading}
          >
            <Text style={styles.switchText}>
              {isSignUp
                ? 'Déjà un compte ? '
                : 'Pas encore de compte ? '}
              <Text style={styles.switchLink}>
                {isSignUp ? 'Se connecter' : "S'inscrire"}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },

  /* Hero */
  hero: {
    alignItems: 'center',
    paddingBottom: 48,
    gap: Spacing.sm,
  },
  logo: {
    fontSize: 60,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 10,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.60)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },

  /* Card */
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 33,
    letterSpacing: -0.3,
    marginBottom: Spacing.sm,
  },

  /* Fields */
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
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

  /* Button */
  btn: {
    height: 52,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
    ...Shadows.md,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* Switch */
  switchText: {
    textAlign: 'center',
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  switchLink: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
