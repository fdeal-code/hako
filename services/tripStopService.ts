// HAKO — Service étapes de voyage (trip_stops)
// Pattern service : ServiceResult<T> (voir tripService.ts) — jamais de throw.

import { geocodeDestination } from '@/services/placesService';
import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { NewTripStop, StopDraft, TripStop, TripStopUpdate } from '@/types/tripStops';
import { addDays, buildDestinationLabel, splitDatesIntoStops } from '@/utils/tripStops';

const TABLE = 'trip_stops';
// Décalage temporaire pour réordonner sans heurter la contrainte unique
// (trip_id, position) : chaque requête REST est sa propre transaction.
const REORDER_OFFSET = 1000;

/** Étapes d'un trip, dans l'ordre du voyage. */
export async function getTripStops(tripId: string): Promise<ServiceResult<TripStop[]>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('trip_id', tripId)
    .order('position', { ascending: true });
  if (error) return serviceError(error.message);
  return { data: (data ?? []) as TripStop[], error: null };
}

/**
 * Brouillons du formulaire → étapes datées et géocodées, prêtes à insérer.
 * Le géocodage est « best effort » : une ville non résolue garde lat/lng null
 * (la carte affichera alors un état vide pour cette étape).
 */
export async function buildStopsFromDrafts(
  tripStartDate: string,
  drafts: readonly StopDraft[],
): Promise<NewTripStop[]> {
  const dated = splitDatesIntoStops(tripStartDate, drafts);
  return Promise.all(dated.map(async (stop, i) => {
    const draft = drafts[i];
    const coords = draft ? await geocodeDestination(draft.description) : null;
    return {
      ...stop,
      place_id: stop.place_id ?? coords?.placeId ?? null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    };
  }));
}

/** Insère les étapes d'un trip (positions attribuées dans l'ordre du tableau). */
export async function createTripStops(
  tripId: string,
  stops: readonly NewTripStop[],
): Promise<ServiceResult<TripStop[]>> {
  if (stops.length === 0) return serviceError('Ajoute au moins une ville.');
  const rows = stops.map((stop, position) => ({ ...stop, trip_id: tripId, position }));
  const { data, error } = await supabase
    .from(TABLE)
    .insert(rows)
    .select()
    .order('position', { ascending: true });
  if (error || !data) return serviceError(error?.message ?? 'Ajout des étapes impossible.');
  return { data: data as TripStop[], error: null };
}

/** Ajoute une étape à la fin du voyage. */
export async function appendTripStop(
  tripId: string,
  stop: NewTripStop,
  position: number,
): Promise<ServiceResult<TripStop>> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...stop, trip_id: tripId, position })
    .select()
    .single();
  if (error || !data) return serviceError(error?.message ?? 'Ajout de l’étape impossible.');
  return { data: data as TripStop, error: null };
}

export async function updateTripStop(
  stopId: string,
  update: TripStopUpdate,
): Promise<ServiceResult<TripStop>> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(update)
    .eq('id', stopId)
    .select()
    .single();
  if (error || !data) return serviceError(error?.message ?? 'Modification de l’étape impossible.');
  return { data: data as TripStop, error: null };
}

/**
 * Supprime une étape. Les envies / items de planning / dépenses rattachés
 * passent à stop_id = null (ON DELETE SET NULL) : rien n'est perdu.
 */
export async function deleteTripStop(stopId: string): Promise<ServiceResult<true>> {
  const { error } = await supabase.from(TABLE).delete().eq('id', stopId);
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}

/** Réordonne les étapes selon `orderedStopIds` (drag & drop). */
export async function reorderTripStops(
  orderedStopIds: readonly string[],
): Promise<ServiceResult<true>> {
  // 1. Positions temporaires hors plage pour libérer 0..n-1
  for (const [index, id] of orderedStopIds.entries()) {
    const { error } = await supabase.from(TABLE).update({ position: REORDER_OFFSET + index }).eq('id', id);
    if (error) return serviceError(error.message);
  }
  // 2. Positions finales
  for (const [index, id] of orderedStopIds.entries()) {
    const { error } = await supabase.from(TABLE).update({ position: index }).eq('id', id);
    if (error) return serviceError(error.message);
  }
  return { data: true, error: null };
}

/** Une étape et son nombre de nuits, dans l'ordre voulu du voyage. */
export interface StopLayoutEntry {
  id: string;
  nights: number;
}

/**
 * Applique un nouvel agencement (ordre + nuits) : positions puis dates
 * recalculées depuis le début du voyage. Utilisé après un réordonnancement,
 * une modification des nuits ou la suppression d'une étape.
 */
export async function saveStopLayout(
  tripStartDate: string,
  layout: readonly StopLayoutEntry[],
): Promise<ServiceResult<true>> {
  const reorder = await reorderTripStops(layout.map(e => e.id));
  if (reorder.error !== null) return reorder;
  let cursor = tripStartDate;
  for (const entry of layout) {
    const start = cursor;
    const end = addDays(start, entry.nights);
    cursor = end;
    const { error } = await supabase.from(TABLE).update({ start_date: start, end_date: end }).eq('id', entry.id);
    if (error) return serviceError(error.message);
  }
  return { data: true, error: null };
}

/** Garde `trips.destination` (libellé « Rome, Florence +1 ») aligné sur les étapes. */
export async function syncTripDestinationLabel(
  tripId: string,
  placeNames: readonly string[],
): Promise<ServiceResult<true>> {
  if (placeNames.length === 0) return { data: true, error: null };
  const { error } = await supabase
    .from('trips')
    .update({ destination: buildDestinationLabel(placeNames) })
    .eq('id', tripId);
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}
