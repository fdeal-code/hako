// HAKO — Liens partenaires (logements & activités) — fonctions pures
// V1 de « On t'aide » : recherches pré-filtrées (ville, dates, voyageurs)
// chez les partenaires. Les identifiants affiliés viennent du .env ; sans
// eux les liens fonctionnent, simplement sans commission.
//   EXPO_PUBLIC_BOOKING_AID, EXPO_PUBLIC_HOSTELWORLD_AFFILIATE,
//   EXPO_PUBLIC_GETYOURGUIDE_PARTNER_ID, EXPO_PUBLIC_VIATOR_PID,
//   EXPO_PUBLIC_AIRALO_REF, EXPO_PUBLIC_HEYMONDO_REF

import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type PartnerKind = 'lodging' | 'activities';

export interface PartnerSearch {
  city: string;
  checkin: string;   // "YYYY-MM-DD"
  checkout: string;  // "YYYY-MM-DD"
  travelers: number;
  /** Plafond logement par nuit et par personne (budget du voyage), si connu. */
  maxPerNightPerPerson?: number | null;
}

export interface PartnerLink {
  id: string;
  name: string;
  kind: PartnerKind;
  icon: IoniconName;
  tagline: string;
  url: string;
}

const MIN_TRAVELERS = 1;

function withParams(base: string, params: Record<string, string | null | undefined>): string {
  const query = Object.entries(params)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return query.length > 0 ? `${base}?${query}` : base;
}

export function bookingUrl(search: PartnerSearch, aid?: string | null): string {
  const travelers = String(Math.max(MIN_TRAVELERS, search.travelers));
  // Filtre prix Booking : budget par nuit pour la chambre (= par personne × voyageurs)
  const maxRoom = search.maxPerNightPerPerson
    ? Math.round(search.maxPerNightPerPerson * Math.max(MIN_TRAVELERS, search.travelers))
    : null;
  return withParams('https://www.booking.com/searchresults.html', {
    ss: search.city,
    checkin: search.checkin,
    checkout: search.checkout,
    group_adults: travelers,
    no_rooms: '1',
    nflt: maxRoom ? `price=EUR-min-${maxRoom}-1` : null,
    aid: aid ?? null,
  });
}

export function hostelworldUrl(search: PartnerSearch, affiliate?: string | null): string {
  return withParams('https://www.hostelworld.com/search', {
    search_keywords: search.city,
    date_from: search.checkin,
    date_to: search.checkout,
    number_of_guests: String(Math.max(MIN_TRAVELERS, search.travelers)),
    affiliate: affiliate ?? null,
  });
}

export function getYourGuideUrl(search: PartnerSearch, partnerId?: string | null): string {
  return withParams('https://www.getyourguide.com/s/', {
    q: search.city,
    date_from: search.checkin,
    date_to: search.checkout,
    partner_id: partnerId ?? null,
  });
}

export function viatorUrl(search: PartnerSearch, pid?: string | null): string {
  return withParams('https://www.viator.com/searchResults/all', {
    text: search.city,
    pid: pid ?? null,
  });
}

/** Partenaires proposés pour une étape, dans l'ordre d'affichage (jamais trié par commission). */
export function partnerLinks(kind: PartnerKind, search: PartnerSearch): PartnerLink[] {
  const env = process.env;
  if (kind === 'lodging') {
    return [
      {
        id: 'booking', name: 'Booking.com', kind, icon: 'bed-outline',
        tagline: 'Hôtels & apparts, annulation souvent gratuite',
        url: bookingUrl(search, env.EXPO_PUBLIC_BOOKING_AID),
      },
      {
        id: 'hostelworld', name: 'Hostelworld', kind, icon: 'people-outline',
        tagline: 'Auberges & chambres privées, petits budgets',
        url: hostelworldUrl(search, env.EXPO_PUBLIC_HOSTELWORLD_AFFILIATE),
      },
    ];
  }
  return [
    {
      id: 'getyourguide', name: 'GetYourGuide', kind, icon: 'ticket-outline',
      tagline: 'Visites, coupe-files & activités à tes dates',
      url: getYourGuideUrl(search, env.EXPO_PUBLIC_GETYOURGUIDE_PARTNER_ID),
    },
    {
      id: 'viator', name: 'Viator', kind, icon: 'compass-outline',
      tagline: 'Excursions & expériences locales',
      url: viatorUrl(search, env.EXPO_PUBLIC_VIATOR_PID),
    },
  ];
}

/**
 * Billets pour une envie validée (visite, activité) : recherche de l'activité
 * elle-même dans la ville de l'étape, à la date prévue si on la connaît.
 */
export function ticketLinks(activity: string, city: string | null, day: string | null): PartnerLink[] {
  const env = process.env;
  const query = [activity, city].filter(Boolean).join(' ');
  return [
    {
      id: 'getyourguide', name: 'GetYourGuide', kind: 'activities', icon: 'ticket-outline',
      tagline: 'Billets, coupe-files et visites guidées',
      url: withParams('https://www.getyourguide.com/s/', {
        q: query, date_from: day, date_to: day, partner_id: env.EXPO_PUBLIC_GETYOURGUIDE_PARTNER_ID ?? null,
      }),
    },
    {
      id: 'viator', name: 'Viator', kind: 'activities', icon: 'compass-outline',
      tagline: 'Excursions et expériences',
      url: withParams('https://www.viator.com/searchResults/all', { text: query, pid: env.EXPO_PUBLIC_VIATOR_PID ?? null }),
    },
  ];
}

/** eSIM data (checklist « Prêt pour le départ ? »). */
export function esimUrl(ref?: string | null): string {
  return withParams('https://www.airalo.com/', { ref: ref ?? null });
}

/** Assurance voyage (checklist « Prêt pour le départ ? »). */
export function insuranceUrl(ref?: string | null): string {
  return withParams('https://www.heymondo.fr/', { ref: ref ?? null });
}

export function checklistPartnerUrl(partner: 'esim' | 'insurance'): string {
  return partner === 'esim'
    ? esimUrl(process.env.EXPO_PUBLIC_AIRALO_REF)
    : insuranceUrl(process.env.EXPO_PUBLIC_HEYMONDO_REF);
}
