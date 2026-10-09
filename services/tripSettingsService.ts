// HAKO — Service Paramètres d'un voyage
// Lecture (voyage + membres), modifications, décalage des dates,
// membres (retirer / quitter) et suppression.
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { TripSettings, TripSettingsMember, TripSettingsPatch } from '@/types/tripSettings';
import { TripVibe } from '@/types/tripStyle';
import { addDays } from '@/utils/tripStops';

interface TripRowDb {
  id: string;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  cover_image_url: string | null;
  owner_id: string;
  vibes: string[] | null;
  budget_per_person: number | null;
}

interface MemberRowDb {
  user_id: string;
  role: string | null;
  profile: { nickname: string | null; avatar_url: string | null } | null;
}

export async function getTripSettings(tripId: string): Promise<ServiceResult<TripSettings>> {
  const [trip, members] = await Promise.all([
    supabase.from('trips')
      .select('id, name, destination, start_date, end_date, cover_image_url, owner_id, vibes, budget_per_person')
      .eq('id', tripId).single(),
    supabase.from('trip_members')
      .select('user_id, role, profile:profiles(nickname, avatar_url)')
      .eq('trip_id', tripId),
  ]);
  if (trip.error || !trip.data) return serviceError(trip.error?.message ?? 'Voyage introuvable.');
  if (members.error) return serviceError(members.error.message);

  const row = trip.data as TripRowDb;
  const list: TripSettingsMember[] = ((members.data ?? []) as unknown as MemberRowDb[])
    .map(m => ({
      userId: m.user_id,
      nickname: m.profile?.nickname ?? 'Membre',
      avatarUrl: m.profile?.avatar_url ?? null,
      role: m.role === 'owner' || m.user_id === row.owner_id ? 'owner' as const : 'member' as const,
    }))
    .sort((a, b) => (a.role === b.role ? a.nickname.localeCompare(b.nickname) : a.role === 'owner' ? -1 : 1));

  return {
    data: {
      id: row.id,
      name: row.name,
      destination: row.destination,
      startDate: row.start_date,
      endDate: row.end_date,
      coverUrl: row.cover_image_url,
      ownerId: row.owner_id,
      vibes: (row.vibes ?? []) as TripVibe[],
      budgetPerPerson: row.budget_per_person,
      members: list,
    },
    error: null,
  };
}

export async function updateTripSettings(tripId: string, patch: TripSettingsPatch): Promise<ServiceResult<true>> {
  const { error } = await supabase.from('trips').update(patch).eq('id', tripId);
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}

/**
 * Décale tout le voyage de `days` jours (positif = plus tard) : dates du
 * voyage, des étapes et du planning, pour que tout reste aligné.
 */
export async function shiftTripDates(
  tripId: string,
  startDate: string,
  endDate: string,
  days: number,
): Promise<ServiceResult<true>> {
  if (days === 0) return { data: true, error: null };
  const [stops, items] = await Promise.all([
    supabase.from('trip_stops').select('id, start_date, end_date').eq('trip_id', tripId),
    supabase.from('planning_items').select('id, day_date').eq('trip_id', tripId),
  ]);
  if (stops.error) return serviceError(stops.error.message);
  if (items.error) return serviceError(items.error.message);

  const updates = [
    supabase.from('trips')
      .update({ start_date: addDays(startDate, days), end_date: addDays(endDate, days) })
      .eq('id', tripId),
    ...((stops.data ?? []) as { id: string; start_date: string; end_date: string }[]).map(s =>
      supabase.from('trip_stops')
        .update({ start_date: addDays(s.start_date, days), end_date: addDays(s.end_date, days) })
        .eq('id', s.id)),
    ...((items.data ?? []) as { id: string; day_date: string }[]).map(i =>
      supabase.from('planning_items').update({ day_date: addDays(i.day_date, days) }).eq('id', i.id)),
  ];
  const results = await Promise.all(updates);
  const failed = results.find(r => r.error);
  if (failed?.error) return serviceError(failed.error.message);
  return { data: true, error: null };
}

/** Retire un membre (organisateur) ou se retire soi-même (« Quitter le voyage »). */
export async function removeTripMember(tripId: string, userId: string): Promise<ServiceResult<true>> {
  const { error } = await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', userId);
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}

/** Supprime le voyage (organisateur). Les tables liées suivent par cascade. */
export async function deleteTrip(tripId: string): Promise<ServiceResult<true>> {
  const { error: memberError } = await supabase.from('trip_members').delete().eq('trip_id', tripId);
  if (memberError) return serviceError(memberError.message);
  const { error } = await supabase.from('trips').delete().eq('id', tripId);
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}
