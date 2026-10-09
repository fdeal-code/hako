/**
 * BudgetScreen — suivi des dépenses d'un voyage
 * Tables: expenses, expense_splits, profiles, trip_members
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform, Animated, Easing,
  useWindowDimensions,
} from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Fonts, Spacing, Radii, Shadows, Typography } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { NavButton } from '@/components/ui/NavButton';
import { FilterButton } from '@/components/ui/FilterButton';
import { useTripStops } from '@/hooks/useTripStops';
import { TripStop } from '@/types/tripStops';
import { stopForDay } from '@/utils/tripStops';

/* ─── Types ──────────────────────────────────────────────────────── */
interface DbSplit   { id: string; expense_id: string; user_id: string; amount: number; }
interface DbExpense { id: string; trip_id: string; paid_by: string; title: string; amount: number; category: string; date: string | null; notes: string | null; expense_splits: DbSplit[]; stop_id?: string | null; }

/** Aujourd'hui "YYYY-MM-DD" en heure locale (toISOString renvoyait la veille après 22h/23h en France). */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
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

const FORM_CATS = FILTER_CATS.filter(c => c.key !== 'all');


const STEP_LABELS = ["C'est quoi ?", 'Qui a payé ?', 'Pour qui ?'];

/* Icône Ionicons par catégorie (cartes « Dernières dépenses » des maquettes V2) */
const CAT_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  food: 'restaurant-outline', transport: 'airplane-outline', accommodation: 'bed-outline',
  activity: 'ticket-outline', shopping: 'cart-outline', other: 'cube-outline',
};
const BALANCE_EPSILON = 0.01;

/* ─── Helpers ────────────────────────────────────────────────────── */
function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
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
  const { id: tripId, add } = useLocalSearchParams<{ id: string; add?: string }>(); // add=1 : raccourci « Ajouter »
  const insets         = useSafeAreaInsets();
  const { session }    = useAuth();
  const currentUserId  = session?.user?.id ?? '';

  const [expenses, setExpenses] = useState<DbExpense[]>([]);
  const [members,  setMembers]  = useState<Member[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const [showAdd,  setShowAdd]  = useState(add === '1');
  const { stops } = useTripStops(tripId);

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

  useEffect(() => { fetchData(); }, [fetchData]);

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
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 110 }]}
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
                <TouchableOpacity style={s.emptyBtn} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
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
      <View style={[s.bottomNav, { bottom: Math.max(insets.bottom, 10) + 16 }]} pointerEvents="box-none">
        <NavButton icon="arrow-back-outline" onPress={() => router.back()} />
        <NavButton icon="add" iconSize={28} variant="accent" onPress={() => setShowAdd(true)} />
        <NavButton icon="pie-chart-outline" onPress={openBalance} />
      </View>

      <AddExpenseModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        tripId={tripId ?? ''}
        members={members}
        currentUserId={currentUserId}
        onSaved={() => { setShowAdd(false); fetchData(); }}
        stops={stops}
      />
    </View>
  );
}

