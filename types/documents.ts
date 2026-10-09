// HAKO — Documents du voyage : types partagés (liste, ajout, billet)

import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// Valeurs de la contrainte documents_category_check (en base)
export type DocCategory =
  | 'flight' | 'hotel' | 'restaurant' | 'transport'
  | 'passport' | 'insurance' | 'visa' | 'activity' | 'other';

/** Infos d'un billet (colonne `documents.details`, optionnelle). */
export interface TicketDetails {
  from?: string;        // « LYS » ou « Roma Termini »
  to?: string;
  departure?: string;   // « 08:00 »
  arrival?: string;
  passenger?: string;
  seat?: string;
  gate?: string;
  boarding?: string;
  reference?: string;
}

export interface TripDocumentRow {
  id: string;
  trip_id: string;
  uploaded_by: string | null;
  title: string;
  category: DocCategory;
  file_url: string;
  file_type: string;
  file_size?: number | null;
  notes?: string | null;
  event_date?: string | null;
  is_shared: boolean;
  details?: TicketDetails | null;
  created_at: string;
}

export interface DocCategoryMeta {
  key: DocCategory;
  label: string;
  icon: IoniconName;
  /** Catégories « billet » : l'ajout propose les infos de trajet. */
  isTicket?: boolean;
}

export const DOC_CATEGORIES: readonly DocCategoryMeta[] = [
  { key: 'flight',        label: 'Vol',        icon: 'airplane-outline', isTicket: true },
  { key: 'transport',  label: 'Train / bus', icon: 'train-outline', isTicket: true },
  { key: 'hotel',      label: 'Logement',   icon: 'bed-outline' },
  { key: 'activity',   label: 'Activité',   icon: 'ticket-outline', isTicket: true },
  { key: 'restaurant', label: 'Restaurant', icon: 'restaurant-outline' },
  { key: 'passport',  label: 'Passeport',  icon: 'card-outline' },
  { key: 'visa',       label: 'Visa',       icon: 'document-text-outline' },
  { key: 'insurance',  label: 'Assurance',  icon: 'shield-checkmark-outline' },
  { key: 'other',      label: 'Autre',      icon: 'document-outline' },
];

export function docCategoryMeta(key: DocCategory): DocCategoryMeta {
  return DOC_CATEGORIES.find(c => c.key === key) ?? DOC_CATEGORIES[DOC_CATEGORIES.length - 1]!;
}

/** Papiers d'identité : privés par défaut. */
export const PRIVATE_BY_DEFAULT: readonly DocCategory[] = ['passport', 'visa'];
