// HAKO — Service Planning : créneaux du voyage, billets, envies à planifier
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { PlannableWish, PlanningData, PlanningEntry } from '@/types/planning';
import { MapTicket } from '@/types/tripMap';

const ENTRY_FIELDS = 'id, title, day_date, start_time, end_time, notes, stop_id, wish_id, '
  + 'wish:wish_id(title, category, address, image_url, status, wish_votes(vote))';

export async function getPlanning(tripId: string): Promise<ServiceResult<PlanningData>> {
  const [trip, entries, docs, wishes] = await Promise.all([
    supabase.from('trips').select('start_date, end_date').eq('id', tripId).single(),
    supabase.from('planning_items').select(ENTRY_FIELDS).eq('trip_id', tripId)
      .order('day_date', { ascending: true }).order('start_time', { ascending: true }),
    supabase.from('documents').select('id, title, category, event_date, details')
      .eq('trip_id', tripId).in('category', ['flight', 'transport', 'activity', 'hotel']),
    supabase.from('wishes').select('id, title, image_url, category, stop_id, duration_minutes')
      .eq('trip_id', tripId).eq('status', 'validated').neq('type', 'orga'),
  ]);
  const failed = [trip, entries, docs, wishes].find(r => r.error);
  if (failed?.error) return serviceError(failed.error.message);
  if (!trip.data) return serviceError('Voyage introuvable.');

  const list = (entries.data ?? []) as unknown as PlanningEntry[];
  const planned = new Set(list.map(e => e.wish_id).filter(Boolean));
  const t = trip.data as { start_date: string; end_date: string };
  return {
    data: {
      startDate: t.start_date,
      endDate: t.end_date,
      entries: list,
      tickets: (docs.data ?? []) as MapTicket[],
      toPlan: ((wishes.data ?? []) as PlannableWish[]).filter(w => !planned.has(w.id)),
    },
    error: null,
  };
}

export async function deletePlanningEntry(entryId: string): Promise<ServiceResult<true>> {
  const { error } = await supabase.from('planning_items').delete().eq('id', entryId);
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}
