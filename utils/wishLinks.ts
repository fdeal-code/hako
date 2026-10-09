// HAKO — Ajout d'envie : fonctions pures (liens, légendes, catégories, ambiances)
// Sans dépendance React Native → testées dans tests/wishLinks.test.ts.

import type { LinkSource, WishCategory, WishVibe } from '../types/wishDraft';

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;
const CAPTION_MAX = 120;

/** Premier lien http(s) d'un texte copié (« Regarde ça https://vm.tiktok.com/… »). */
export function extractUrl(text: string): string | null {
  const match = text.match(URL_PATTERN);
  return match ? match[0].replace(/[).,;!?]+$/, '') : null;
}

export function detectLinkSource(url: string): LinkSource {
  const host = url.toLowerCase();
  if (host.includes('tiktok.com')) return 'tiktok';
  if (host.includes('instagram.com')) return 'instagram';
  if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
  return 'other';
}

/** Lien raccourci pour le bandeau « Lien copié » : sans protocole ni « www. ». */
export function shortUrl(url: string, max = 22): string {
  const bare = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  return bare.length > max ? `${bare.slice(0, max)}…` : bare;
}

/**
 * Légende → requête Google : hashtags gardés comme mots (#lagodibraies),
 * mentions, liens et emojis retirés.
 */
export function captionToQuery(caption: string): string {
  return caption
    .replace(URL_PATTERN, ' ')
    .replace(/@[\w.]+/g, ' ')
    .replace(/#/g, ' ')
    .replace(/[^\p{L}\p{N}\s'’-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CAPTION_MAX);
}

/** Catégorie HAKO à partir des types Google Places. */
export function categoryFromTypes(types: readonly string[]): WishCategory | null {
  const has = (list: readonly string[]) => types.some(t => list.includes(t));
  if (has(['restaurant', 'food', 'meal_delivery', 'meal_takeaway'])) return 'restaurant';
  if (has(['cafe', 'bakery'])) return 'cafe';
  if (has(['bar', 'night_club'])) return 'bar';
  if (has(['lodging'])) return 'hotel';
  if (has(['museum', 'church', 'place_of_worship', 'tourist_attraction', 'natural_feature'])) return 'monument';
  if (has(['amusement_park', 'bowling_alley', 'gym', 'spa', 'stadium', 'park', 'zoo', 'aquarium'])) return 'activity';
  return null;
}

/** Ambiances pré-cochées selon le lieu trouvé (modifiables par l'utilisateur). */
export function suggestVibes(types: readonly string[], fromVideo: boolean): WishVibe[] {
  const has = (list: readonly string[]) => types.some(t => list.includes(t));
  const vibes: WishVibe[] = [];
  if (has(['natural_feature', 'park', 'campground'])) vibes.push('nature');
  if (fromVideo) vibes.push('insta');
  if (has(['restaurant', 'food', 'cafe', 'bakery'])) vibes.push('foodie');
  if (has(['museum', 'church', 'place_of_worship', 'art_gallery'])) vibes.push('culture');
  if (has(['bar', 'night_club'])) vibes.push('fete');
  if (has(['spa', 'beach'])) vibes.push('chill');
  if (has(['amusement_park', 'stadium', 'gym'])) vibes.push('aventure');
  return vibes;
}

/** Distance approximative en km (équirectangulaire — suffisant à l'échelle d'une région). */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const EARTH_KM = 6371;
  const rad = Math.PI / 180;
  const x = (bLng - aLng) * rad * Math.cos(((aLat + bLat) / 2) * rad);
  const y = (bLat - aLat) * rad;
  return Math.sqrt(x * x + y * y) * EARTH_KM;
}

const MONTHS_LONG = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 07 → 09 juin », ou « 30 mai → 02 juin » à cheval sur deux mois. */
export function formatStopRange(startDate: string, endDate: string): string {
  const [, sm, sd] = startDate.split('-');
  const [, em, ed] = endDate.split('-');
  const month = (m: string | undefined) => MONTHS_LONG[Number(m) - 1] ?? '';
  return sm === em ? `${sd} → ${ed} ${month(em)}` : `${sd} ${month(sm)} → ${ed} ${month(em)}`;
}
