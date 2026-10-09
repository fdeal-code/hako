// HAKO — État vide des cartes
// Affiché à la place d'une MapView quand aucune coordonnée n'est
// disponible (trip sans coordonnées + aucune wish localisée), au lieu
// de centrer arbitrairement la carte (ancien fallback Paris).

import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing } from '@/constants/theme';

const ICON_SIZE = 28;
export const MAP_EMPTY_MESSAGE = 'Ajoute un lieu pour activer la carte';

interface MapEmptyStateProps {
  /** 'dark' sur fonds sombres (cards glass, vue plein écran), 'light' sinon. */
  tone?: 'light' | 'dark';
}

export function MapEmptyState({ tone = 'light' }: MapEmptyStateProps) {
  const color = tone === 'dark' ? Colors.textInverted : Colors.textSecondary;
  return (
    <View style={styles.root}>
      <Ionicons name="map-outline" size={ICON_SIZE} color={color} />
      <Text style={[styles.text, { color }]}>{MAP_EMPTY_MESSAGE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    opacity: 0.85,
  },
  text: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
