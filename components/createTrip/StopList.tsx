// HAKO — Création : villes du voyage (maquette « V2 · 1 Destinations »)
// Cartes blanches numérotées dans la couleur de la ville, réordonnables
// (flèches) et supprimables.

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { SectionLabel, createCardStyles as card } from '@/components/createTrip/CreateTripChrome';
import { StopDraft } from '@/types/tripStops';
import { stopColor } from '@/utils/tripStops';

interface StopListProps {
  stops: readonly StopDraft[];
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}

const BADGE_SIZE = 28;
const ROW_HEIGHT = 64;
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

export function StopList({ stops, onRemove, onMove }: StopListProps) {
  if (stops.length === 0) return null;
  const isMulti = stops.length > 1;

  return (
    <View style={styles.wrap}>
      <SectionLabel>{isMulti ? `Ton itinéraire · ${stops.length} étapes` : 'Ta destination'}</SectionLabel>
      {stops.map((stop, index) => (
        <View key={`${stop.place_id ?? stop.description}-${index}`} style={[card.whiteCard, styles.row]}>
          <View style={[styles.badge, { backgroundColor: stopColor(index, Colors.stopPalette) }]}>
            <Text style={styles.badgeText}>{index + 1}</Text>
          </View>
          <View style={styles.text}>
            <Text style={card.cardTitle} numberOfLines={1}>{stop.place_name}</Text>
            {stop.secondary_text.length > 0 && (
              <Text style={card.cardSub} numberOfLines={1}>{stop.secondary_text}</Text>
            )}
          </View>
          {isMulti && (
            <View style={styles.moves}>
              <TouchableOpacity
                onPress={() => onMove(index, -1)}
                disabled={index === 0}
                hitSlop={HIT_SLOP}
                accessibilityLabel={`Monter ${stop.place_name}`}
              >
                <Ionicons name="chevron-up" size={18} color={index === 0 ? Colors.textTertiary : Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onMove(index, 1)}
                disabled={index === stops.length - 1}
                hitSlop={HIT_SLOP}
                accessibilityLabel={`Descendre ${stop.place_name}`}
              >
                <Ionicons name="chevron-down" size={18} color={index === stops.length - 1 ? Colors.textTertiary : Colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity onPress={() => onRemove(index)} hitSlop={HIT_SLOP} accessibilityLabel={`Retirer ${stop.place_name}`}>
            <Ionicons name="close" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      ))}
      {isMulti && <Text style={styles.hint}>Utilise les flèches pour changer l’ordre des étapes.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.sm2 - 2,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm2,
    paddingLeft: Spacing.sm2,
    paddingRight: Spacing.md2,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textInverted,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  moves: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  hint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
});
