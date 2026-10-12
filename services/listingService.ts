// HAKO — Service Annonces de logement : lecture du lien ou d'une capture
// (fonction serveur parse-listing). Rien n'est écrit en base.
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { FunctionsHttpError } from '@supabase/supabase-js';
import { File } from 'expo-file-system';

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';

const FN_PARSE_LISTING = 'parse-listing';

export interface ListingPreview {
  name: string | null;
  photos: string[];
  address: string | null;
  rating: number | null;
  priceTotal: number | null;
  currency: string | null;
}

export interface ListingRead {
  /** La plateforme bloque la lecture automatique (ex. Booking) */
  blocked: boolean;
  /** Site non pris en charge (pas une plateforme de logement connue) */
  unsupported: boolean;
  listing: ListingPreview | null;
}

async function functionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { message?: string; error?: string };
      return body.message ?? body.error ?? error.message;
    } catch { return error.message; }
  }
  return error instanceof Error ? error.message : 'Lecture impossible.';
}

export async function readListingUrl(tripId: string, url: string): Promise<ServiceResult<ListingRead>> {
  const { data, error } = await supabase.functions.invoke<ListingRead>(FN_PARSE_LISTING, { body: { trip_id: tripId, url } });
  if (error) return serviceError(await functionError(error));
  return { data: { blocked: !!data?.blocked, unsupported: !!data?.unsupported, listing: data?.listing ?? null }, error: null };
}

export async function readListingScreenshot(tripId: string, uri: string, mimeType: string, nights: number): Promise<ServiceResult<ListingPreview | null>> {
  let base64: string;
  try { base64 = await new File(uri).base64(); } catch { return serviceError('Impossible de lire cette image.'); }
  const { data, error } = await supabase.functions.invoke<ListingRead>(FN_PARSE_LISTING, {
    body: { trip_id: tripId, image: { base64, media_type: mimeType }, nights },
  });
  if (error) return serviceError(await functionError(error));
  return { data: data?.listing ?? null, error: null };
}
