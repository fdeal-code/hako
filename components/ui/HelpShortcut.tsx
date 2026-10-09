// HAKO — Raccourci « On t'aide » (en-têtes Envies / Planning)
// Ouvre les suggestions logements / activités du voyage.

import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Shadows, Spacing } from '@/constants/theme';

interface HelpShortcutProps {
  tripId: string;
  tab: 'lodging' | 'activities';
}

export function HelpShortcut({ tripId, tab }: HelpShortcutProps) {
  return (
    <TouchableOpacity
      style={styles.pill}
      onPress={() => router.push({ pathname: '/trip/[id]/help', params: { id: tripId, tab } })}
      activeOpacity={0.85}
      accessibilityLabel="Ouvrir On t’aide"
    >
      <Ionicons name="sparkles" size={13} color={Colors.textInverted} />
      <Text style={styles.text}>On t’aide</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm2 + 2,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    backgroundColor: Colors.accent,
    borderWidth: 1,
    borderColor: Colors.primary,
    ...Shadows.md,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textInverted,
  },
});
