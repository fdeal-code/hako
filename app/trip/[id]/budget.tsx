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

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { NavButton } from '@/components/ui/NavButton';
import { FilterButton } from '@/components/ui/FilterButton';

/* ─── Types ──────────────────────────────────────────────────────── */
interface DbSplit   { id: string; expense_id: string; user_id: string; amount: number; }
interface DbExpense { id: string; trip_id: string; paid_by: string; title: string; amount: number; category: string; date: string | null; notes: string | null; expense_splits: DbSplit[]; }
interface Member    { id: string; nickname: string | null; avatar_url: string | null; }
interface Debt      { from: string; to: string; amount: number; }

/* ─── Constants ──────────────────────────────────────────────────── */
const MEMBER_COLORS = ['#FF4B6E', '#5C6BC0', '#26A69A', '#FFA726', '#AB47BC', '#EC407A'];

const FILTER_CATS = [
  { key: 'all',           label: 'Toutes',      emoji: '' },
  { key: 'food',          label: 'Resto',        emoji: '🍽️' },
  { key: 'transport',     label: 'Transport',    emoji: '✈️' },
  { key: 'accommodation', label: 'Hébergement',  emoji: '🏨' },
  { key: 'activity',      label: 'Activité',     emoji: '🎭' },
  { key: 'grocery',       label: 'Courses',      emoji: '🛒' },
  { key: 'other',         label: 'Autre',        emoji: '📦' },
];

const FORM_CATS = FILTER_CATS.filter(c => c.key !== 'all');

const CAT_COLORS: Record<string, string> = {
  transport: '#5C6BC0', accommodation: '#26A69A', food: '#FFA726',
  activity:  '#FF4B6E', grocery:       '#22C55E', other: '#ADADAD',
};

