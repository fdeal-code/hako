// HAKO — Étoiles (affichage d'une moyenne, ou saisie d'une note 1 → 5)

import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing } from '@/constants/theme';

const STARS = [1, 2, 3, 4, 5] as const;
const HALF = 0.5;

export function StarRating({ value, size = 18, onChange, color = Colors.accent }: {
  value: number | null;
  size?: number;
  onChange?: (rating: number) => void;
  color?: string;
}) {
  const current = value ?? 0;
  return (
    <View style={styles.row} accessibilityLabel={value ? `${value.toFixed(1)} sur 5` : 'Pas encore noté'}>
      {STARS.map(star => {
        const icon = current >= star ? 'star' : current >= star - HALF ? 'star-half' : 'star-outline';
        const glyph = <Ionicons name={icon} size={size} color={color} />;
        if (!onChange) return <View key={star}>{glyph}</View>;
        return (
          <TouchableOpacity key={star} onPress={() => onChange(star)} hitSlop={4} accessibilityLabel={`${star} étoile${star > 1 ? 's' : ''}`}>
            {glyph}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.xs / 2 },
});
