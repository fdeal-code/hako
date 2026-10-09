// HAKO — Service Voyage en cours : programme du jour et du lendemain,
// documents datés, dépenses, envies pas encore planifiées.
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { NearbyWish, OngoingData, OngoingDoc, OngoingExpense, OngoingItem } from '@/types/ongoingTrip';

const ITEM_FIELDS = 'id, title, day_date, start_time, end_time, wish:wish_id(image_url, address, latitude, longitude)';

export async function getOngoingTrip(tripId: string, today: string, tomorrow: string): Promise<ServiceResult<OngoingData>> {
  const [items, docs, expenses, wishes, planned] = await Promise.all([
    supabase.from('planning_items').select(ITEM_FIELDS)
      .eq('trip_id', tripId).in('day_date', [today, tomorrow]).order('start_time', { ascending: true }),
    supabase.from('documents').select('id, title, category, event_date, details')
      .eq('trip_id', tripId).order('event_date', { ascending: true }),
    supabase.from('expenses').select('amount, date, paid_by, expense_splits(user_id, amount)').eq('trip_id', tripId),
    supabase.from('wishes').select('id, title, status, category, address, latitude, longitude, stop_id')
      .eq('trip_id', tripId).in('status', ['validated', 'pending', 'debate']).neq('type', 'orga'),
    supabase.from('planning_items').select('wish_id').eq('trip_id', tripId).not('wish_id', 'is', null),
  ]);
  const failed = [items, docs, expenses, wishes, planned].find(r => r.error);
  if (failed?.error) return serviceError(failed.error.message);

  const plannedIds = new Set(((planned.data ?? []) as { wish_id: string }[]).map(p => p.wish_id));
  const all = (items.data ?? []) as unknown as OngoingItem[];
  return {
    data: {
      today: all.filter(i => i.day_date === today),
      tomorrow: all.filter(i => i.day_date === tomorrow),
      docs: (docs.data ?? []) as OngoingDoc[],
      expenses: (expenses.data ?? []) as OngoingExpense[],
      unplanned: ((wishes.data ?? []) as NearbyWish[]).filter(w => !plannedIds.has(w.id)),
    },
    error: null,
  };
}
