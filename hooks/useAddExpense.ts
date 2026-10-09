// HAKO — Hook « Ajouter une dépense » (app/trip/[id]/expense/new.tsx)
// 3 étapes : c'est quoi (montant, titre, catégorie, jour) → qui a payé →
// pour qui (partage égal au centime). La dépense est rattachée à la ville
// du jour choisi (voyages multi-étapes).

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useTripOverview } from '@/hooks/useTripOverview';
import { useTripStops } from '@/hooks/useTripStops';
import { addExpense, getBudget } from '@/services/budgetService';
import { BudgetMember } from '@/types/budget';
import { expenseDayOptions, parseAmount, splitEqually } from '@/utils/expenseForm';
import { localDayIso, stopForDay } from '@/utils/tripStops';

export const EXPENSE_STEPS = 3;
export type ExpenseStep = 1 | 2 | 3;

export function useAddExpense(tripId: string) {
  const { session } = useAuth();
  const me = session?.user?.id ?? '';
  const { overview } = useTripOverview(tripId);
  const { stops } = useTripStops(tripId);

  const [members, setMembers] = useState<BudgetMember[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<ExpenseStep>(1);
  const [amountText, setAmountText] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('food');
  const [day, setDay] = useState<string | null>(null);
  const [payerId, setPayerId] = useState(me);
  const [splitIds, setSplitIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    void getBudget(tripId).then(({ data, error }) => {
      if (error !== null) { setLoadError(error); setMembers([]); return; }
      // Moi en premier, puis les autres par ordre alphabétique
      const sorted = [...data.members].sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : a.nickname.localeCompare(b.nickname)));
      setMembers(sorted);
      setSplitIds(sorted.map(m => m.id));
    });
  }, [tripId, me]);

  const today = localDayIso(new Date());
  const days = useMemo(
    () => expenseDayOptions(overview?.start_date ?? null, overview?.end_date ?? null, today),
    [overview?.start_date, overview?.end_date, today],
  );
  const chosenDay = day && days.includes(day) ? day : days[0] ?? today;

  const amount = parseAmount(amountText);
  const splits = useMemo(() => (amount ? splitEqually(amount, splitIds) : []), [amount, splitIds]);
  const perPerson = splits[splits.length - 1]?.amount ?? 0;

  const canContinue = step === 1 ? amount !== null && title.trim().length > 0
    : step === 2 ? !!payerId
      : splitIds.length > 0;

  const toggleSplit = useCallback((id: string) => {
    setSplitIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }, []);
  const splitAll = useCallback(() => setSplitIds((members ?? []).map(m => m.id)), [members]);

  /** Étape suivante ou enregistrement. Renvoie 'saved', une erreur, ou null. */
  const next = useCallback(async (): Promise<'saved' | string | null> => {
    if (!canContinue) return null;
    if (step < EXPENSE_STEPS) { setStep((step + 1) as ExpenseStep); return null; }
    if (!amount) return null;
    setSaving(true);
    // Garde l'ordre des membres (les centimes en trop vont aux premiers)
    const ordered = (members ?? []).map(m => m.id).filter(id => splitIds.includes(id));
    const { error } = await addExpense({
      tripId, paidBy: payerId || me, title, amount, category, date: chosenDay,
      stopId: stopForDay(stops, chosenDay)?.id ?? null,
      splits: splitEqually(amount, ordered),
    });
    setSaving(false);
    return error ?? 'saved';
  }, [canContinue, step, amount, members, splitIds, tripId, payerId, me, title, category, chosenDay, stops]);

  const back = useCallback((): boolean => {
    if (step === 1) return false;
    setStep((step - 1) as ExpenseStep);
    return true;
  }, [step]);

  return {
    me, members, loadError, step, next, back, canContinue, saving,
    amountText, setAmountText, amount, title, setTitle, category, setCategory,
    days, day: chosenDay, today, setDay, payerId: payerId || me, setPayerId,
    splitIds, toggleSplit, splitAll, perPerson,
  };
}
