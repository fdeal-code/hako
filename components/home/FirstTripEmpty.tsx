// HAKO — Accueil : premier lancement (maquette « Accueil · Premier lancement »)

import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Fonts, Radii, Shadows, Spacing, Typography } from '@/constants/theme';

const LOGO = 64;
const STEP_BADGE = 28;
const STEPS = [
  { title: 'Crée le voyage', sub: 'Villes, dates, potes : 1 minute' },
  { title: 'Invite la bande', sub: 'Un lien WhatsApp, et c’est parti' },
  { title: 'Votez, réservez, partez', sub: 'Hako s’occupe du reste' },
];
const STEP_COLORS = [Colors.primary, Colors.accent, Colors.textMuted];

export function FirstTripEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <View style={styles.logo}><Text style={styles.logoText}>H</Text></View>
        <Text style={styles.title}>Ton premier voyage commence ici</Text>
        <Text style={styles.sub}>Une boîte pour tout mettre : envies, votes, planning, budget.</Text>
        <TouchableOpacity style={[styles.btn, styles.btnAccent]} onPress={onCreate} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color={Colors.textInverted} />
          <Text style={[styles.btnText, styles.btnTextOn]}>Créer un voyage</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnGhost]}
          onPress={() => Alert.alert('Lien d’invitation', 'Ouvre le lien reçu (WhatsApp, SMS…) : il t’amène directement dans le voyage.')}
          activeOpacity={0.85}
        >
          <Ionicons name="link" size={18} color={Colors.textPrimary} />
          <Text style={styles.btnText}>J’ai un lien d’invitation</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>COMMENT ÇA MARCHE</Text>
      <View style={styles.steps}>
        {STEPS.map((step, i) => (
          <View key={step.title} style={[styles.step, i > 0 && styles.stepDivider]}>
            <View style={[styles.badge, { backgroundColor: STEP_COLORS[i] }]}>
              <Text style={styles.badgeText}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepSub}>{step.sub}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  hero: {
    alignItems: 'center', gap: Spacing.sm2 + 2,
    paddingHorizontal: Spacing.md2, paddingTop: Spacing.lg, paddingBottom: Spacing.md2,
    borderRadius: Radii.pill, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.primary,
  },
  logo: {
    width: LOGO, height: LOGO, borderRadius: Radii.md, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center', ...Shadows.md,
  },
  logoText: { fontFamily: Fonts.displayBold, fontSize: 32, color: Colors.white },
  title: { fontFamily: Fonts.display, fontSize: 24, color: Colors.textPrimary, textAlign: 'center' },
  sub: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  btn: {
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.md - 2, borderRadius: Radii.full,
  },
  btnAccent: { backgroundColor: Colors.accent, ...Shadows.md },
  btnGhost: { borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.surface },
  btnText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  btnTextOn: { color: Colors.white },
  label: { ...Typography.displayLabel, color: Colors.textPrimary },
  steps: { paddingHorizontal: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, paddingVertical: Spacing.sm2 - 2 },
  stepDivider: { borderTopWidth: 1, borderTopColor: Colors.line },
  badge: { width: STEP_BADGE, height: STEP_BADGE, borderRadius: Radii.full, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 13, fontWeight: '600', color: Colors.white },
  stepTitle: { fontSize: 14, fontWeight: '600', color: Colors.textInk },
  stepSub: { ...Typography.bodySmall, color: Colors.textMuted },
});
