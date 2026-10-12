/**
 * BudgetScreen — suivi des dépenses d'un voyage
 * Tables: expenses, expense_splits, profiles, trip_members
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Fonts, Spacing, Radii, Shadows, Typography } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BACK_ICON, NavButton, floatingNavBottom, floatingNavSpace } from '@/components/ui/NavButton';
import { FilterButton } from '@/components/ui/FilterButton';

/* ─── Types ──────────────────────────────────────────────────────── */
interface DbSplit   { id: string; expense_id: string; user_id: string; amount: number; }
interface DbExpense { id: string; trip_id: string; paid_by: string; title: string; amount: number; category: string; date: string | null; notes: string | null; expense_splits: DbSplit[]; stop_id?: string | null; }

interface Member    { id: string; nickname: string | null; avatar_url: string | null; }

/* ─── Constants ──────────────────────────────────────────────────── */

const FILTER_CATS = [
  { key: 'all',           label: 'Tout',         emoji: '' },
  { key: 'food',          label: 'Repas',        emoji: '🍽️' },
  { key: 'transport',     label: 'Transport',    emoji: '✈️' },
  { key: 'accommodation', label: 'Logement',     emoji: '🏨' },
  { key: 'activity',      label: 'Activités',    emoji: '🎭' },
  // « Courses » = 'shopping' : valeur acceptée par la contrainte expenses_category_check
  { key: 'shopping',      label: 'Courses',      emoji: '🛒' },
  { key: 'other',         label: 'Autre',        emoji: '📦' },
];




/* Icône Ionicons par catégorie (cartes « Dernières dépenses » des maquettes V2) */
const CAT_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  food: 'restaurant-outline', transport: 'airplane-outline', accommodation: 'bed-outline',
  activity: 'ticket-outline', shopping: 'cart-outline', other: 'cube-outline',
};
const BALANCE_EPSILON = 0.01;

/* ─── Helpers ────────────────────────────────────────────────────── */
function fmtShort(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k €';
  return n.toFixed(0) + ' €';
}
function memberName(members: Member[], id: string, currentUserId: string) {
  if (id === currentUserId) return 'Toi';
  return members.find(m => m.id === id)?.nickname ?? 'Membre';
}