/* ─── AddExpenseModal — formulaire 3 étapes ─────────────────────── */
function AddExpenseModal({
  visible, onClose, tripId, members, currentUserId, onSaved, stops,
}: {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  members: Member[];
  currentUserId: string;
  onSaved: () => void;
  /** Étapes : la dépense est rattachée à la ville du jour (multi-étapes). */
  stops: readonly TripStop[];
}) {
  const insets    = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [step,    setStep]    = useState(0);
  const [saving,  setSaving]  = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [title,    setTitle]    = useState('');
  const [category, setCategory] = useState('food');
  const [amount,   setAmount]   = useState('');
  const [payerId,  setPayerId]  = useState(currentUserId);
  const [splitIds, setSplitIds] = useState<Set<string>>(new Set());

  const reset = useCallback(() => {
    setStep(0);
    setTitle('');
    setCategory('food');
    setAmount('');
    setPayerId(currentUserId);
    setSplitIds(new Set(members.map(m => m.id)));
    slideAnim.setValue(0);
  }, [currentUserId, members, slideAnim]);

  useEffect(() => { if (visible) reset(); }, [visible, reset]);

  const slideTo = (next: number) => {
    Animated.timing(slideAnim, {
      toValue: -width * next,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
    setStep(next);
  };

  const goNext = () => {
    if (step === 0) {
      if (!title.trim()) { Alert.alert('Titre requis', 'Entre un titre pour la dépense.'); return; }
      const n = parseFloat(amount.replace(',', '.'));
      if (!amount || isNaN(n) || n <= 0) { Alert.alert('Montant invalide', 'Entre un montant valide.'); return; }
    }
    slideTo(step + 1);
  };

  const handleSave = async () => {
    const n = parseFloat(amount.replace(',', '.'));
    if (isNaN(n) || n <= 0) { Alert.alert('Montant invalide', ''); return; }
    if (splitIds.size === 0) { Alert.alert('Partage requis', 'Sélectionne au moins une personne.'); return; }
    setSaving(true);
    try {
      const { data: expData, error: expError } = await supabase
        .from('expenses')
        .insert({
          trip_id:    tripId,
          paid_by:    payerId,
          title:      title.trim(),
          amount:     n,
          category,
          date:       localToday(),
          split_type: 'equal',
          ...(stopForDay(stops, localToday()) ? { stop_id: stopForDay(stops, localToday())?.id } : {}),
        })
        .select('id')
        .single();
      if (expError) throw expError;

      const splitAmount = Math.round((n / splitIds.size) * 100) / 100;
      const splits = [...splitIds].map(userId => ({
        expense_id: expData.id,
        user_id:    userId,
        amount:     splitAmount,
      }));
      const { error: splitError } = await supabase.from('expense_splits').insert(splits);
      if (splitError) throw splitError;
      onSaved();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "Impossible d'enregistrer.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSplit = (id: string) => {
    setSplitIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const numericAmount = parseFloat(amount.replace(',', '.')) || 0;
  const perPerson     = splitIds.size > 0 ? numericAmount / splitIds.size : 0;
  const canNext0      = title.trim().length > 0 && numericAmount > 0;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[ms.root, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header ── */}
        <View style={ms.topBar}>
          <TouchableOpacity
            style={ms.topBtn}
            onPress={() => step > 0 ? slideTo(step - 1) : onClose()}
            activeOpacity={0.75}
          >
            <Ionicons name={step > 0 ? 'arrow-back' : 'close'} size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={ms.dots}>
            {STEP_LABELS.map((_, i) => (
              <View key={i} style={[ms.dot, i === step && ms.dotActive]} />
            ))}
          </View>
          <TouchableOpacity style={ms.topBtn} onPress={onClose} activeOpacity={0.75}>
            <Ionicons name="close" size={22} color={step > 0 ? Colors.textSecondary : 'transparent'} />
          </TouchableOpacity>
        </View>

        {/* ── Sliding steps ── */}
        <View style={ms.stepsOuter}>
          <Animated.View style={[ms.stepsInner, { width: width * 3, transform: [{ translateX: slideAnim }] }]}>

            {/* Étape 0 — C'est quoi cette dépense ? */}
            <View style={{ width }}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={ms.stepPad}
              >
                <Text style={ms.stepTitle}>C’est quoi cette{'\n'}dépense ?</Text>

                <Text style={ms.label}>Titre</Text>
                <TextInput
                  style={ms.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Restaurant, taxi aéroport..."
                  placeholderTextColor={Colors.textTertiary}
                  returnKeyType="next"
                  autoFocus={visible && step === 0}
                />

                <Text style={[ms.label, { marginTop: 20 }]}>Catégorie</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={ms.catScroll}
                  style={{ marginBottom: 20 }}
                >
                  {FORM_CATS.map(cat => (
                    <TouchableOpacity
                      key={cat.key}
                      style={[ms.catPill, category === cat.key && ms.catPillActive]}
                      onPress={() => setCategory(cat.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={ms.catEmoji}>{cat.emoji}</Text>
                      <Text style={[ms.catLabel, category === cat.key && ms.catLabelActive]}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={ms.label}>Montant</Text>
                <View style={ms.amountBox}>
                  <TextInput
                    style={ms.amountInput}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="decimal-pad"
                    textAlign="center"
                  />
                  <Text style={ms.amountUnit}>€</Text>
                </View>
              </ScrollView>
            </View>

            {/* Étape 1 — Qui a payé ? */}
            <View style={{ width }}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ms.stepPad}>
                <Text style={ms.stepTitle}>Qui a payé ?</Text>
                {members.map((mb, i) => (
                  <TouchableOpacity
                    key={mb.id}
                    style={[ms.memberRow, payerId === mb.id && ms.memberRowActive]}
                    onPress={() => setPayerId(mb.id)}
                    activeOpacity={0.8}
                  >
                    <MemberAvatar member={mb} size={44} index={i} />
                    <Text style={ms.memberName}>
                      {mb.id === currentUserId ? 'Toi' : (mb.nickname ?? 'Membre')}
                    </Text>
                    <View style={[ms.radio, payerId === mb.id && ms.radioActive]}>
                      {payerId === mb.id && <View style={ms.radioDot} />}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Étape 2 — Pour qui ? */}
            <View style={{ width }}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ms.stepPad}>
                <Text style={ms.stepTitle}>Pour qui ?</Text>

                <View style={ms.quickRow}>
                  <TouchableOpacity
                    style={ms.quickBtn}
                    onPress={() => setSplitIds(new Set(members.map(m => m.id)))}
                    activeOpacity={0.8}
                  >
                    <Text style={ms.quickBtnTxt}>Tous</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={ms.quickBtn}
                    onPress={() => setSplitIds(new Set())}
                    activeOpacity={0.8}
                  >
                    <Text style={ms.quickBtnTxt}>Aucun</Text>
                  </TouchableOpacity>
                </View>

                {members.map((mb, i) => (
                  <TouchableOpacity
                    key={mb.id}
                    style={[ms.memberRow, splitIds.has(mb.id) && ms.memberRowActive]}
                    onPress={() => toggleSplit(mb.id)}
                    activeOpacity={0.8}
                  >
                    <MemberAvatar member={mb} size={44} index={i} />
                    <Text style={ms.memberName}>
                      {mb.id === currentUserId ? 'Toi' : (mb.nickname ?? 'Membre')}
                    </Text>
                    <View style={[ms.checkbox, splitIds.has(mb.id) && ms.checkboxActive]}>
                      {splitIds.has(mb.id) && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                ))}

                {splitIds.size > 0 && numericAmount > 0 && (
                  <View style={ms.perPersonBadge}>
                    <Text style={ms.perPersonTxt}>
                      {fmt(perPerson)} / personne · {splitIds.size} pers.
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>

          </Animated.View>
        </View>

        {/* ── CTA ── */}
        <View style={[ms.ctaWrap, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {step < 2 ? (
            <TouchableOpacity
              style={[ms.cta, step === 0 && !canNext0 && ms.ctaOff]}
              onPress={goNext}
              disabled={step === 0 && !canNext0}
              activeOpacity={0.85}
            >
              <Text style={ms.ctaTxt}>Suivant</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[ms.cta, (saving || splitIds.size === 0) && ms.ctaOff]}
              onPress={handleSave}
              disabled={saving || splitIds.size === 0}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={ms.ctaTxt}>Ajouter la dépense</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
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

/* ─── Modal Styles ───────────────────────────────────────────────── */
const ms = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  topBar:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12 },
  topBtn:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dots:    { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { width: 24, backgroundColor: Colors.primary },

  stepsOuter: { flex: 1, overflow: 'hidden' },
  stepsInner: { flexDirection: 'row', flex: 1 },

  stepPad:   { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8 },
  stepTitle: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5, marginBottom: 28, lineHeight: 34 },

  label: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  input: { backgroundColor: Colors.background, borderRadius: Radii.md, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },

  catScroll:      { gap: 8, paddingVertical: 2 },
  catPill:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.background, borderRadius: Radii.md, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  catPillActive:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catEmoji:       { fontSize: 18 },
  catLabel:       { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  catLabelActive: { color: '#fff' },

  amountBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.border, paddingRight: 20 },
  amountInput: { flex: 1, fontSize: 42, fontWeight: '900', color: Colors.textPrimary, paddingVertical: 14, paddingHorizontal: 16, letterSpacing: -1 },
  amountUnit:  { fontSize: 28, fontWeight: '700', color: Colors.textTertiary },

  memberRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 8, borderRadius: Radii.md, marginBottom: 6, borderWidth: 1, borderColor: 'transparent' },
  memberRowActive: { backgroundColor: Colors.primary + '08', borderColor: Colors.primary + '30' },
  memberName:      { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },

  radio:      { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: Colors.primary },
  radioDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },

  checkbox:       { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  quickRow:    { flexDirection: 'row', gap: 8, marginBottom: 16 },
  quickBtn:    { paddingHorizontal: 20, paddingVertical: 8, borderRadius: Radii.full, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  quickBtnTxt: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },

  perPersonBadge: { marginTop: 16, backgroundColor: Colors.primary + '10', borderRadius: Radii.md, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.primary + '28' },
  perPersonTxt:   { fontSize: 16, fontWeight: '700', color: Colors.primary },

  ctaWrap: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  cta:     { flexDirection: 'row', gap: 8, backgroundColor: Colors.primary, borderRadius: Radii.full, paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  ctaOff:  { opacity: 0.35 },
  ctaTxt:  { color: '#fff', fontWeight: '800', fontSize: 16 },
});
