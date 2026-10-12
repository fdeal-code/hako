// HAKO — Import de réservations (e-mail collé, PDF, capture d'écran)
// La fonction serveur parse-booking lit la confirmation ; l'app montre le
// résultat, on corrige, puis on crée document + planning + dépense.

import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type BookingKind = 'flight' | 'train' | 'bus' | 'ferry' | 'hotel' | 'car' | 'activity' | 'restaurant' | 'other';

/** Réservation telle que renvoyée par parse-booking (voir le schéma de la fonction). */
export interface ParsedBooking {
  kind: BookingKind;
  title: string;
  provider: string | null;
  reference: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  from_place: string | null;
  to_place: string | null;
  address: string | null;
  city: string | null;
  travelers: string[];
  total_price: number | null;
  currency: string | null;
  notes: string | null;
}

/** Réservation en cours de vérification : ce qu'on ajoute au voyage. */
export interface BookingDraft extends ParsedBooking {
  key: string;
  include: boolean;     // décochée = ignorée
  addPlanning: boolean;
  addExpense: boolean;
}

/** Ce qu'on fait lire : du texte collé, ou un fichier (PDF, capture). */
export type ImportSource =
  | { type: 'text'; text: string }
  | { type: 'file'; uri: string; name: string; mimeType: string };

export const BOOKING_KIND_META: Record<BookingKind, { label: string; icon: IoniconName }> = {
  flight:     { label: 'Vol',        icon: 'airplane' },
  train:      { label: 'Train',      icon: 'train' },
  bus:        { label: 'Bus',        icon: 'bus' },
  ferry:      { label: 'Ferry',      icon: 'boat' },
  hotel:      { label: 'Logement',   icon: 'bed' },
  car:        { label: 'Voiture',    icon: 'car' },
  activity:   { label: 'Activité',   icon: 'ticket' },
  restaurant: { label: 'Restaurant', icon: 'restaurant' },
  other:      { label: 'Autre',      icon: 'document-text' },
};

export interface ImportResult {
  documents: number;
  planning: number;
  expenses: number;
}
