// HAKO — Service Fiche activité : créneau du planning + envie liée + votes,
// membres, étape et billet du jour ; changement d'horaire.
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { ActivityDetail } from '@/types/activity';
import { MapTicket } from '@/types/tripMap';

const ITEM_FIELDS = 'id, trip_id, title, day_date, start_time, end_time, notes, stop_id, is_locked, added_by, wish_id, '
  + 'wish:wish_id(id, title, description, category, image_url, address, latitude, longitude, google_rating, '
  + 'link_url, links, status, booked_at, booked_amount, budget, price_per_person, duration_minutes, added_by, wish_votes(user_id, vote))';

interface MemberRowDb { user_id: string; profile: { nickname: string | null; avatar_url: string | null } | null }

export async function getActivity(itemId: string): Promise<ServiceResult<ActivityDetail>> {
  const { data: item, error } = await supabase.from('planning_items').select(ITEM_FIELDS).eq('id', itemId).single();
  if (error || !item) return serviceError(error?.message ?? 'Activité introuvable.');
  const entry = item as unknown as ActivityDetail['item'];

  const [members, stop, docs] = await Promise.all([
    supabase.from('trip_members').select('user_id, profile:profiles(nickname, avatar_url)').eq('trip_id', entry.trip_id),
    entry.stop_id
      ? supabase.from('trip_stops').select('id, position, place_name').eq('id', entry.stop_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('documents').select('id, title, category, event_date, details')
      .eq('trip_id', entry.trip_id).eq('event_date', entry.day_date),
  ]);
  if (members.error) return serviceError(members.error.message);
  if (docs.error) return serviceError(docs.error.message);

  return {
    data: {
      item: entry,
      members: ((members.data ?? []) as unknown as MemberRowDb[]).map(m => ({
        userId: m.user_id, nickname: m.profile?.nickname ?? 'Membre', avatarUrl: m.profile?.avatar_url ?? null,
      })),
      stop: (stop.data as ActivityDetail['stop']) ?? null,
      dayDocs: (docs.data ?? []) as MapTicket[],
    },
    error: null,
  };
}

export async function updateActivityTime(itemId: string, start: string, end: string): Promise<ServiceResult<true>> {
  const { error } = await supabase.from('planning_items').update({ start_time: start, end_time: end }).eq('id', itemId);
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}
