// HAKO — Service lien d'invitation (rejoindre un voyage via WhatsApp)
// Pattern service : ServiceResult<T> (voir tripService.ts).

import * as Crypto from 'expo-crypto';

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { InvitePreview } from '@/types/invite';
import { track } from '@/services/telemetryService';

const TABLE = 'trip_invite_links';
const INVALID_TOKEN = 'invalid_token';

/** Lien actif du voyage, créé au besoin (un seul lien partagé par voyage). */
export async function getOrCreateInviteToken(
  tripId: string,
  userId: string,
): Promise<ServiceResult<string>> {
  const { data: existing, error: readError } = await supabase
    .from(TABLE)
    .select('token')
    .eq('trip_id', tripId)
    .eq('revoked', false)
    .limit(1)
    .maybeSingle();
  if (readError) return serviceError(readError.message);
  const found = existing as { token: string } | null;
  if (found) return { data: found.token, error: null };

  const token = Crypto.randomUUID().replace(/-/g, '');
  const { error } = await supabase.from(TABLE).insert({ token, trip_id: tripId, created_by: userId });
  if (error) return serviceError(error.message);
  return { data: token, error: null };
}

/** Aperçu du voyage (fonctionne aussi sans compte). null si le lien est invalide. */
export async function getInvitePreview(token: string): Promise<ServiceResult<InvitePreview | null>> {
  const { data, error } = await supabase.rpc('get_invite_preview', { p_token: token });
  if (error) return serviceError(error.message);
  return { data: (data as InvitePreview | null) ?? null, error: null };
}

/** Rejoint le voyage (connecté). Retourne l'id du voyage. */
export async function joinTripWithToken(token: string): Promise<ServiceResult<string>> {
  const { data, error } = await supabase.rpc('join_trip_with_token', { p_token: token });
  if (error) {
    return serviceError(error.message.includes(INVALID_TOKEN)
      ? 'Ce lien d’invitation n’est plus valide.'
      : error.message);
  }
  track('trip_joined', { via: 'link' }, data as string);
  return { data: data as string, error: null };
}
