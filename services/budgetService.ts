// HAKO — Service Budget : membres + dépenses (avec leurs parts)
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { BudgetMember } from '@/types/budget';
import { BudgetExpense } from '@/utils/budgetSummary';

interface MemberRowDb {
  user_id: string;
  profile: { nickname: string | null; avatar_url: string | null } | null;
}

export async function getBudget(tripId: string): Promise<ServiceResult<{ members: BudgetMember[]; expenses: BudgetExpense[] }>> {
  const [members, expenses] = await Promise.all([
    supabase.from('trip_members').select('user_id, profile:profiles(nickname, avatar_url)').eq('trip_id', tripId),
    supabase.from('expenses').select('amount, paid_by, category, stop_id, expense_splits(user_id, amount)').eq('trip_id', tripId),
  ]);
  if (members.error) return serviceError(members.error.message);
  if (expenses.error) return serviceError(expenses.error.message);
  return {
    data: {
      members: ((members.data ?? []) as unknown as MemberRowDb[]).map(m => ({
        id: m.user_id,
        nickname: m.profile?.nickname ?? 'Membre',
        avatarUrl: m.profile?.avatar_url ?? null,
      })),
      expenses: (expenses.data ?? []) as BudgetExpense[],
    },
    error: null,
  };
}

export interface NewExpense {
  tripId: string;
  paidBy: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  stopId: string | null;
  splits: { user_id: string; amount: number }[];
}

/** Crée la dépense et ses parts ; annule la dépense si les parts échouent. */
export async function addExpense(input: NewExpense): Promise<ServiceResult<string>> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      trip_id: input.tripId,
      paid_by: input.paidBy,
      title: input.title.trim(),
      amount: input.amount,
      category: input.category,
      date: input.date,
      split_type: 'equal',
      stop_id: input.stopId,
    })
    .select('id')
    .single();
  if (error) return serviceError(error.message);
  const expenseId = (data as { id: string }).id;

  const { error: splitError } = await supabase
    .from('expense_splits')
    .insert(input.splits.map(s => ({ ...s, expense_id: expenseId })));
  if (splitError) {
    await supabase.from('expenses').delete().eq('id', expenseId);
    return serviceError(splitError.message);
  }
  return { data: expenseId, error: null };
}
