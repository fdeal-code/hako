// HAKO — Hook Équilibre du budget : soldes, remboursements, catégories, villes
// Rechargé à chaque retour sur l'écran (ex. après avoir ajouté une dépense).

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { useTripStops } from '@/hooks/useTripStops';
import { getBudget } from '@/services/budgetService';
import { BudgetMember } from '@/types/budget';
import { BudgetExpense, computeBalances, settleDebts, totalsByCategory, totalsByStop } from '@/utils/budgetSummary';

export function useBudgetSummary(tripId: string | undefined) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { stops } = useTripStops(tripId);
  const [members, setMembers] = useState<BudgetMember[]>([]);
  const [expenses, setExpenses] = useState<BudgetExpense[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!tripId) return;
    void getBudget(tripId).then(result => {
      if (result.error !== null) setError(result.error);
      else { setMembers(result.data.members); setExpenses(result.data.expenses); setError(null); }
      setLoaded(true);
    });
  }, [tripId]);

  useFocusEffect(refresh);

  const total = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const balances = useMemo(() => computeBalances(expenses), [expenses]);
  const debts = useMemo(() => settleDebts(balances), [balances]);
  const categories = useMemo(() => totalsByCategory(expenses), [expenses]);
  const byStop = useMemo(() => totalsByStop(expenses, stops.map(s => s.id)), [expenses, stops]);

  return { userId, members, stops, loaded, error, total, balances, debts, categories, byStop };
}
