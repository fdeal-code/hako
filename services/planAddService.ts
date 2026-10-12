// HAKO — Service Ajout au planning : jours du voyage, envies validées pas
// encore planifiées, créneaux existants (chevauchements), création.
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { track } from '@/services/telemetryService';

export interface PlanCandidate {
  id: string;
  title: string;
  image_url: string | null;
  category: string | null;
  stop_id: string | null;
  address: string | null;
  duration_minutes: number | null;
  price_per_person: number | null;
}

export interface DaySlot {
  id: string;
  title: string;
  day_date: string;
  start_time: string | null;
  end_time: string | null;
}

export interface PlanAddData {
  startDate: string;
  endDate: string;
  candidates: PlanCandidate[];   // envies validées pas encore planifiées
  allWishes: PlanCandidate[];    // toutes les envies validées (ouverture depuis une envie)
  slots: DaySlot[];
}

export async function getPlanAddData(tripId: string): Promise<ServiceResult<PlanAddData>> {
  const [trip, wishes, items] = await Promise.all([
    supabase.from('trips').select('start_date, end_date').eq('id', tripId).single(),
    supabase.from('wishes')
      .select('id, title, image_url, category, stop_id, address, duration_minutes, price_per_person')
      .eq('trip_id', tripId).eq('status', 'validated').neq('type', 'orga'),
    supabase.from('planning_items').select('id, title, day_date, start_time, end_time, wish_id').eq('trip_id', tripId),
  ]);
  const failed = [trip, wishes, items].find(r => r.error);
  if (failed?.error) return serviceError(failed.error.message);
  if (!trip.data) return serviceError('Voyage introuvable.');

  const slots = (items.data ?? []) as (DaySlot & { wish_id: string | null })[];
  const planned = new Set(slots.map(s => s.wish_id).filter(Boolean));
  const t = trip.data as { start_date: string; end_date: string };
  return {
    data: {
      startDate: t.start_date,
      endDate: t.end_date,
      candidates: ((wishes.data ?? []) as PlanCandidate[]).filter(w => !planned.has(w.id)),
      allWishes: (wishes.data ?? []) as PlanCandidate[],
      slots,
    },
    error: null,
  };
}

export interface NewPlanningEntry {
  tripId: string;
  wishId: string | null;
  title: string;
  day: string;
  start: string;
  end: string;
  notes: string | null;
  stopId: string | null;
  userId: string | null;
}

export async function createPlanningEntry(input: NewPlanningEntry): Promise<ServiceResult<{ id: string }>> {
  const { data, error } = await supabase.from('planning_items').insert({
    trip_id: input.tripId,
    wish_id: input.wishId,
    title: input.title.trim(),
    day_date: input.day,
    start_time: input.start,
    end_time: input.end,
    notes: input.notes?.trim() || null,
    stop_id: input.stopId,
    added_by: input.userId,
    sort_order: 0,
    is_locked: false,
  }).select('id').single();
  if (error) return serviceError(error.message);
  track('planning_added', { from_wish: !!input.wishId }, input.tripId);
  return { data: { id: (data as { id: string }).id }, error: null };
}
