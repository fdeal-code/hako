// HAKO — Ajout d'une envie (maquettes « Envie · Nouvelle envie » / « Aperçu TikTok »)

import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { TripVibe } from '@/types/tripStyle';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// Une envie se vote : un lieu ou une inspiration. Les tâches d'orga
// (wishes.type = 'orga') passent par les Préparatifs (preparationService).
export type WishKind = 'place' | 'inspiration';

export type WishCategory =
  | 'restaurant' | 'monument' | 'cafe' | 'hotel' | 'activity' | 'photo_spot' | 'bar' | 'other';

// ─── Ambiances (mêmes valeurs que trips.vibes + « Insta spot ») ──────────────
export type WishVibe = TripVibe | 'insta';

export interface WishVibeOption {
  id: WishVibe;
  label: string;
}

export const WISH_VIBES: readonly WishVibeOption[] = [
  { id: 'nature',   label: 'Nature' },
  { id: 'insta',    label: 'Insta spot' },
  { id: 'chill',    label: 'Chill' },
  { id: 'aventure', label: 'Aventure' },
  { id: 'foodie',   label: 'Foodie' },
  { id: 'culture',  label: 'Culture' },
  { id: 'fete',     label: 'Fête' },
];

// ─── Lien collé (TikTok, Reel, YouTube…) ─────────────────────────────────────
export type LinkSource = 'tiktok' | 'instagram' | 'youtube' | 'other';

export const LINK_SOURCE_META: Record<LinkSource, { label: string; icon: IoniconName }> = {
  tiktok:    { label: 'TikTok',    icon: 'musical-notes' },
  instagram: { label: 'Reel',      icon: 'logo-instagram' },
  youtube:   { label: 'YouTube',   icon: 'logo-youtube' },
  other:     { label: 'Lien',      icon: 'link' },
};

export interface LinkPreview {
  url: string;
  source: LinkSource;
  title: string;            // légende de la vidéo (vide si inconnue)
  thumbnail: string | null;
  author: string | null;    // compte, sans « @ »
}

// ─── Lieu Google ─────────────────────────────────────────────────────────────
export interface PlaceSuggestion {
  place_id: string;
  description: string;
}

export interface FoundPlace {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  photoUrl: string | null;
  types: string[];
}

// ─── Insertion ───────────────────────────────────────────────────────────────
export interface NewWishInput {
  tripId: string;
  addedBy: string;
  kind: WishKind;
  title: string;
  description: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  place: FoundPlace | null;
  category: WishCategory | null;
  stopId: string | null;
  vibes: WishVibe[];
  pricePerPerson: number | null;   // € par personne
  durationMinutes: number | null;
}
