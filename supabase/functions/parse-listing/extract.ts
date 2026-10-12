// HAKO — Lecture d'une page d'annonce de logement (fonctions pures)
// Nom, photos, adresse, note et prix quand la page les publie : balises
// Open Graph (aperçus de partage), données structurées schema.org (JSON-LD)
// et photos des CDN des plateformes. Aucun import : testable avec node --test.

export interface ListingData {
  name: string | null;
  photos: string[];
  address: string | null;
  rating: number | null;
  priceTotal: number | null;
  currency: string | null;
}

const MAX_PHOTOS = 8;
const LODGING_TYPES = ['Hotel', 'LodgingBusiness', 'Hostel', 'Motel', 'Resort', 'BedAndBreakfast', 'Accommodation', 'VacationRental', 'House', 'Apartment', 'Product', 'Place'];

// Seules ces plateformes sont lues (pas de requête serveur vers n'importe quelle adresse)
const ALLOWED_HOSTS = ['booking.com', 'hostelworld.com', 'airbnb.fr', 'airbnb.com', 'airbnb.co.uk', 'airbnb.es', 'airbnb.it', 'airbnb.de', 'hotels.com', 'expedia.fr', 'expedia.com', 'agoda.com', 'vrbo.com', 'abritel.fr'];

export function isAllowedListingUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const host = u.hostname.toLowerCase();
  return ALLOWED_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
}

/** Page de vérification anti-robot (ou d'erreur) au lieu de l'annonce. */
export function looksBlocked(status: number, html: string): boolean {
  if (status === 202 || status === 403 || status === 429 || status >= 500) return true;
  return /awsWafCookieDomainList|captcha|challenge-platform|cf-chl-|px-captcha/i.test(html.slice(0, 20000));
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function metaContents(html: string, names: readonly string[]): string[] {
  const out: string[] = [];
  const re = /<meta\s+[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (key && content && names.includes(key)) out.push(decodeEntities(content.trim()));
  }
  return out;
}

function absolute(url: string, base: string): string | null {
  try {
    const u = new URL(url.replace(/\\\//g, '/'), base);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch { return null; }
}

/** « Len Kyoto, Kyoto - 2026 Prices & Reviews » → « Len Kyoto, Kyoto ». */
export function cleanListingName(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(/\s+[-|–·]\s+/)[0]?.trim() ?? '';
  const name = first.replace(/\s*\((?:mis à jour|updated)[^)]*\)\s*$/i, '').trim();
  return name.length > 1 ? name.slice(0, 80) : null;
}

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function* walk(node: Json): Generator<{ [k: string]: Json }> {
  if (Array.isArray(node)) { for (const n of node) yield* walk(n); return; }
  if (node && typeof node === 'object') {
    yield node;
    for (const v of Object.values(node)) if (v && typeof v === 'object') yield* walk(v);
  }
}

function typeOf(o: { [k: string]: Json }): string[] {
  const t = o['@type'];
  return Array.isArray(t) ? t.filter((x): x is string => typeof x === 'string') : typeof t === 'string' ? [t] : [];
}

function imageUrls(v: Json | undefined): string[] {
  if (!v) return [];
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(imageUrls);
  if (typeof v === 'object') {
    const url = v['url'] ?? v['contentUrl'];
    return typeof url === 'string' ? [url] : [];
  }
  return [];
}

function addressText(v: Json | undefined): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && !Array.isArray(v)) {
    const parts = ['streetAddress', 'postalCode', 'addressLocality', 'addressCountry']
      .map(k => v[k]).map(p => (typeof p === 'string' ? p : p && typeof p === 'object' && !Array.isArray(p) && typeof p['name'] === 'string' ? p['name'] : null))
      .filter((p): p is string => !!p);
    return parts.length ? parts.join(', ') : null;
  }
  return null;
}

function num(v: Json | undefined): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Photos des établissements sur les CDN des plateformes (pas les logos)
const CDN_PHOTOS = [
  /https?:\/\/a\.hwstatic\.com\/image\/upload\/[^"'\s)]*propertyimages\/[^"'\s)]+\.(?:jpe?g|png|webp)/gi,
  /https?:\/\/a0\.muscache\.com\/im\/pictures\/[^"'\s)?]+\.(?:jpe?g|png|webp)/gi,
  /https?:\/\/cf\.bstatic\.com\/xdata\/images\/hotel\/[^"'\s)]+\.(?:jpe?g|png|webp)[^"'\s)]*/gi,
];

function photoKey(url: string): string {
  // Même photo sous plusieurs tailles → une seule (Hostelworld : propertyimages/9/93521/56.jpg)
  const hw = /propertyimages\/\d+\/\d+\/\d+\.\w+/.exec(url)?.[0];
  return hw ?? url.split('?')[0]!.replace(/\/(?:max|square)\d+\//, '/');
}

export function extractListing(html: string, pageUrl: string): ListingData {
  let name: string | null = null;
  let address: string | null = null;
  let rating: number | null = null;
  let priceTotal: number | null = null;
  let currency: string | null = null;
  const photos: string[] = [];

  // Données structurées schema.org
  const ldRe = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = ldRe.exec(html))) {
    let data: Json;
    try { data = JSON.parse(m[1]!.trim()) as Json; } catch { continue; }
    for (const o of walk(data)) {
      if (!typeOf(o).some(t => LODGING_TYPES.includes(t))) continue;
      if (!name && typeof o['name'] === 'string') name = o['name'];
      photos.push(...imageUrls(o['image']), ...imageUrls(o['photo']));
      address = address ?? addressText(o['address']);
      const agg = o['aggregateRating'];
      if (rating === null && agg && typeof agg === 'object' && !Array.isArray(agg)) rating = num(agg['ratingValue']);
      const offers = o['offers'];
      const offer = Array.isArray(offers) ? offers[0] : offers;
      if (priceTotal === null && offer && typeof offer === 'object' && !Array.isArray(offer)) {
        priceTotal = num(offer['price']) ?? num(offer['lowPrice']);
        currency = typeof offer['priceCurrency'] === 'string' ? offer['priceCurrency'] : currency;
      }
    }
  }

  // Aperçus de partage
  name = name ?? metaContents(html, ['og:title', 'twitter:title'])[0] ?? /<title>([^<]+)<\/title>/i.exec(html)?.[1] ?? null;
  photos.push(...metaContents(html, ['og:image', 'og:image:secure_url', 'twitter:image']));
  for (const re of CDN_PHOTOS) photos.push(...(html.match(re) ?? []));

  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of photos) {
    const url = absolute(decodeEntities(raw), pageUrl);
    if (!url || /\.svg(\?|$)|logo|favicon|\/pwa\/hostelworld\.png/i.test(url)) continue;
    const key = photoKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(url);
    if (clean.length >= MAX_PHOTOS) break;
  }

  return {
    name: cleanListingName(name ? decodeEntities(name) : null),
    photos: clean,
    address: address ? decodeEntities(address).slice(0, 200) : null,
    rating,
    priceTotal,
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
  };
}
