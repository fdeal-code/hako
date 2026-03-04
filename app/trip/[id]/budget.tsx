/**
 * BudgetScreen — Full-featured expense tracker for a trip.
 * Tables: expenses, expense_splits, profiles, trip_members
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Pressable,
  Animated, Easing, Alert, KeyboardAvoidingView, Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { MemberAvatar } from '@/components/ui/MemberAvatar';

/* ─── Types ──────────────────────────────────────────────────── */
interface DbSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
}

interface DbExpense {
  id: string;
  trip_id: string;
  paid_by: string;
  title: string;
  amount: number;
  category: string;
  date: string | null;
  notes: string | null;
  expense_splits: DbSplit[];
}

interface Member {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
}

interface Debt {
  from: string;
  to: string;
  amount: number;
}

/* ─── Constants ──────────────────────────────────────────────── */
const MEMBER_COLORS = ['#FF4B6E', '#5C6BC0', '#26A69A', '#FFA726', '#AB47BC', '#EC407A'];

const CATEGORIES: { key: string; label: string; emoji: string }[] = [
  { key: 'all',           label: 'Toutes',      emoji: '🔍' },
  { key: 'food',          label: 'Resto',        emoji: '🍽️' },
  { key: 'transport',     label: 'Transport',    emoji: '✈️' },
  { key: 'accommodation', label: 'Hébergement',  emoji: '🏨' },
  { key: 'activity',      label: 'Activité',     emoji: '🎭' },
  { key: 'other',         label: 'Autre',        emoji: '🛍️' },
];

const CAT_COLORS: Record<string, string> = {
  transport:     '#5C6BC0',
  accommodation: '#26A69A',
  food:          '#FFA726',
  activity:      '#FF4B6E',
  other:         '#ADADAD',
};

const STEP_CATEGORIES = CATEGORIES.filter(c => c.key !== 'all');
const STEP_LABELS = ['Dépense', 'Montant', 'Payeur', 'Partage'];

/* ─── Helpers ────────────────────────────────────────────────── */
function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtShort(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k €';
  return n.toFixed(0) + ' €';
}

function memberName(members: Member[], id: string, currentUserId: string): string {
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
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > 0.01) debts.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }
  return debts;
}

/* ─── Main Component ─────────────────────────────────────────── */
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

  /* ── Fetch ── */
  const fetchData = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);

    const { data: membersList } = await supabase
      .from('trip_members')
      .select('user_id')
      .eq('trip_id', tripId);

    const profiles: Member[] = [];
    for (const m of (membersList ?? [])) {
      const { data } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url')
        .eq('id', m.user_id)
        .single();
      if (data) profiles.push(data);
    }
    setMembers(profiles);

    const { data: expData } = await supabase
      .from('expenses')
      .select('*, expense_splits(*)')
      .eq('trip_id', tripId)
      .order('date', { ascending: false });
    setExpenses((expData ?? []) as DbExpense[]);
    setLoading(false);
  }, [tripId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Derived ── */
  const total       = expenses.reduce((s, e) => s + e.amount, 0);
  const debts       = calculateDebts(expenses);
  const filtered    = filter === 'all' ? expenses : expenses.filter(e => e.category === filter);

  const memberSpend = members.map(m => ({
    member: m,
    paid: expenses.filter(e => e.paid_by === m.id).reduce((s, e) => s + e.amount, 0),
  })).sort((a, b) => b.paid - a.paid);

  const maxSpend = Math.max(...memberSpend.map(m => m.paid), 1);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Budget</Text>
          {!loading && (
            <Text style={s.headerSub}>
              {expenses.length} dépense{expenses.length !== 1 ? 's' : ''} · {members.length} participant{members.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}>

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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterContent}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.key}
                style={[s.filterPill, filter === cat.key && s.filterPillActive]}
                onPress={() => setFilter(cat.key)}
                activeOpacity={0.8}
              >
                <Text style={[s.filterPillText, filter === cat.key && s.filterPillTextActive]}>
                  {cat.key !== 'all' ? `${cat.emoji} ` : ''}{cat.label}
                </Text>
              </TouchableOpacity>
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
              {filtered.map(exp => {
                const catColor  = CAT_COLORS[exp.category] ?? '#ADADAD';
                const catEmoji  = CATEGORIES.find(c => c.key === exp.category)?.emoji ?? '💰';
                const payer     = memberName(members, exp.paid_by, currentUserId);
                const splitCount = exp.expense_splits.length || 1;
                const perPerson  = exp.amount / splitCount;
                return (
                  <View key={exp.id} style={s.expenseCard}>
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
                );
              })}
            </View>
          )}

        </ScrollView>
      )}

      {/* ── Add expense modal ── */}
      <AddExpenseModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        tripId={tripId}
        members={members}
        currentUserId={currentUserId}
        onSaved={() => { setShowAdd(false); fetchData(); }}
      />
    </View>
  );
}

