import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();

  const handleGoogle = () => {
    // TODO: supabase.auth.signInWithOAuth({ provider: 'google' })
    router.replace('/(tabs)');
  };

  const handleApple = () => {
    // TODO: supabase.auth.signInWithOAuth({ provider: 'apple' })
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.logoBox}>
          <Text style={styles.logo}>HAKO</Text>
          <Text style={styles.logoSub}>Vos voyages, ensemble.</Text>
        </View>
      </View>

      {/* Auth card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Commencer l'aventure</Text>
        <Text style={styles.cardSubtitle}>
          Connecte-toi pour planifier et partager tes voyages avec tes amis
        </Text>

        <View style={styles.buttons}>
          <SocialButton
            icon="logo-google"
            label="Continuer avec Google"
            onPress={handleGoogle}
            style={{ backgroundColor: Colors.white, borderColor: Colors.border }}
            textColor={Colors.textPrimary}
          />
          <SocialButton
            icon="logo-apple"
            label="Continuer avec Apple"
            onPress={handleApple}
            style={{ backgroundColor: Colors.primary }}
            textColor={Colors.white}
            iconColor={Colors.white}
          />
        </View>

        <Text style={styles.terms}>
          En continuant, tu acceptes nos{' '}
          <Text style={styles.termsLink}>Conditions d'utilisation</Text>
          {' '}et notre{' '}
          <Text style={styles.termsLink}>Politique de confidentialité</Text>
        </Text>
      </View>
    </View>
  );
}

function SocialButton({
  icon,
  label,
  onPress,
  style,
  textColor,
  iconColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  style?: object;
  textColor: string;
  iconColor?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.socialBtn, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons name={icon} size={20} color={iconColor ?? Colors.textPrimary} />
      <Text style={[styles.socialBtnText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logo: {
    fontSize: 56,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 8,
  },
  logoSub: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: Spacing.xl,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  buttons: {
    gap: Spacing.sm,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: 'transparent',
    ...Shadows.sm,
  },
  socialBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  terms: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.sm,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