/* ─── ExpenseItem (swipe to delete) ─────────────────────────────── */
function ExpenseItem({
  exp, members, currentUserId, onDeleted,
}: {
  exp: DbExpense;
  members: Member[];
  currentUserId: string;
  onDeleted: (id: string) => void;
}) {
  const swipeRef   = useRef<Swipeable>(null);
  const rowHeight  = useSharedValue(-1);
  const opacity    = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => {
    if (rowHeight.value === -1) return { opacity: opacity.value };
    return { height: rowHeight.value, opacity: opacity.value, overflow: 'hidden' as const };
  });

  const handleLayout = (e: any) => {
    if (rowHeight.value === -1) rowHeight.value = e.nativeEvent.layout.height;
  };

  const doDelete = useCallback(async () => {
    await supabase.from('expense_splits').delete().eq('expense_id', exp.id);
    await supabase.from('expenses').delete().eq('id', exp.id);
    opacity.value   = withTiming(0, { duration: 180 });
    rowHeight.value = withTiming(0, { duration: 260 }, (finished) => {
      if (finished) runOnJS(onDeleted)(exp.id);
    });
  }, [exp.id, onDeleted, opacity, rowHeight]);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      'Supprimer cette dépense ?',
      `"${exp.title}" sera définitivement supprimée.`,
      [
        { text: 'Annuler', style: 'cancel', onPress: () => swipeRef.current?.close() },
        { text: 'Supprimer', style: 'destructive', onPress: doDelete },
      ],
    );
  }, [exp.title, doDelete]);

  const renderRightActions = () => (
    <TouchableOpacity style={s.deleteAction} onPress={confirmDelete} activeOpacity={0.85}>
      <Ionicons name="close-circle-outline" size={28} color="#fff" />
    </TouchableOpacity>
  );

  const payer      = memberName(members, exp.paid_by, currentUserId);
  const splitCount = exp.expense_splits.length || 1;
  const perPerson  = exp.amount / splitCount;

  return (
    <Reanimated.View style={animStyle} onLayout={handleLayout}>
      <Swipeable
        ref={swipeRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        rightThreshold={40}
      >
        <View style={s.expenseCard}>
          <View style={s.expTitleRow}>
            <Ionicons name={CAT_ICON[exp.category] ?? CAT_ICON.other} size={16} color={Colors.textInk} />
            <Text style={s.expTitle} numberOfLines={1}>{exp.title}</Text>
          </View>
          <View style={s.expMetaRow}>
            <Text style={s.expMeta}>{fmtShort(exp.amount)}</Text>
            <Text style={s.expMeta}>Payé par {payer}</Text>
            {splitCount > 1 && <Text style={s.expMetaMuted}>{fmtShort(perPerson)}/pers.</Text>}
            {exp.date && <Text style={s.expMetaMuted}>{exp.date.slice(8, 10)}/{exp.date.slice(5, 7)}</Text>}
          </View>
        </View>
      </Swipeable>
    </Reanimated.View>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export default function BudgetScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const insets         = useSafeAreaInsets();
  const { session }    = useAuth();
  const currentUserId  = session?.user?.id ?? '';

  const [expenses, setExpenses] = useState<DbExpense[]>([]);
  const [members,  setMembers]  = useState<Member[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');

  const fetchData = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    const { data: membersList } = await supabase.from('trip_members').select('user_id').eq('trip_id', tripId);
    const profiles: Member[] = [];
    for (const m of (membersList ?? [])) {
      const { data } = await supabase.from('profiles').select('id, nickname, avatar_url').eq('id', m.user_id).single();
      if (data) profiles.push(data);
    }
    setMembers(profiles);
    const { data: expData } = await supabase.from('expenses').select('*, expense_splits(*)').eq('trip_id', tripId).order('date', { ascending: false });
    setExpenses((expData ?? []) as DbExpense[]);
    setLoading(false);
  }, [tripId]);

  useFocusEffect(useCallback(() => { void fetchData(); }, [fetchData])); // rechargé au retour de « Nouvelle dépense »

  const handleExpenseDeleted = useCallback((id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  }, []);

  const total    = expenses.reduce((s, e) => s + e.amount, 0);
  const filtered = filter === 'all' ? expenses : expenses.filter(e => e.category === filter);
  /* Le total suit le filtre : « REPAS · 416 € » quand on filtre sur Repas */
  const shownTotal = filtered.reduce((acc, e) => acc + e.amount, 0);
  const perPerson = members.length > 0 ? shownTotal / members.length : 0;
  const filterLabel = FILTER_CATS.find(c => c.key === filter)?.label ?? '';
  const myBalance = (() => {
    let v = 0;
    for (const exp of expenses) {
      if (exp.paid_by === currentUserId) v += exp.amount;
      for (const split of exp.expense_splits) if (split.user_id === currentUserId) v -= split.amount;
    }
    return v;
  })();
  const openAdd = () => router.push({ pathname: '/trip/[id]/expense/new', params: { id: tripId ?? '' } });
  const openBalance = () => router.push({ pathname: '/trip/[id]/balance', params: { id: tripId ?? '' } });

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Budget</Text>
      </View>

      {/* ── Filtres catégories (maquette : sous le titre) ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterStrip} contentContainerStyle={s.filterRow}>
        {FILTER_CATS.map(cat => (
          <FilterButton key={cat.key} label={cat.label} active={filter === cat.key} onPress={() => setFilter(cat.key)} />
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.scroll, { paddingBottom: floatingNavSpace(insets.bottom) }]}
        >
          {/* ── Total dépensé ── */}
          <View style={s.totalCard}>
            <Text style={s.totalLabel}>{filter === 'all' ? 'TOTAL DÉPENSÉ' : `${filterLabel.toUpperCase()} · ${Math.round((shownTotal / Math.max(total, 1)) * 100)} % DU TOTAL`}</Text>
            <Text style={s.totalAmount} adjustsFontSizeToFit numberOfLines={1}>{fmtShort(shownTotal)}</Text>
            <View style={s.totalPerRow}>
              <Text style={s.totalPerAmount}>{fmtShort(perPerson)}</Text>
              <Text style={s.totalPerLabel}>par personne</Text>
            </View>
          </View>

          {/* ── Équilibre (page dédiée : qui doit quoi, par ville, par catégorie) ── */}
          {total > 0 && (
            <TouchableOpacity style={s.balanceLink} onPress={openBalance} activeOpacity={0.85} accessibilityRole="button">
              <View style={s.balanceLinkIcon}>
                <Ionicons name="pie-chart-outline" size={20} color={Colors.white} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.balanceName}>Équilibre</Text>
                <Text style={[s.balanceLabel, myBalance < -BALANCE_EPSILON && s.balanceNegative]}>
                  {Math.abs(myBalance) < BALANCE_EPSILON ? 'Tu es à jour'
                    : myBalance > 0 ? `On te doit ${fmtShort(myBalance)}` : `Tu dois ${fmtShort(-myBalance)}`}
                  {' · qui doit quoi, par ville, par catégorie'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textInk} />
            </TouchableOpacity>
          )}

          {/* ── Dernières dépenses ── */}
          <View style={s.block}>
            <Text style={s.sectionTitle}>DERNIÈRES DÉPENSES</Text>
            {filtered.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyText}>Aucune dépense pour l’instant.</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={openAdd} activeOpacity={0.8}>
                  <Text style={s.emptyBtnText}>Ajouter une dépense</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.expenseList}>
                {filtered.map(exp => (
                  <ExpenseItem
                    key={exp.id}
                    exp={exp}
                    members={members}
                    currentUserId={currentUserId}
                    onDeleted={handleExpenseDeleted}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ── Bottom nav ── */}
      <View style={[s.bottomNav, { bottom: floatingNavBottom(insets.bottom) }]} pointerEvents="box-none">
        <NavButton icon={BACK_ICON} onPress={() => router.back()} />
        <NavButton icon="add" iconSize={28} variant="accent" onPress={openAdd} />
        <NavButton icon="pie-chart-outline" onPress={openBalance} />
      </View>

    </View>
  );
}

