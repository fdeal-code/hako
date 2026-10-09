// HAKO — Service Mes voyages (liste légère : écran de partage vers Hako)
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';

export interface MyTrip {
  id: string;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  cover_image_url: string | null;
}

export async function getMyTrips(userId: string): Promise<ServiceResult<MyTrip[]>> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('trip:trips(id, name, destination, start_date, end_date, cover_image_url)')
    .eq('user_id', userId);
  if (error) return serviceError(error.message);
  const trips = ((data ?? []) as unknown as { trip: MyTrip | null }[]).flatMap(r => (r.trip ? [r.trip] : []));
  return { data: trips, error: null };
}
