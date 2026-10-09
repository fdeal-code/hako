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
