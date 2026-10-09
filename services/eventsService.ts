// HAKO — Service événements sur place
// Lecture du cache `trip_events` + déclenchement de l'Edge Function
// `fetch-trip-events` (la clé Ticketmaster reste côté serveur).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { TripEvent } from '@/types/events';

const FUNCTION_NAME = 'fetch-trip-events';

export async function getTripEvents(tripId: string): Promise<ServiceResult<TripEvent[]>> {
  const { data, error } = await supabase
    .from('trip_events')
    .select('*')
    .eq('trip_id', tripId)
    .order('local_date', { ascending: true })
    .order('starts_at', { ascending: true });
  if (error) return serviceError(error.message);
  return { data: (data ?? []) as TripEvent[], error: null };
}

/** Rafraîchit le cache (24 h côté serveur, sauf `force`). */
export async function refreshTripEvents(tripId: string, force = false): Promise<ServiceResult<true>> {
  const { error } = await supabase.functions.invoke(FUNCTION_NAME, { body: { trip_id: tripId, force } });
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}

/** Ajoute un événement aux envies (« À voter »), rangé dans la bonne ville. */
export async function addEventToWishes(event: TripEvent, userId: string): Promise<ServiceResult<true>> {
  const { error } = await supabase.from('wishes').insert({
    trip_id:   event.trip_id,
    added_by:  userId,
    title:     event.title,
    status:    'pending',
    type:      'place',
    category:  'activity',
    image_url: event.image_url,
    link_url:  event.ticket_url,
    address:   event.venue_name,
    latitude:  event.lat,
    longitude: event.lng,
    stop_id:   event.stop_id,
    event_id:  event.id,
  });
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}
