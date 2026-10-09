// HAKO — Service Envies : aperçu de lien (oEmbed), lieux Google, création
// Pattern service : ServiceResult<T> (voir tripService.ts) pour les écritures ;
// les lectures externes (oEmbed, Places) renvoient null / [] en cas d'échec,
// l'écran garde alors un fonctionnement manuel.

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { FoundPlace, LinkPreview, NewWishInput, PlaceSuggestion } from '@/types/wishDraft';
import { captionToQuery, detectLinkSource, distanceKm } from '@/utils/wishLinks';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const PLACES_URL = 'https://maps.googleapis.com/maps/api/place';
const STATUS_OK = 'OK';
const BIAS_RADIUS_M = 50_000;
const MAX_STOP_DISTANCE_KM = 150; // au-delà, le lieu « trouvé » n'est pas dans le voyage
const PHOTO_MAX_WIDTH = 600;
const MIN_QUERY_LENGTH = 3;

const OEMBED_URL: Partial<Record<LinkPreview['source'], string>> = {
  tiktok:  'https://www.tiktok.com/oembed?url=',
  youtube: 'https://www.youtube.com/oembed?format=json&url=',
};

interface OEmbedResponse {
  title?: string;
  thumbnail_url?: string;
  author_name?: string;
  author_unique_id?: string;
  error?: string;
}

/**
 * Miniature + légende + compte via oEmbed (TikTok, YouTube).
 * Instagram exige un jeton Meta : on renvoie un aperçu minimal.
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const source = detectLinkSource(url);
  const fallback: LinkPreview = { url, source, title: '', thumbnail: null, author: null };
  const endpoint = OEMBED_URL[source];
  if (!endpoint) return fallback;
  try {
    const response = await fetch(`${endpoint}${encodeURIComponent(url)}`);
    if (!response.ok) return fallback;
    const json = (await response.json()) as OEmbedResponse;
    if (json.error) return fallback;
    return {
      url,
      source,
      title: json.title ?? '',
      thumbnail: json.thumbnail_url ?? null,
      author: json.author_unique_id ?? json.author_name ?? null,
    };
  } catch {
    return fallback;
  }
}

// ─── Google Places ───────────────────────────────────────────────────────────
interface LatLngBias { lat: number; lng: number }

interface PlaceResult {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  rating?: number;
  types?: string[];
  photos?: { photo_reference: string }[];
  geometry?: { location: { lat: number; lng: number } };
}

function toFoundPlace(result: PlaceResult): FoundPlace | null {
  const location = result.geometry?.location;
  if (!result.place_id || !location) return null;
  const photoRef = result.photos?.[0]?.photo_reference;
  return {
    placeId: result.place_id,
    name: result.name ?? '',
    address: result.formatted_address ?? '',
    lat: location.lat,
    lng: location.lng,
    rating: result.rating ?? null,
    photoUrl: photoRef
      ? `${PLACES_URL}/photo?maxwidth=${PHOTO_MAX_WIDTH}&photo_reference=${photoRef}&key=${GOOGLE_API_KEY}`
      : null,
    types: result.types ?? [],
  };
}

/** Suggestions de lieux, biaisées autour de la ville du voyage. */
export async function searchPlaces(query: string, bias: LatLngBias | null): Promise<PlaceSuggestion[]> {
  if (!GOOGLE_API_KEY || query.trim().length < MIN_QUERY_LENGTH) return [];
  const params = new URLSearchParams({ input: query.trim(), language: 'fr', key: GOOGLE_API_KEY });
  if (bias) {
    params.set('location', `${bias.lat},${bias.lng}`);
    params.set('radius', String(BIAS_RADIUS_M));
  }
  try {
    const response = await fetch(`${PLACES_URL}/autocomplete/json?${params.toString()}`);
    const json = (await response.json()) as { status?: string; predictions?: PlaceSuggestion[] };
    return json.status === STATUS_OK ? json.predictions ?? [] : [];
  } catch {
    return [];
  }
}

const DETAIL_FIELDS = 'place_id,geometry,formatted_address,name,rating,photos,types';

export async function getPlaceDetails(placeId: string): Promise<FoundPlace | null> {
  if (!GOOGLE_API_KEY) return null;
  const params = new URLSearchParams({ place_id: placeId, fields: DETAIL_FIELDS, language: 'fr', key: GOOGLE_API_KEY });
  try {
    const response = await fetch(`${PLACES_URL}/details/json?${params.toString()}`);
    const json = (await response.json()) as { status?: string; result?: PlaceResult };
    return json.status === STATUS_OK && json.result ? toFoundPlace(json.result) : null;
  } catch {
    return null;
  }
}

/**
 * « Lieu trouvé » : cherche un lieu nommé dans la légende de la vidéo, puis
 * vérifie qu'il est proche d'une étape du voyage (sinon null → l'utilisateur
 * choisit lui-même avec « Ajouter un lieu »).
 */
export async function findPlaceInCaption(
  caption: string,
  stops: readonly { lat: number | null; lng: number | null }[],
): Promise<FoundPlace | null> {
  const query = captionToQuery(caption);
  if (!GOOGLE_API_KEY || query.length < MIN_QUERY_LENGTH) return null;
  const located = stops.filter((s): s is { lat: number; lng: number } => s.lat !== null && s.lng !== null);
  const params = new URLSearchParams({
    input: query,
    inputtype: 'textquery',
    fields: DETAIL_FIELDS,
    language: 'fr',
    key: GOOGLE_API_KEY,
  });
  const first = located[0];
  if (first) params.set('locationbias', `circle:${BIAS_RADIUS_M}@${first.lat},${first.lng}`);
  try {
    const response = await fetch(`${PLACES_URL}/findplacefromtext/json?${params.toString()}`);
    const json = (await response.json()) as { status?: string; candidates?: PlaceResult[] };
    const candidate = json.status === STATUS_OK ? json.candidates?.[0] : undefined;
    const place = candidate ? toFoundPlace(candidate) : null;
    if (!place) return null;
    if (located.length === 0) return place;
    const close = located.some(s => distanceKm(s.lat, s.lng, place.lat, place.lng) <= MAX_STOP_DISTANCE_KM);
    return close ? place : null;
  } catch {
    return null;
  }
}

// ─── Création ────────────────────────────────────────────────────────────────
export async function createWish(input: NewWishInput): Promise<ServiceResult<{ id: string }>> {
  const row: Record<string, unknown> = {
    trip_id: input.tripId,
    added_by: input.addedBy,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    status: 'pending',
    type: input.kind,
    link_url: input.linkUrl,
    image_url: input.imageUrl ?? input.place?.photoUrl ?? null,
    category: input.category,
    stop_id: input.stopId,
    vibes: input.vibes,
    price_per_person: input.pricePerPerson,
    duration_minutes: input.durationMinutes,
  };
  if (input.place) {
    row.address = input.place.address;
    row.latitude = input.place.lat;
    row.longitude = input.place.lng;
    row.google_rating = input.place.rating;
  }
  let { data, error } = await supabase.from('wishes').insert(row).select('id').single();
  // Migration wish_vibes pas encore appliquée : on enregistre sans les ambiances
  if (error && error.message.includes('vibes')) {
    delete row.vibes;
    ({ data, error } = await supabase.from('wishes').insert(row).select('id').single());
  }
  if (error) return serviceError(error.message);
  return { data: { id: (data as { id: string }).id }, error: null };
}
