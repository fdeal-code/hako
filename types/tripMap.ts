// HAKO — Carte du voyage (écran plein écran app/trip/[id]/map.tsx)

import { TicketDetails } from '@/types/documents';

/** Billet (vol, train…) tel que la carte en a besoin. */
export interface MapTicket {
  id: string;
  title: string;
  category: string;          // 'flight' | 'transport' | …
  event_date: string | null;
  details: TicketDetails | null;
}

export type LegMode = 'flight' | 'train' | 'car';

/**
 * Trajet affiché sous la carte : entre deux étapes, ou l'arrivée / le
 * retour en avion (extrémités connues seulement par le billet).
 */
export interface MapLeg {
  key: string;
  fromLabel: string;
  toLabel: string;
  date: string | null;       // "YYYY-MM-DD"
  mode: LegMode;
  ticket: MapTicket | null;
  durationMinutes: number | null;   // d'après le billet
  distanceKm: number | null;        // à vol d'oiseau, entre étapes
  fromStopId: string | null;
  toStopId: string | null;
}

/** Lieu du groupe affiché dans une ville (envie validée, réservée ou à voter). */
export interface MapPlace {
  id: string;
  title: string;
  category: string | null;
  status: string;
  address: string | null;
  latitude: number;
  longitude: number;
  stopId: string | null;
  imageUrl: string | null;
  booked: boolean;
  /** Créneau au planning (premier), sinon null */
  plannedDay: string | null;
  plannedTime: string | null;
}
