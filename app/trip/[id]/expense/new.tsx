// HAKO — Ajouter une dépense (page plein écran, remplace AddExpenseModal)
// 3 étapes façon création de voyage : c'est quoi (montant en grand, titre,
// catégorie, jour) → qui a payé → pour qui (part de chacun en direct).

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import {
  CreateTripHeader, ProgressSegments, SectionLabel, StepActions, StepTitle, createCardStyles,
} from '@/components/createTrip/CreateTripChrome';
import { DayChip } from '@/components/planning/PlanningParts';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { EXPENSE_STEPS, useAddExpense } from '@/hooks/useAddExpense';
import { BudgetMember, EXPENSE_CATEGORIES } from '@/types/budget';

const AVATAR = 44;
const CHECK = 26;
const FIELD_HEIGHT = 60;
const NO_DOTS: readonly string[] = [];

function euros(n: number): string {
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;
}

export default function NewExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = id ?? '';
  const insets = useSafeAreaInsets();
  const x = useAddExpense(tripId);
  const [error, setError] = useState<string | null>(null);

  const next = async () => {
    setError(null);
    const result = await x.next();
    if (result === 'saved') router.back();
    else if (result) setError(result);
  };
  const back = () => { setError(null); if (!x.back()) router.back(); };

  const name = (m: BudgetMember) => (m.id === x.me ? 'Toi' : m.nickname);
  const payer = x.members?.find(m => m.id === x.payerId);
  const allSelected = !!x.members && x.splitIds.length === x.members.length;

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CreateTripHeader title="Nouvelle dépense" onClose={() => router.back()} />
      <ProgressSegments total={EXPENSE_STEPS} current={x.step} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View key={x.step} entering={FadeInRight.duration(300)}>
          {x.step === 1 && (
            <>
              <StepTitle title="C’est quoi ?" subtitle="Le montant total payé, on fera le partage après." />

              <View style={styles.amountRow}>
                <TextInput
                  style={styles.amountInput}
                  value={x.amountText}
                  onChangeText={x.setAmountText}
                  placeholder="0"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="decimal-pad"
                  autoFocus
                  maxLength={9}
                  accessibilityLabel="Montant"
                />
                <Text style={styles.amountUnit}>€</Text>
              </View>

              <View style={[createCardStyles.whiteCard, styles.field]}>
                <Ionicons name="create-outline" size={20} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  value={x.title}
                  onChangeText={x.setTitle}
                  placeholder="Resto, taxi aéroport, courses…"
                  placeholderTextColor={Colors.textSecondary}
                  maxLength={60}
                  returnKeyType="done"
                />
              </View>

              <View style={styles.block}>
                <SectionLabel>Catégorie</SectionLabel>
                <View style={styles.cats}>
                  {Object.entries(EXPENSE_CATEGORIES).map(([key, meta]) => {
                    const active = x.category === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.cat, active && styles.catActive]}
                        onPress={() => x.setCategory(key)}
                        activeOpacity={0.85}
                        accessibilityState={{ selected: active }}
                      >
                        <Ionicons name={meta.icon} size={20} color={active ? Colors.white : Colors.textPrimary} />
                        <Text style={[styles.catLabel, active && styles.catLabelActive]}>{meta.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {x.days.length > 1 && (
                <View style={styles.block}>
                  <SectionLabel>Quel jour ?</SectionLabel>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
                    {x.days.map(d => (
                      <DayChip key={d} day={d} active={d === x.day} isToday={d === x.today} dotColors={NO_DOTS} onPress={() => x.setDay(d)} />
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          )}

          {x.step === 2 && (
            <>
              <StepTitle title="Qui a payé ?" subtitle={x.amount ? `${euros(x.amount)} · ${x.title.trim()}` : undefined} />
              <View style={[createCardStyles.whiteCard, styles.list]}>
                {(x.members ?? []).map((m, i) => {
                  const active = m.id === x.payerId;
                  return (
                    <TouchableOpacity key={m.id} style={[styles.row, i > 0 && styles.rowBorder]} onPress={() => x.setPayerId(m.id)} activeOpacity={0.85}>
                      <MemberAvatar member={{ avatar_url: m.avatarUrl, nickname: m.nickname }} size={AVATAR} />
                      <Text style={styles.rowTitle}>{name(m)}</Text>
                      <View style={[styles.radio, active && styles.radioActive]}>
                        {active && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {x.step === 3 && (
            <>
              <StepTitle title="Pour qui ?" subtitle={payer ? `Payé par ${name(payer) === 'Toi' ? 'toi' : name(payer)}, partagé à parts égales.` : undefined} />
              <TouchableOpacity style={styles.allRow} onPress={x.splitAll} disabled={allSelected} activeOpacity={0.85}>
                <Ionicons name={allSelected ? 'checkmark-circle' : 'people-outline'} size={18} color={allSelected ? Colors.accent : Colors.textPrimary} />
                <Text style={styles.allText}>{allSelected ? 'Tout le monde' : 'Sélectionner tout le monde'}</Text>
              </TouchableOpacity>
              <View style={[createCardStyles.whiteCard, styles.list]}>
                {(x.members ?? []).map((m, i) => {
                  const active = x.splitIds.includes(m.id);
                  return (
                    <TouchableOpacity key={m.id} style={[styles.row, i > 0 && styles.rowBorder]} onPress={() => x.toggleSplit(m.id)} activeOpacity={0.85}>
                      <MemberAvatar member={{ avatar_url: m.avatarUrl, nickname: m.nickname }} size={AVATAR} />
                      <Text style={[styles.rowTitle, !active && styles.rowOff]}>{name(m)}</Text>
                      {active && x.amount ? <Text style={styles.share}>{euros(x.perPerson)}</Text> : null}
                      <View style={[styles.check, active && styles.checkActive]}>
                        {active && <Ionicons name="checkmark" size={16} color={Colors.white} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {x.splitIds.length > 0 && x.amount ? (
                <Animated.View entering={FadeIn} style={styles.summary}>
                  <Text style={styles.summaryAmount}>{euros(x.perPerson)}</Text>
                  <Text style={styles.summaryText}>
                    par personne · {x.splitIds.length} {x.splitIds.length > 1 ? 'personnes' : 'personne'}
                  </Text>
                </Animated.View>
              ) : null}
            </>
          )}

          {x.loadError ? <Text style={styles.error}>{x.loadError}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Animated.View>
      </ScrollView>

      <StepActions
        onBack={back}
        onNext={() => { void next(); }}
        label={x.step === EXPENSE_STEPS ? 'Ajouter la dépense' : 'Continuer'}
        icon={x.step === EXPENSE_STEPS ? 'add' : 'arrow-forward'}
        variant={x.step === EXPENSE_STEPS ? 'accent' : 'dark'}
        disabled={!x.canContinue || x.members === null}
        loading={x.saving}
        bottomInset={insets.bottom}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.xl, paddingBottom: Spacing.xl },
  block: { marginTop: Spacing.lg },

  amountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  amountInput: { ...Typography.displayAmount, color: Colors.textPrimary, minWidth: Spacing.xxl, textAlign: 'center', padding: 0 },
  amountUnit: { ...Typography.displayAmount, color: Colors.textMuted },

  field: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, minHeight: FIELD_HEIGHT, paddingHorizontal: Spacing.md },
  input: { flex: 1, ...Typography.cardTitle, color: Colors.textInk, paddingVertical: Spacing.md },

  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cat: {
    flexBasis: '31%', flexGrow: 1, alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm2,
    borderRadius: Radii.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderDark,
  },
  catActive: { backgroundColor: Colors.primary, borderColor: Colors.primary, ...Shadows.md },
  catLabel: { ...Typography.chip, color: Colors.textPrimary },
  catLabelActive: { color: Colors.white },
  days: { gap: Spacing.sm, paddingRight: Spacing.md2 },

  list: { paddingHorizontal: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, paddingVertical: Spacing.sm2 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  rowTitle: { flex: 1, ...Typography.rowTitle, color: Colors.textInk },
  rowOff: { color: Colors.textSecondary },
  share: { ...Typography.chip, color: Colors.textMuted },
  radio: { width: CHECK, height: CHECK, borderRadius: Radii.full, borderWidth: 2, borderColor: Colors.borderDark, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: Colors.accent },
  radioDot: { width: CHECK / 2, height: CHECK / 2, borderRadius: Radii.full, backgroundColor: Colors.accent },
  check: { width: CHECK, height: CHECK, borderRadius: Radii.full, borderWidth: 2, borderColor: Colors.borderDark, alignItems: 'center', justifyContent: 'center' },
  checkActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },

  allRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, alignSelf: 'flex-start', marginBottom: Spacing.sm2 },
  allText: { ...Typography.chip, color: Colors.textPrimary },

  summary: {
    flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginTop: Spacing.md,
    padding: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.primary, ...Shadows.md,
  },
  summaryAmount: { ...Typography.displayValue, color: Colors.white },
  summaryText: { ...Typography.body, color: Colors.textOnDark },

  error: { ...Typography.body, color: Colors.negative, marginTop: Spacing.md },
});
