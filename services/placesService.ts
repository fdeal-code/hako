// HAKO — Service Google (Geocoding)
// Le repo utilisait déjà la Geocoding API à l'exécution (dashboards) pour
// centrer les cartes ; ce service en fait la source unique réutilisable.
// Clé requise dans .env : EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.
// Sans clé ou en cas d'erreur (réseau, quota), retourne null — l'appelant
// doit gérer le fallback (trip sans coordonnées, carte en état vide).

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const STATUS_OK = 'OK';

export interface DestinationCoords {
  lat: number;
  lng: number;
  placeId: string;
}

interface GeocodeResponse {
  status?: string;
  results?: {
    geometry: { location: { lat: number; lng: number } };
    place_id: string;
  }[];
}

/**
 * Résout une destination texte en coordonnées + place_id.
 * `countryCode` (ISO 3166-1 alpha-2, ex. "PT") restreint la recherche au
 * pays — utile pour les destinations IA de Trip Match ("Porto" + "PT").
 */
export async function geocodeDestination(
  destination: string,
  countryCode?: string | null,
): Promise<DestinationCoords | null> {
  if (!GOOGLE_API_KEY || destination.trim().length === 0) return null;
  try {
    const params = new URLSearchParams({
      address: destination.trim(),
      key: GOOGLE_API_KEY,
    });
    if (countryCode) params.set('components', `country:${countryCode}`);
    const response = await fetch(`${GEOCODE_URL}?${params.toString()}`);
    if (!response.ok) return null;
    const json = (await response.json()) as GeocodeResponse;
    const result = json.results?.[0];
    if (json.status !== STATUS_OK || !result) return null;
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      placeId: result.place_id,
    };
  } catch {
    return null; // réseau indisponible — fallback silencieux
  }
}

// ─── Autocomplete villes (Places API) ─────────────────────────────────────────
const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';

export interface CitySuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface AutocompleteResponse {
  status?: string;
  predictions?: CitySuggestion[];
}

/** Villes correspondant à la saisie (vide sans clé / en cas d'erreur). */
export async function searchCities(query: string): Promise<CitySuggestion[]> {
  if (!GOOGLE_API_KEY || query.trim().length === 0) return [];
  try {
    const params = new URLSearchParams({
      input: query.trim(),
      types: '(cities)',
      language: 'fr',
      key: GOOGLE_API_KEY,
    });
    const response = await fetch(`${AUTOCOMPLETE_URL}?${params.toString()}`);
    if (!response.ok) return [];
    const json = (await response.json()) as AutocompleteResponse;
    return json.status === STATUS_OK ? json.predictions ?? [] : [];
  } catch {
    return []; // réseau indisponible — retour silencieux
  }
}
