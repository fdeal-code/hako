// HAKO — Question 3 : budget (slider 100 → 1000 €, pas de 50)
// Slider custom Reanimated + gesture-handler (pas de dépendance externe).
// Montant central éditable au tap (saisie libre jusqu'à BUDGET_HARD_MAX ;
// au-delà de 1000 le slider se cale au max).

import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';

export const BUDGET_MIN = 100;
export const BUDGET_MAX = 1000;       // borne haute du slider
export const BUDGET_HARD_MAX = 10000; // plafond de la saisie libre
export const BUDGET_STEP = 50;
export const BUDGET_DEFAULT = 400;

const THUMB_SIZE = 28;
const TRACK_HEIGHT = 6;
const AMOUNT_INPUT_MAX_LENGTH = 5;
const EDIT_ICON_SIZE = 18;

interface BudgetCaption {
  upTo: number;
  text: string;
}

export const BUDGET_CAPTIONS: readonly BudgetCaption[] = [
  { upTo: 250,  text: 'Auberge, pasta et bons plans 🍝' },
  { upTo: 450,  text: 'Confort malin, apéros au coucher de soleil 🌅' },
  { upTo: 700,  text: 'Petits hôtels stylés et bons restos 🥂' },
  { upTo: BUDGET_MAX, text: 'On se fait plaisir, zéro compromis ✨' },
  { upTo: BUDGET_HARD_MAX, text: 'Villa, rooftop et champagne — on vise grand 🛥️' },
];

function captionFor(budget: number): string {
  return BUDGET_CAPTIONS.find(c => budget <= c.upTo)?.text ?? '';
}

function toStep(ratio: number): number {
  const raw = BUDGET_MIN + ratio * (BUDGET_MAX - BUDGET_MIN);
  const stepped = Math.round(raw / BUDGET_STEP) * BUDGET_STEP;
  return Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, stepped));
}

interface QuestionBudgetProps {
  value: number | undefined;
  onChange: (budget: number) => void;
}

export function QuestionBudget({ value, onChange }: QuestionBudgetProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const budget = value ?? BUDGET_DEFAULT;

  // Pré-remplit la valeur par défaut pour que l'étape compte comme répondue
  useEffect(() => {
    if (value === undefined) onChange(BUDGET_DEFAULT);
  }, [value, onChange]);

  // Au-delà de BUDGET_MAX (saisie libre), le slider se cale au max
  const ratio = Math.min(1, (budget - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN));
  const thumbLeft = Math.max(0, ratio * trackWidth - THUMB_SIZE / 2);

  const updateFromX = (x: number) => {
    if (trackWidth <= 0) return;
    const next = toStep(Math.min(1, Math.max(0, x / trackWidth)));
    if (next !== budget) onChange(next);
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(e => updateFromX(e.x))
    .onUpdate(e => updateFromX(e.x))
    .runOnJS(true);

  const startEditing = () => {
    setDraft(String(budget));
    setEditing(true);
  };

  const commitDraft = () => {
    const parsed = parseInt(draft, 10);
    if (!Number.isNaN(parsed)) {
      onChange(Math.min(BUDGET_HARD_MAX, Math.max(BUDGET_MIN, parsed)));
    }
    setEditing(false);
  };

  return (
    <View style={styles.root}>
      <View style={styles.amountBox}>
        {editing ? (
          <View style={styles.amountRow}>
            <TextInput
              style={styles.amountInput}
              value={draft}
              onChangeText={t => setDraft(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={AMOUNT_INPUT_MAX_LENGTH}
              autoFocus
              onBlur={commitDraft}
              onSubmitEditing={commitDraft}
              returnKeyType="done"
            />
            <Text style={styles.amount}>€</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={startEditing} activeOpacity={0.7} style={styles.amountRow}>
            <Text style={styles.amount}>{budget} €</Text>
            <Ionicons name="pencil" size={EDIT_ICON_SIZE} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
        <Text style={styles.perPerson}>par personne · tape le montant pour saisir librement</Text>
      </View>

      <Text style={styles.caption}>{captionFor(budget)}</Text>

      <GestureDetector gesture={pan}>
        <View
          style={styles.trackHitBox}
          onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
        >
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${ratio * 100}%` }]} />
          </View>
          <View style={[styles.thumb, { left: thumbLeft }]} />
        </View>
      </GestureDetector>

      <View style={styles.bounds}>
        <Text style={styles.boundLabel}>{BUDGET_MIN} €</Text>
        <Text style={styles.boundLabel}>{BUDGET_MAX} €+</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', gap: Spacing.md },
  amountBox: { alignItems: 'center', gap: Spacing.xs },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  amount: { ...Typography.displayAmount, color: Colors.textPrimary },
  amountInput: {
    ...Typography.displayAmount,
    color: Colors.textPrimary,
    minWidth: 120,
    textAlign: 'center',
    padding: 0,
  },
  perPerson: { ...Typography.bodySmall, color: Colors.textMuted },
  caption: {
    textAlign: 'center',
    ...Typography.body,
    color: Colors.textMuted,
    minHeight: 20,
  },
  trackHitBox: { justifyContent: 'center', height: THUMB_SIZE + Spacing.md },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: Radii.full,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  trackFill: { height: '100%', backgroundColor: Colors.primary },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.primary,
    ...Shadows.sm,
  },
  bounds: { flexDirection: 'row', justifyContent: 'space-between' },
  boundLabel: { ...Typography.bodySmall, color: Colors.textSecondary },
});
