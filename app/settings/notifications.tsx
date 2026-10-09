// HAKO — Réglages des notifications : seulement ce qui mérite de déranger
// Spec : docs/FEATURES.md → « Notifications » (tableau anti-spam).

import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { NavButton } from '@/components/ui/NavButton';
import { useNotificationPrefs } from '@/hooks/useNotificationPrefs';
import { NOTIFICATION_CATEGORIES, NotificationCategoryDef } from '@/types/notificationPrefs';

const SECTIONS: { id: NotificationCategoryDef['section']; label: string }[] = [
  { id: 'live',    label: 'En direct' },
  { id: 'digest',  label: 'En résumé' },
  { id: 'silence', label: 'Silence' },
];
const BOTTOM_NAV_SPACE = 110;

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { isEnabled, toggle } = useNotificationPrefs();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BOTTOM_NAV_SPACE }]}>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.intro}>Seulement ce qui mérite de te déranger.</Text>

        {SECTIONS.map(section => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionLabel}>{section.label}</Text>
            <View style={styles.card}>
              {NOTIFICATION_CATEGORIES.filter(c => c.section === section.id).map((def, i) => (
                <View key={def.category} style={[styles.row, i > 0 && styles.rowDivider]}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{def.label}</Text>
                    <Text style={styles.rowHint}>
                      {def.hint}{def.frequency ? ` · ${def.frequency}` : ''}
                    </Text>
                  </View>
                  <Switch
                    value={isEnabled(def.category)}
                    onValueChange={() => { void toggle(def.category); }}
                    trackColor={{ false: Colors.border, true: Colors.accent }}
                    thumbColor={Colors.white}
                    accessibilityLabel={def.label}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.promise}>Hako ne t’enverra jamais de pub.</Text>
      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <NavButton icon="chevron-back" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md2, gap: Spacing.md },
  title: { ...Typography.titlePage, color: Colors.textPrimary, marginTop: Spacing.md },
  intro: { ...Typography.body, color: Colors.textSecondary, marginTop: -Spacing.sm },
  section: { gap: Spacing.sm },
  sectionLabel: {
    ...Typography.bodySmall,
    fontWeight: '800',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, paddingVertical: Spacing.sm2 },
  rowDivider: { borderTopWidth: 1, borderTopColor: Colors.border },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
  rowHint: { ...Typography.bodySmall, color: Colors.textSecondary },
  promise: { ...Typography.bodySmall, fontWeight: '700', color: Colors.accent },
  bottomNav: { position: 'absolute', left: Spacing.md2, bottom: 0 },
});
