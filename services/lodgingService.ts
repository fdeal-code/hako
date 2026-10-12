// HAKO — Service Logements : ce qui couvre déjà les nuits du voyage
// (documents de logement, envies logement réservées, check-in au planning).
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { LodgingCoverage } from '@/utils/lodgingGaps';

const CHECK_IN_PREFIX = 'Check-in';

export async function getLodgingCoverage(tripId: string): Promise<ServiceResult<LodgingCoverage>> {
  const [docs, wishes, planning] = await Promise.all([
    supabase.from('documents').select('event_date').eq('trip_id', tripId).eq('category', 'hotel').not('event_date', 'is', null),
    supabase.from('wishes').select('stop_id').eq('trip_id', tripId).eq('category', 'hotel').not('booked_at', 'is', null),
    supabase.from('planning_items').select('day_date').eq('trip_id', tripId).ilike('title', `${CHECK_IN_PREFIX}%`),
  ]);
  const failed = docs.error ?? wishes.error ?? planning.error;
  if (failed) return serviceError(failed.message);
  return {
    data: {
      hotelDays: ((docs.data ?? []) as { event_date: string }[]).map(d => d.event_date),
      bookedStopIds: ((wishes.data ?? []) as { stop_id: string | null }[]).flatMap(w => (w.stop_id ? [w.stop_id] : [])),
      checkInDays: ((planning.data ?? []) as { day_date: string }[]).map(p => p.day_date),
    },
    error: null,
  };
}