/* ─── AddExpenseModal ────────────────────────────────────────── */
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
  const insets     = useSafeAreaInsets();
  const { width }  = useWindowDimensions();
  const [step,     setStep]     = useState(0);
  const [saving,   setSaving]   = useState(false);
  const slideAnim  = useRef(new Animated.Value(0)).current;

  const [title,    setTitle]    = useState('');
  const [category, setCategory] = useState('other');
  const [amount,   setAmount]   = useState('');
  const [date,     setDate]     = useState('');
  const [payerId,  setPayerId]  = useState(currentUserId);
  const [splitIds, setSplitIds] = useState<Set<string>>(new Set());

  const reset = useCallback(() => {
    setStep(0);
    setTitle('');
    setCategory('other');
    setAmount('');
    setDate('');
    setPayerId(currentUserId);
    setSplitIds(new Set(members.map(m => m.id)));
    slideAnim.setValue(0);
  }, [currentUserId, members, slideAnim]);

  useEffect(() => { if (visible) reset(); }, [visible, reset]);

  const slideTo = (nextStep: number) => {
    Animated.timing(slideAnim, {
      toValue: -width * nextStep,
      duration: 280,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
    setStep(nextStep);
  };

  const goNext = () => {
    if (step === 0 && !title.trim()) {
      Alert.alert('Titre requis', 'Entre un titre pour la dépense.');
      return;
    }
    if (step === 1) {
      const n = parseFloat(amount.replace(',', '.'));
      if (!amount || isNaN(n) || n <= 0) {
        Alert.alert('Montant invalide', 'Entre un montant valide.');
        return;
      }
    }
    slideTo(step + 1);
  };

  const handleSave = async () => {
    const n = parseFloat(amount.replace(',', '.'));
    if (isNaN(n) || n <= 0) { Alert.alert('Montant invalide', ''); return; }
    if (splitIds.size === 0) { Alert.alert('Partage requis', 'Sélectionne au moins une personne.'); return; }

    setSaving(true);
    try {
      let isoDate: string | null = null;
      if (date.trim()) {
        const parts = date.trim().split('/');
        if (parts.length === 3) {
          const [d, mo, y] = parts;
          const candidate = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
          if (!isNaN(new Date(candidate).getTime())) isoDate = candidate;
        }
      }

      const { data: expData, error: expError } = await supabase
        .from('expenses')
        .insert({ trip_id: tripId, paid_by: payerId, title: title.trim(), amount: n, category, date: isoDate })
        .select()
        .single();

      if (expError) throw expError;

      const perPerson = n / splitIds.size;
      const splits = [...splitIds].map(userId => ({
        expense_id: expData.id,
        user_id:    userId,
        amount:     Math.round(perPerson * 100) / 100,
      }));

      const { error: splitError } = await supabase.from('expense_splits').insert(splits);
      if (splitError) throw splitError;

      onSaved();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "Impossible d'enregistrer la dépense.");
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={ms.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={10}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[ms.container, { paddingBottom: insets.bottom + Spacing.md }]}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />

          <View style={ms.handle} />

          {/* Header */}
          <View style={ms.header}>
            {step > 0 ? (
              <TouchableOpacity onPress={() => slideTo(step - 1)} style={ms.headerBtn}>
                <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            ) : (
              <View style={ms.headerBtn} />
            )}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={ms.headerTitle}>Nouvelle dépense</Text>
              <Text style={ms.headerStep}>{STEP_LABELS[step]}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={ms.headerBtn}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Step dots */}
          <View style={ms.dots}>
            {STEP_LABELS.map((_, i) => (
              <View key={i} style={[ms.dot, i === step && ms.dotActive]} />
            ))}
          </View>

          {/* Sliding steps */}
          <View style={ms.stepsOuter}>
            <Animated.View style={[ms.stepsInner, { width: width * 4, transform: [{ translateX: slideAnim }] }]}>

              {/* Step 0: Titre + Catégorie */}
              <View style={[ms.step, { width }]}>
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  <Text style={ms.fieldLabel}>Titre de la dépense</Text>
                  <TextInput
                    style={ms.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Ex : Dîner au restaurant"
                    placeholderTextColor={Colors.textTertiary}
                    autoFocus={visible && step === 0}
                  />
                  <Text style={[ms.fieldLabel, { marginTop: Spacing.md }]}>Catégorie</Text>
                  <View style={ms.catGrid}>
                    {STEP_CATEGORIES.map(cat => (
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
                  </View>
                </ScrollView>
              </View>

              {/* Step 1: Montant + Date */}
              <View style={[ms.step, { width }]}>
                <Text style={ms.fieldLabel}>Montant</Text>
                <View style={ms.amountRow}>
                  <Text style={ms.currencySymbol}>€</Text>
                  <TextInput
                    style={[ms.input, { flex: 1, marginLeft: Spacing.sm }]}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0,00"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="decimal-pad"
                  />
                </View>
                <Text style={[ms.fieldLabel, { marginTop: Spacing.md }]}>Date (optionnel)</Text>
                <TextInput
                  style={ms.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="JJ/MM/AAAA"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="numbers-and-punctuation"
                />
              </View>

              {/* Step 2: Payeur */}
              <View style={[ms.step, { width }]}>
                <Text style={ms.fieldLabel}>Qui a payé ?</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {members.map((mb, i) => (
                    <TouchableOpacity
                      key={mb.id}
                      style={[ms.memberRow, payerId === mb.id && ms.memberRowActive]}
                      onPress={() => setPayerId(mb.id)}
                      activeOpacity={0.8}
                    >
                      <MemberAvatar member={mb} size={40} index={i} />
                      <Text style={ms.memberName}>
                        {mb.id === currentUserId ? 'Toi' : (mb.nickname ?? 'Membre')}
                      </Text>
                      {payerId === mb.id && (
                        <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Step 3: Partage */}
              <View style={[ms.step, { width }]}>
                <Text style={ms.fieldLabel}>Partager entre :</Text>
                <Text style={ms.splitSub}>
                  {splitIds.size} personne{splitIds.size > 1 ? 's' : ''} sélectionnée{splitIds.size > 1 ? 's' : ''}
                </Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {members.map((mb, i) => (
                    <TouchableOpacity
                      key={mb.id}
                      style={[ms.memberRow, splitIds.has(mb.id) && ms.memberRowActive]}
                      onPress={() => toggleSplit(mb.id)}
                      activeOpacity={0.8}
                    >
                      <MemberAvatar member={mb} size={40} index={i} />
                      <Text style={ms.memberName}>
                        {mb.id === currentUserId ? 'Toi' : (mb.nickname ?? 'Membre')}
                      </Text>
                      <View style={[ms.checkbox, splitIds.has(mb.id) && ms.checkboxChecked]}>
                        {splitIds.has(mb.id) && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

            </Animated.View>
          </View>

          {/* CTA */}
          {step < 3 ? (
            <TouchableOpacity style={ms.cta} onPress={goNext} activeOpacity={0.85}>
              <Text style={ms.ctaText}>Suivant →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[ms.cta, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={ms.ctaText}>Enregistrer la dépense</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─── Main Styles ────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.sm },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  headerSub:   { fontSize: 13, color: Colors.textSecondary, fontWeight: '500', marginTop: 1 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: Spacing.md },

  totalCard: { backgroundColor: Colors.primary, borderRadius: Radii.lg, padding: Spacing.lg, alignItems: 'center', ...Shadows.md },
  totalLabel: { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  totalAmount: { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: -1, marginTop: 4 },

  section: { backgroundColor: Colors.surface, borderRadius: Radii.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadows.sm },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: Spacing.sm },

  debtRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  debtText: { flex: 1, fontSize: 14, color: Colors.textSecondary },
  debtName: { fontWeight: '700', color: Colors.textPrimary },
  debtAmount: { fontWeight: '700', color: '#EF4444' },

  memberSpendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 5 },
  memberSpendHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  memberSpendName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  memberSpendAmount: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  barBg: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },

  filterContent: { gap: Spacing.xs, paddingVertical: 4 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radii.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterPillText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterPillTextActive: { color: '#fff' },

  expenseList: { gap: Spacing.sm },
  expenseCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radii.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadows.sm },
  expIconBox: { width: 44, height: 44, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  expIconEmoji: { fontSize: 22 },
  expTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  expMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  expAmount: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  expPer: { fontSize: 11, color: Colors.textTertiary, marginTop: 1 },

  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
  emptyBtn: { marginTop: Spacing.sm, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radii.full },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

/* ─── Modal Styles ───────────────────────────────────────────── */
const ms = StyleSheet.create({
  kav: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  container: { borderTopLeftRadius: Radii.xl, borderTopRightRadius: Radii.xl, overflow: 'hidden', maxHeight: '88%' },
  handle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.sm, marginBottom: Spacing.sm },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, marginBottom: Spacing.xs },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  headerStep: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', marginTop: 2 },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: Spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  dotActive: { width: 20, backgroundColor: Colors.primary },

  stepsOuter: { overflow: 'hidden', height: 300 },
  stepsInner: { flexDirection: 'row' },
  step: { paddingHorizontal: Spacing.md },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs },
  input: { backgroundColor: Colors.surface, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 16, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xs },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  catPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catEmoji: { fontSize: 18 },
  catLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  catLabelActive: { color: '#fff' },

  amountRow: { flexDirection: 'row', alignItems: 'center' },
  currencySymbol: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10, paddingHorizontal: Spacing.sm, borderRadius: Radii.md, marginBottom: 4 },
  memberRowActive: { backgroundColor: Colors.primary + '12' },
  memberName: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  splitSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: Spacing.sm },

  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  cta: { marginHorizontal: Spacing.md, marginTop: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radii.full, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
