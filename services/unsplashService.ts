// HAKO — Service Unsplash (client de référence)
// ⚠️ Contrairement à ce qu'indique CLAUDE.md, aucune intégration Unsplash
// n'existait dans le code (trip/create.tsx utilise des placeholders picsum) :
// ce service devient la source unique. Clé requise dans .env :
//   EXPO_PUBLIC_UNSPLASH_ACCESS_KEY=...
// Sans clé ou en cas d'erreur, les appels renvoient null (fallback gradient).
//
// Guidelines Unsplash respectées : hotlink des URLs retournées, attribution
// photographe + lien avec UTM, et déclenchement du download endpoint quand
// la photo est réellement utilisée (cover de trip).

const UNSPLASH_SEARCH_URL = 'https://api.unsplash.com/search/photos';
const UNSPLASH_ACCESS_KEY = process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY;
const PHOTO_ORIENTATION = 'landscape';
const RESULTS_PER_QUERY = '1';
const COVER_RESULTS_PER_QUERY = '6'; // grille de suggestions (trip/create)
const SEARCH_SUFFIX = 'travel';
export const UNSPLASH_UTM_SUFFIX = '?utm_source=hako&utm_medium=referral';
export const UNSPLASH_HOME_URL = `https://unsplash.com/${UNSPLASH_UTM_SUFFIX}`;

export interface DestinationPhoto {
  url: string;              // URL hotlinkée (urls.regular)
  photographerName: string;
  photographerUrl: string;  // profil photographe, UTM inclus
  downloadLocation: string; // endpoint à pinger quand la photo est utilisée
}

interface UnsplashSearchResponse {
  results?: {
    urls: { regular: string };
    user: { name: string; links: { html: string } };
    links: { download_location: string };
  }[];
}

/** Caches module : 1 requête max par destination, quel que soit le nombre de renders. */
const photoCache = new Map<string, Promise<DestinationPhoto | null>>();
const coversCache = new Map<string, Promise<DestinationPhoto[]>>();

async function fetchPhotos(query: string, perPage: string): Promise<DestinationPhoto[]> {
  if (!UNSPLASH_ACCESS_KEY) return [];
  const params = new URLSearchParams({
    query,
    orientation: PHOTO_ORIENTATION,
    per_page: perPage,
  });
  const response = await fetch(`${UNSPLASH_SEARCH_URL}?${params.toString()}`, {
    headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
  });
  if (!response.ok) return [];
  const json = (await response.json()) as UnsplashSearchResponse;
  return (json.results ?? []).map(photo => ({
    url: photo.urls.regular,
    photographerName: photo.user.name,
    photographerUrl: `${photo.user.links.html}${UNSPLASH_UTM_SUFFIX}`,
    downloadLocation: photo.links.download_location,
  }));
}

/** Photo de destination ("<destination> travel", paysage). Mise en cache. */
export function searchDestinationPhoto(destination: string): Promise<DestinationPhoto | null> {
  const query = `${destination.trim()} ${SEARCH_SUFFIX}`;
  const cached = photoCache.get(query);
  if (cached) return cached;
  const promise = fetchPhotos(query, RESULTS_PER_QUERY)
    .then(photos => photos[0] ?? null)
    .catch(() => null);
  photoCache.set(query, promise);
  return promise;
}

/**
 * Suggestions de covers pour une destination (grille de trip/create).
 * Tableau vide si pas de clé, pas de résultat ou erreur — l'appelant
 * garde ses placeholders en fallback. Mise en cache.
 */
export function searchDestinationCovers(destination: string): Promise<DestinationPhoto[]> {
  const query = `${destination.trim()} ${SEARCH_SUFFIX}`;
  const cached = coversCache.get(query);
  if (cached) return cached;
  const promise = fetchPhotos(query, COVER_RESULTS_PER_QUERY).catch(() => []);
  coversCache.set(query, promise);
  return promise;
}

/** À appeler quand la photo est réellement utilisée (guideline Unsplash). */
export function triggerUnsplashDownload(downloadLocation: string): void {
  if (!UNSPLASH_ACCESS_KEY) return;
  void fetch(downloadLocation, {
    headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
  }).catch(() => undefined); // best effort — jamais bloquant
}
