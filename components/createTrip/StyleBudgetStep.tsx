// HAKO — Création · étape 6 « Votre style ? » (maquette « V2 · 5 Style & budget »)
// Type de voyage (pastilles) + budget par personne traduit en repères concrets.
// Optionnel : sert à filtrer les suggestions « On t'aide ».

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { SectionLabel, createCardStyles as card } from '@/components/createTrip/CreateTripChrome';
import { BUDGET_PRESETS, TRIP_VIBES, TripVibe } from '@/types/tripStyle';
import { BUDGET_STEP, activitiesPerDay, clampBudget, lodgingPerNight } from '@/utils/tripBudget';

interface StyleBudgetStepProps {
  vibes: readonly TripVibe[];
  onToggleVibe: (vibe: TripVibe) => void;
  budget: number | null;
  onBudgetChange: (budget: number | null) => void;
  totalNights: number;
}

const DEFAULT_BUDGET = 600;
const STEPPER_SIZE = 40;

export function StyleBudgetStep({ vibes, onToggleVibe, budget, onBudgetChange, totalNights }: StyleBudgetStepProps) {
  const amount = budget ?? DEFAULT_BUDGET;

  return (
    <View style={styles.wrap}>
      <SectionLabel right="plusieurs choix">Type de voyage</SectionLabel>
      <View style={styles.vibes}>
        {TRIP_VIBES.map(vibe => {
          const active = vibes.includes(vibe.id);
          return (
            <TouchableOpacity
              key={vibe.id}
              style={[styles.vibe, active && styles.vibeActive]}
              onPress={() => onToggleVibe(vibe.id)}
              activeOpacity={0.85}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.vibeText, active && styles.vibeTextActive]}>{vibe.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.budgetLabel}>
        <SectionLabel right="hors transport">Budget par personne</SectionLabel>
      </View>
      <View style={[card.whiteCard, styles.card]}>
        <View style={styles.amountRow}>
          <TouchableOpacity
            style={[styles.stepBtn, styles.stepBtnGhost]}
            onPress={() => onBudgetChange(clampBudget(amount - BUDGET_STEP))}
            accessibilityLabel="Baisser le budget"
          >
            <Ionicons name="remove" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.amountCenter}>
            <Text style={[styles.amount, budget === null && styles.amountUnset]}>~ {amount} €</Text>
            <Text style={styles.amountSub}>pour {totalNights} nuit{totalNights > 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity
            style={[styles.stepBtn, styles.stepBtnFilled]}
            onPress={() => onBudgetChange(clampBudget(amount + BUDGET_STEP))}
            accessibilityLabel="Augmenter le budget"
          >
            <Ionicons name="add" size={20} color={Colors.textInverted} />
          </TouchableOpacity>
        </View>

        <View style={styles.presets}>
          {BUDGET_PRESETS.map(preset => {
            const active = budget === preset.amount;
            return (
              <TouchableOpacity
                key={preset.label}
                style={[styles.preset, active && styles.presetActive]}
                onPress={() => onBudgetChange(preset.amount)}
                activeOpacity={0.85}
              >
                <Text style={[styles.presetText, active && styles.presetTextActive]}>{preset.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {budget !== null && totalNights > 0 && (
          <View style={styles.translation}>
            <Text style={styles.translationMain}>
              On cherchera des logements ≈ {lodgingPerNight(amount, totalNights)} €/nuit/pers
            </Text>
            <Text style={styles.translationSub}>
              et des activités ≈ {activitiesPerDay(amount, totalNights)} €/jour/pers
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm2 - 2 },
  vibes: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  vibe: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm2,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
  },
  vibeActive: { backgroundColor: Colors.primary },
  vibeText: { ...Typography.filter, color: Colors.textPrimary },
  vibeTextActive: { color: Colors.textInverted },
  budgetLabel: { marginTop: Spacing.lg },
  card: { padding: Spacing.md2, gap: Spacing.md },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amountCenter: { alignItems: 'center' },
  amount: { ...Typography.displayTitle, color: Colors.textPrimary },
  amountUnset: { color: Colors.textTertiary },
  amountSub: { ...Typography.bodySmall, color: Colors.textMuted },
  stepBtn: {
    width: STEPPER_SIZE,
    height: STEPPER_SIZE,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnGhost: { borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.background },
  stepBtnFilled: { backgroundColor: Colors.primary },
  presets: { flexDirection: 'row', gap: Spacing.sm },
  preset: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  presetActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  presetText: { ...Typography.filter, color: Colors.textPrimary },
  presetTextActive: { color: Colors.textInverted },
  translation: { gap: Spacing.xs, paddingTop: Spacing.sm2, borderTopWidth: 1, borderTopColor: Colors.line },
  translationMain: { fontSize: 13, fontWeight: '600', color: Colors.textInk },
  translationSub: { ...Typography.bodySmall, color: Colors.accent },
});
