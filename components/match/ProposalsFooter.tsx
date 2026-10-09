// HAKO — Footer de l'écran propositions (verdict rendu)
// 3 états : match terminé (→ voir le voyage), creator (→ créer le
// voyage), participant (→ attente du creator).

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { Colors, Radii, Spacing } from '@/constants/theme';

interface ProposalsFooterProps {
  isCompleted: boolean;
  tripId: string | null;
  isCreator: boolean;
  creating: boolean;
  winnerDestination: string;
  bottomPadding: number;
  onCreateTrip: () => void;
}

export function ProposalsFooter({
  isCompleted, tripId, isCreator, creating, winnerDestination, bottomPadding, onCreateTrip,
}: ProposalsFooterProps) {
  return (
    <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
      {isCompleted ? (
        tripId !== null ? (
          <TouchableOpacity
            style={styles.cta}
            onPress={() => router.replace(`/trip/${tripId}/dashboard`)}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaLabel}>Voir le voyage</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.info}>Ce match est terminé.</Text>
        )
      ) : isCreator ? (
        <TouchableOpacity
          style={[styles.cta, creating && styles.ctaDisabled]}
          onPress={onCreateTrip}
          disabled={creating}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaLabel}>
            {creating ? 'Création…' : `Créer le voyage à ${winnerDestination}`}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.info}>Le créateur du match lance le voyage… ✈️</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingTop: Spacing.sm },
  cta: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.5 },
  ctaLabel: { color: Colors.textInverted, fontSize: 16, fontWeight: '700' },
  info: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
