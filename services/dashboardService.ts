// HAKO — Service Dashboard : le contenu des tuiles « avant le départ »
// Une requête par tuile, en parallèle (documents, envies, budget, planning).
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { BudgetSummary, ExpenseForSummary, summarizeBudget } from '@/utils/dashboardSummary';

const RECENT_DOCS = 3;
const OPEN_STATUSES = ['pending', 'debate'];

export interface DashboardSummary {
  recentDocTitles: string[];
  docCount: number;
  wishCount: number;
  toVoteCount: number;
  budget: BudgetSummary;
  plannedCount: number;
}

export async function getDashboardSummary(tripId: string, userId: string | null): Promise<ServiceResult<DashboardSummary>> {
  const [docs, docCount, wishes, toVote, expenses, planned] = await Promise.all([
    supabase.from('documents').select('title').eq('trip_id', tripId)
      .order('created_at', { ascending: false }).limit(RECENT_DOCS),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('trip_id', tripId),
    supabase.from('wishes').select('id', { count: 'exact', head: true })
      .eq('trip_id', tripId).neq('status', 'archived'),
    supabase.from('wishes').select('id', { count: 'exact', head: true })
      .eq('trip_id', tripId).in('status', OPEN_STATUSES),
    supabase.from('expenses').select('amount, paid_by, expense_splits(user_id, amount)').eq('trip_id', tripId),
    supabase.from('planning_items').select('id', { count: 'exact', head: true }).eq('trip_id', tripId),
  ]);
  const failed = [docs, docCount, wishes, toVote, expenses, planned].find(r => r.error);
  if (failed?.error) return serviceError(failed.error.message);

  return {
    data: {
      recentDocTitles: ((docs.data ?? []) as { title: string }[]).map(d => d.title),
      docCount: docCount.count ?? 0,
      wishCount: wishes.count ?? 0,
      toVoteCount: toVote.count ?? 0,
      budget: summarizeBudget((expenses.data ?? []) as ExpenseForSummary[], userId),
      plannedCount: planned.count ?? 0,
    },
    error: null,
  };
}
