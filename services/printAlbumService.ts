// HAKO — Service Album imprimé (liste d'attente, table print_album_requests)
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { PrintAlbumRequest, PrintFormat } from '@/types/printAlbum';

const TABLE = 'print_album_requests';

/** Ma demande pour ce voyage (null si pas encore demandé) + nombre de demandes du groupe. */
export async function getPrintRequests(
  tripId: string,
  userId: string,
): Promise<ServiceResult<{ mine: PrintAlbumRequest | null; groupCount: number }>> {
  const { data, error } = await supabase.from(TABLE).select('user_id, format, photo_count, created_at').eq('trip_id', tripId);
  if (error) return serviceError(error.message);
  const rows = (data ?? []) as (PrintAlbumRequest & { user_id: string })[];
  const mine = rows.find(r => r.user_id === userId) ?? null;
  return { data: { mine, groupCount: rows.length }, error: null };
}

export async function requestPrintAlbum(
  tripId: string,
  userId: string,
  format: PrintFormat,
  photoCount: number,
): Promise<ServiceResult<true>> {
  const { error } = await supabase.from(TABLE).upsert(
    { trip_id: tripId, user_id: userId, format, photo_count: photoCount },
    { onConflict: 'trip_id,user_id' },
  );
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}
