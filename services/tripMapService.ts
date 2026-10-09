// HAKO — Service Carte : billets de transport et lieux géolocalisés du groupe
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { MapPlace, MapTicket } from '@/types/tripMap';

interface WishRowDb {
  id: string;
  title: string;
  category: string | null;
  status: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  stop_id: string | null;
  image_url: string | null;
  booked_at: string | null;
}

interface PlannedRowDb { wish_id: string; day_date: string; start_time: string | null }

export async function getTripMap(tripId: string): Promise<ServiceResult<{ tickets: MapTicket[]; places: MapPlace[] }>> {
  const [docs, wishes, planned] = await Promise.all([
    supabase.from('documents').select('id, title, category, event_date, details')
      .eq('trip_id', tripId).in('category', ['flight', 'transport']),
    supabase.from('wishes')
      .select('id, title, category, status, address, latitude, longitude, stop_id, image_url, booked_at')
      .eq('trip_id', tripId).in('status', ['validated', 'pending', 'debate']).neq('type', 'orga'),
    supabase.from('planning_items').select('wish_id, day_date, start_time')
      .eq('trip_id', tripId).not('wish_id', 'is', null)
      .order('day_date', { ascending: true }).order('start_time', { ascending: true }),
  ]);
  const failed = [docs, wishes, planned].find(r => r.error);
  if (failed?.error) return serviceError(failed.error.message);

  const firstSlot = new Map<string, PlannedRowDb>();
  for (const p of (planned.data ?? []) as PlannedRowDb[]) if (!firstSlot.has(p.wish_id)) firstSlot.set(p.wish_id, p);

  const places: MapPlace[] = ((wishes.data ?? []) as WishRowDb[])
    .filter((w): w is WishRowDb & { latitude: number; longitude: number } => w.latitude !== null && w.longitude !== null)
    .map(w => {
      const slot = firstSlot.get(w.id);
      return {
        id: w.id, title: w.title, category: w.category, status: w.status, address: w.address,
        latitude: w.latitude, longitude: w.longitude, stopId: w.stop_id, imageUrl: w.image_url,
        booked: w.booked_at !== null || w.category === 'hotel',
        plannedDay: slot?.day_date ?? null, plannedTime: slot?.start_time?.slice(0, 5) ?? null,
      };
    });

  return { data: { tickets: (docs.data ?? []) as MapTicket[], places }, error: null };
}
