// HAKO — Service Trips
//
// Pattern service : Screen → Hook → Service → Supabase.
// Chaque fonction retourne un ServiceResult<T> — jamais de throw :
//   { data: T, error: null }  en cas de succès
//   { data: null, error: string } en cas d'échec (message affichable)

import { supabase } from '@/services/supabase';
import { fileExtension, uploadLocalFile } from '@/services/storageService';
import { UserRole } from '@/constants/types';

export type ServiceResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export function serviceError<T>(message: string): ServiceResult<T> {
  return { data: null, error: message };
}

const ROLE_OWNER: UserRole = 'owner';

/** Ligne `trips` telle qu'en base (colonnes réelles : owner_id, cover_image_url). */
export interface TripRow {
  id: string;
  name: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  owner_id: string | null;
  created_at: string;
  destination_lat: number | null;
  destination_lng: number | null;
  destination_place_id: string | null;
  vibes: string[];
  budget_per_person: number | null;
}

export interface CreateTripInput {
  name: string;
  destination: string;
  start_date: string | null;      // "YYYY-MM-DD"
  end_date: string | null;        // "YYYY-MM-DD"
  cover_image_url: string | null;
  owner_id: string | null;
  // Coordonnées de la destination (géocodage à la création — Trip Match).
  // Optionnelles : sans elles, les dashboards géocodent à l'exécution.
  destination_lat?: number | null;
  destination_lng?: number | null;
  destination_place_id?: string | null;
  // Style & budget (étape optionnelle de la création)
  vibes?: readonly string[];
  budget_per_person?: number | null;
}

/**
 * Crée un trip + la ligne trip_members du propriétaire.
 * Logique extraite de app/trip/create.tsx (source unique — utilisée aussi
 * par tripMatchService.completeMatch).
 *
 * Colonnes NOT NULL de `trips` : name, destination, start_date, end_date.
 * On les vérifie ici pour renvoyer un message exploitable plutôt qu'une
 * violation de contrainte SQL brute.
 */
export async function createTrip(input: CreateTripInput): Promise<ServiceResult<TripRow>> {
  if (input.name.trim().length === 0 || input.destination.trim().length === 0) {
    return serviceError('Le nom et la destination du voyage sont obligatoires.');
  }
  if (input.start_date === null || input.end_date === null) {
    return serviceError('Les dates du voyage sont obligatoires (début et fin).');
  }

  const payload: Record<string, unknown> = {
    name:            input.name,
    destination:     input.destination,
    start_date:      input.start_date,
    end_date:        input.end_date,
    cover_image_url: input.cover_image_url,
  };
  if (input.owner_id) payload.owner_id = input.owner_id;
  if (input.destination_lat != null && input.destination_lng != null) {
    payload.destination_lat = input.destination_lat;
    payload.destination_lng = input.destination_lng;
    payload.destination_place_id = input.destination_place_id ?? null;
  }
  if (input.vibes && input.vibes.length > 0) payload.vibes = [...input.vibes];
  if (input.budget_per_person != null) payload.budget_per_person = input.budget_per_person;

  const { data, error } = await supabase
    .from('trips')
    .insert(payload)
    .select()
    .single();
  if (error || !data) {
    return serviceError(error?.message ?? 'Création du voyage impossible.');
  }
  const trip = data as TripRow;

  const { error: memberError } = await supabase
    .from('trip_members')
    .insert({ trip_id: trip.id, user_id: input.owner_id, role: ROLE_OWNER });
  if (memberError) {
    return serviceError(`Voyage créé mais ajout du propriétaire impossible : ${memberError.message}`);
  }

  return { data: trip, error: null };
}

/** Infos utiles aux suggestions « On t'aide » : dates, style, budget, nb de voyageurs. */
export interface TripOverview {
  id: string;
  name: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  vibes: string[];
  budget_per_person: number | null;
  member_count: number;
}

export async function getTripOverview(tripId: string): Promise<ServiceResult<TripOverview>> {
  const { data, error } = await supabase
    .from('trips')
    .select('id, name, destination, start_date, end_date, vibes, budget_per_person')
    .eq('id', tripId)
    .single();
  if (error || !data) return serviceError(error?.message ?? 'Voyage introuvable.');

  const { count, error: countError } = await supabase
    .from('trip_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('trip_id', tripId);
  if (countError) return serviceError(countError.message);

  const row = data as Omit<TripOverview, 'member_count' | 'vibes'> & { vibes: string[] | null };
  return {
    data: { ...row, vibes: row.vibes ?? [], member_count: count ?? 1 },
    error: null,
  };
}

// ─── Couverture & invitations (création de voyage) ───────────────────────────
const COVERS_BUCKET = 'covers';

/** Envoie une photo de la galerie dans le bucket `covers` et renvoie son URL publique. */
export async function uploadCoverImage(userId: string, localUri: string): Promise<ServiceResult<string>> {
  return uploadLocalFile(COVERS_BUCKET, `${userId}/${Date.now()}.${fileExtension(localUri)}`, localUri);
}

/** Invitations par e-mail (table `invitations`, statut pending). */
export async function inviteByEmails(
  tripId: string,
  emails: readonly string[],
  invitedBy: string,
): Promise<ServiceResult<true>> {
  if (emails.length === 0) return { data: true, error: null };
  const { error } = await supabase.from('invitations').insert(
    emails.map(email => ({ trip_id: tripId, invited_email: email, invited_by: invitedBy, status: 'pending' })),
  );
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}
