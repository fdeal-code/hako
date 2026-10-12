// HAKO — Liens d'annonces de logement (fonctions pures)
// Reconnaît Booking, Hostelworld et Airbnb, devine le nom du logement à
// partir de l'adresse, et ajoute l'identifiant affilié de Hako au lien
// (le groupe réserve via Hako → commission, sans rien changer pour lui).
// Aucun import local : testable avec node --test.

export type LodgingSite = 'booking' | 'hostelworld' | 'airbnb' | 'other';

export const LODGING_SITE_LABEL: Record<LodgingSite, string> = {
  booking: 'Booking.com', hostelworld: 'Hostelworld', airbnb: 'Airbnb', other: 'Lien',
};

function parse(url: string): URL | null {
  try { return new URL(url.trim()); } catch { return null; }
}

export function lodgingSite(url: string): LodgingSite {
  const host = parse(url)?.hostname.toLowerCase() ?? '';
  if (host === 'booking.com' || host.endsWith('.booking.com')) return 'booking';
  if (host === 'hostelworld.com' || host.endsWith('.hostelworld.com')) return 'hostelworld';
  if (host.includes('airbnb.')) return 'airbnb';
  return 'other';
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_+]+/)
    .filter(Boolean)
    .map(w => (w.length <= 2 && w !== w.toUpperCase() ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(' ')
    .replace(/^\w/, c => c.toUpperCase());
}

/** « booking.com/hotel/jp/gracery-shinjuku.fr.html » → « Gracery Shinjuku ». null si on ne peut pas deviner. */
export function lodgingNameFromUrl(url: string): string | null {
  const u = parse(url);
  if (!u) return null;
  const parts = u.pathname.split('/').filter(Boolean).map(p => decodeURIComponent(p));
  const site = lodgingSite(url);
  if (site === 'booking') {
    const i = parts.indexOf('hotel');
    const file = i >= 0 ? parts[i + 2] : undefined;
    const slug = file?.replace(/\.html?$/, '').replace(/\.[a-z]{2}(-[a-z]{2})?$/i, '');
    return slug ? titleCase(slug) : null;
  }
  if (site === 'hostelworld') {
    const legacy = parts.indexOf('hosteldetails.php');
    if (legacy >= 0 && parts[legacy + 1]) return titleCase(parts[legacy + 1]!);
    const p = parts.indexOf('p');
    if (parts[0] === 'hostels' && p >= 0 && parts[p + 2]) return titleCase(parts[p + 2]!);
    return null;
  }
  return null;
}

/** Ajoute l'identifiant affilié de Hako à une annonce Booking ou Hostelworld. */
export function withLodgingAffiliate(url: string, ids: { bookingAid?: string | null; hostelworld?: string | null }): string {
  const u = parse(url);
  if (!u) return url;
  const site = lodgingSite(url);
  if (site === 'booking' && ids.bookingAid) u.searchParams.set('aid', ids.bookingAid);
  else if (site === 'hostelworld' && ids.hostelworld) u.searchParams.set('affiliate', ids.hostelworld);
  else return url;
  return u.toString();
}
