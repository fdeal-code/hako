// HAKO — Saisie du prix (par personne) et de la durée d'une envie
// Pastilles rapides (Gratuit, 10 €, 20 €, 50 € · 30 min → Journée) + prix libre.
// Utilisé à l'ajout d'une envie et dans sa fiche détail.

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { DURATION_PRESETS, formatPrice, parsePrice, PRICE_PRESETS } from '@/utils/wishPriceDuration';

interface PriceDurationFieldsProps {
  price: number | null;
  duration: number | null;
  onPriceChange: (price: number | null) => void;
  onDurationChange: (minutes: number | null) => void;
}

export function PriceDurationFields({ price, duration, onPriceChange, onDurationChange }: PriceDurationFieldsProps) {
  const isPreset = price !== null && (PRICE_PRESETS as readonly number[]).includes(price);
  const [custom, setCustom] = useState(price !== null && !isPreset ? String(price).replace('.', ',') : '');

  const pickPrice = (value: number) => {
    setCustom('');
    onPriceChange(price === value ? null : value);
  };
  const commitCustom = () => {
    const parsed = parsePrice(custom);
    onPriceChange(parsed);
    if (parsed === null) setCustom('');
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.block}>
        <Text style={styles.label}>PRIX PAR PERSONNE</Text>
        <View style={styles.row}>
          {PRICE_PRESETS.map(p => {
            const active = price === p && custom === '';
            return (
              <TouchableOpacity key={p} style={[styles.chip, active && styles.chipActive]} onPress={() => pickPrice(p)} accessibilityState={{ selected: active }}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{formatPrice(p)}</Text>
              </TouchableOpacity>
            );
          })}
          <View style={[styles.input, custom !== '' && styles.inputActive]}>
            <TextInput
              style={styles.inputText}
              value={custom}
              onChangeText={setCustom}
              onBlur={commitCustom}
              onSubmitEditing={commitCustom}
              placeholder="Autre"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              returnKeyType="done"
              maxLength={7}
            />
            <Text style={styles.euro}>€</Text>
          </View>
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>DURÉE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {DURATION_PRESETS.map(d => {
            const active = duration === d.minutes;
            return (
              <TouchableOpacity
                key={d.minutes}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onDurationChange(active ? null : d.minutes)}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{d.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  block: { gap: Spacing.sm },
  label: { ...Typography.displayLabel, color: Colors.textPrimary },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.background,
  },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { ...Typography.chip, color: Colors.textPrimary },
  chipTextActive: { color: Colors.white },
  input: {
    flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 92,
    paddingHorizontal: Spacing.md, borderRadius: Radii.full, backgroundColor: Colors.surface, ...Shadows.sm,
  },
  inputActive: { borderWidth: 1, borderColor: Colors.accent },
  inputText: { flex: 1, paddingVertical: Spacing.sm, ...Typography.chip, color: Colors.textInk },
  euro: { ...Typography.chip, color: Colors.textMuted },
});