/* ─── Main Styles ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.background },
  header:      { paddingHorizontal: Spacing.md2, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  headerTitle: { ...Typography.displayTitle, color: Colors.textPrimary },
  bottomNav:   { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 14, zIndex: 10 },

  filterStrip: { flexGrow: 0, maxHeight: 64 },
  filterRow:   { gap: Spacing.sm, paddingHorizontal: Spacing.md2, paddingVertical: Spacing.sm2, alignItems: 'center' as const },
  scroll:      { paddingHorizontal: Spacing.md2, paddingTop: Spacing.sm2, gap: Spacing.sm2 },

  totalCard: {
    height: 150, borderRadius: Radii.pill, padding: Spacing.md2,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'space-between', ...Shadows.md,
  },
  totalLabel:     { alignSelf: 'flex-start', ...Typography.displayLabel, color: Colors.surfaceAlt },
  totalAmount:    { fontFamily: Fonts.display, fontSize: 48, color: Colors.white },
  totalPerRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  totalPerAmount: { ...Typography.displayLabel, color: Colors.accent },
  totalPerLabel:  { ...Typography.body, color: Colors.offWhite },

  block:        { gap: Spacing.sm2 },
  sectionTitle: { ...Typography.displayLabel, color: Colors.textPrimary, paddingTop: Spacing.sm },

  balanceLink: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2,
    padding: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card,
  },
  balanceLinkIcon: {
    width: 40, height: 40, borderRadius: Radii.full, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  balanceName:     { ...Typography.cardTitle, color: Colors.textInk },
  balanceLabel:    { ...Typography.bodySmall, color: Colors.textMuted },
  balanceAmount:   { ...Typography.cardTitle, color: Colors.textInk },
  balanceNegative: { color: Colors.accent },

  cityCard: { padding: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.surface, gap: Spacing.sm, ...Shadows.card },
  memberSpendRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 5 },
  memberSpendHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  memberSpendName:   { fontSize: 14, fontWeight: '600', color: Colors.textInk },
  memberSpendAmount: { fontSize: 14, fontWeight: '600', color: Colors.textInk },
  barBg:  { height: 6, backgroundColor: Colors.line, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  stopBadge:     { width: 32, height: 32, borderRadius: Radii.full, alignItems: 'center', justifyContent: 'center' },
  stopBadgeText: { fontSize: 13, fontWeight: '700', color: Colors.textInverted },

  expenseList: { gap: Spacing.sm2 },
  expenseCard: {
    minHeight: 82, justifyContent: 'center', gap: Spacing.sm2,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
    borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card,
  },
  expTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  expTitle:     { flex: 1, ...Typography.cardTitle, color: Colors.textInk, textTransform: 'uppercase' },
  expMetaRow:   { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.md, rowGap: 2 },
  expMeta:      { ...Typography.bodySmall, color: Colors.textInk },
  expMetaMuted: { ...Typography.bodySmall, color: Colors.textMuted },
  deleteAction: {
    backgroundColor: Colors.negative, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
    borderTopRightRadius: Radii.lg, borderBottomRightRadius: Radii.lg,
  },

  empty:        { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyText:    { ...Typography.body, color: Colors.textMuted },
  emptyBtn:     { marginTop: Spacing.sm, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radii.full },
  emptyBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