const STEP_LABELS = ["C'est quoi ?", 'Qui a payé ?', 'Pour qui ?'];

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
function calculateDebts(expenses: DbExpense[]): Debt[] {
  const balances: Record<string, number> = {};
  for (const exp of expenses) {
    balances[exp.paid_by] = (balances[exp.paid_by] ?? 0) + exp.amount;
    for (const split of exp.expense_splits) {
      balances[split.user_id] = (balances[split.user_id] ?? 0) - split.amount;
    }
  }
  const debtors   = Object.entries(balances).filter(([, v]) => v < -0.01).map(([id, v]) => ({ id, amount: Math.abs(v) })).sort((a, b) => b.amount - a.amount);
  const creditors = Object.entries(balances).filter(([, v]) => v >  0.01).map(([id, v]) => ({ id, amount: v })).sort((a, b) => b.amount - a.amount);
  const debts: Debt[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i], c = creditors[j];
    if (!d || !c) break;
    const amount = Math.min(d.amount, c.amount);
    if (amount > 0.01) debts.push({ from: d.id, to: c.id, amount });
    d.amount -= amount; c.amount -= amount;
    if (d.amount < 0.01) i++;
    if (c.amount < 0.01) j++;
  }
  return debts;
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

  const catColor   = CAT_COLORS[exp.category] ?? '#ADADAD';
  const catEmoji   = FILTER_CATS.find(c => c.key === exp.category)?.emoji ?? '💰';
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
          <View style={[s.expIconBox, { backgroundColor: catColor + '18' }]}>
            <Text style={s.expIconEmoji}>{catEmoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.expTitle} numberOfLines={1}>{exp.title}</Text>
            <Text style={s.expMeta}>
              Payé par {payer}{exp.date ? ` · ${exp.date.slice(8, 10)}/${exp.date.slice(5, 7)}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.expAmount}>{fmt(exp.amount)}</Text>
            <Text style={s.expPer}>{fmt(perPerson)}/pers.</Text>
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
  const [showAdd,  setShowAdd]  = useState(false);

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
  const debts    = calculateDebts(expenses);
  const filtered = filter === 'all' ? expenses : expenses.filter(e => e.category === filter);
  const memberSpend = members.map(m => ({
    member: m,
    paid: expenses.filter(e => e.paid_by === m.id).reduce((acc, e) => acc + e.amount, 0),
  })).sort((a, b) => b.paid - a.paid);
  const maxSpend = Math.max(...memberSpend.map(m => m.paid), 1);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Budget</Text>
        {!loading && (
          <Text style={s.headerSub}>
            {expenses.length} dépense{expenses.length !== 1 ? 's' : ''} · {members.length} participant{members.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
        >
          {/* ── Total ── */}
          <View style={s.totalCard}>
            <Text style={s.totalLabel}>Total dépensé</Text>
            <Text style={s.totalAmount}>{fmt(total)}</Text>
          </View>

          {/* ── Dettes ── */}
          {debts.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Qui doit combien à qui</Text>
              {debts.map((d, i) => (
                <View key={i} style={s.debtRow}>
                  <MemberAvatar member={members.find(m => m.id === d.from) ?? {}} size={32} index={0} />
                  <Text style={s.debtText}>
                    <Text style={s.debtName}>{memberName(members, d.from, currentUserId)}</Text>
                    {' doit '}
                    <Text style={s.debtAmount}>{fmt(d.amount)}</Text>
                    {' à '}
                    <Text style={s.debtName}>{memberName(members, d.to, currentUserId)}</Text>
                  </Text>
                  <MemberAvatar member={members.find(m => m.id === d.to) ?? {}} size={32} index={1} />
                </View>
              ))}
            </View>
          )}

          {/* ── Par participant ── */}
          {memberSpend.length > 0 && total > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Par participant</Text>
              {memberSpend.map((ms, i) => (
                <View key={ms.member.id} style={s.memberSpendRow}>
                  <MemberAvatar member={ms.member} size={32} index={i} />
                  <View style={{ flex: 1 }}>
                    <View style={s.memberSpendHeader}>
                      <Text style={s.memberSpendName}>
                        {ms.member.id === currentUserId ? 'Toi' : (ms.member.nickname ?? 'Membre')}
                      </Text>
                      <Text style={s.memberSpendAmount}>{fmtShort(ms.paid)}</Text>
                    </View>
                    <View style={s.barBg}>
                      <View style={[s.barFill, {
                        width: `${(ms.paid / maxSpend) * 100}%` as any,
                        backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length],
                      }]} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Filtre catégories ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterRow}
          >
            {FILTER_CATS.map(cat => (
              <FilterButton
                key={cat.key}
                label={cat.key !== 'all' ? `${cat.emoji} ${cat.label}` : cat.label}
                active={filter === cat.key}
                onPress={() => setFilter(cat.key)}
              />
            ))}
          </ScrollView>

          {/* ── Liste dépenses ── */}
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>💸</Text>
              <Text style={s.emptyText}>Aucune dépense pour l'instant.</Text>
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
        </ScrollView>
      )}

      {/* ── Bottom nav ── */}
      <View style={[s.bottomNav, { bottom: Math.max(insets.bottom, 10) + 16 }]} pointerEvents="box-none">
        <NavButton icon="arrow-back-outline" onPress={() => router.back()} />
        <NavButton icon="add" iconSize={28} onPress={() => setShowAdd(true)} />
        <NavButton icon="options-outline" onPress={() => {}} />
      </View>

      <AddExpenseModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        tripId={tripId ?? ''}
        members={members}
        currentUserId={currentUserId}
        onSaved={() => { setShowAdd(false); fetchData(); }}
      />
    </View>
  );
}

/* ─── AddExpenseModal — formulaire 3 étapes ─────────────────────── */
function AddExpenseModal({
  visible, onClose, tripId, members, currentUserId, onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  members: Member[];
  currentUserId: string;
  onSaved: () => void;
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
          date:       new Date().toISOString().split('T')[0],
          split_type: 'equal',
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
                <Text style={ms.stepTitle}>C'est quoi cette{'\n'}dépense ?</Text>

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
  header:      { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -1 },
  headerSub:   { fontSize: 13, color: Colors.textSecondary, fontWeight: '500', marginTop: 2 },
  bottomNav:   { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 14, zIndex: 10 },

  scroll:    { paddingHorizontal: Spacing.md, paddingTop: 8, gap: Spacing.md },
  filterRow: { gap: 8, paddingVertical: 8, alignItems: 'center' as const },

  totalCard:   { backgroundColor: Colors.primary, borderRadius: Radii.lg, padding: Spacing.lg, alignItems: 'center', ...Shadows.md },
  totalLabel:  { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  totalAmount: { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: -1, marginTop: 4 },

  section:      { backgroundColor: Colors.surface, borderRadius: Radii.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadows.sm },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: Spacing.sm },

  debtRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  debtText:   { flex: 1, fontSize: 14, color: Colors.textSecondary },
  debtName:   { fontWeight: '700', color: Colors.textPrimary },
  debtAmount: { fontWeight: '700', color: '#EF4444' },

  memberSpendRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 5 },
  memberSpendHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  memberSpendName:   { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  memberSpendAmount: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  barBg:  { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },

  expenseList:  { gap: Spacing.sm },
  expenseCard:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radii.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  expIconBox:   { width: 44, height: 44, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  expIconEmoji: { fontSize: 22 },
  expTitle:     { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  expMeta:      { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  expAmount:    { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  expPer:       { fontSize: 11, color: Colors.textTertiary, marginTop: 1 },
  deleteAction: { backgroundColor: '#ff3b30', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, borderTopRightRadius: Radii.lg, borderBottomRightRadius: Radii.lg },

  empty:        { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyIcon:    { fontSize: 48 },
  emptyText:    { fontSize: 15, color: Colors.textSecondary },
  emptyBtn:     { marginTop: Spacing.sm, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radii.full },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
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
