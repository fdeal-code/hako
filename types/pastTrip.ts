// HAKO — Après le voyage : album photo, avis, récap

import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface PastMember {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
}

// ─── Album (table `trip_photos`) ─────────────────────────────────────────────
export interface TripPhoto {
  id: string;
  photoUrl: string;
  uploadedBy: string;
  caption: string | null;
  createdAt: string;
}

// ─── Avis (table `activity_reviews`, une note par membre et par envie) ───────
export interface ReviewRow {
  wish_id: string;
  user_id: string;
  rating: number;            // 1 → 5
  comment: string | null;
}

/** Envie validée (ou réservée) qu'on peut noter après le voyage. */
export interface ReviewableWish {
  id: string;
  title: string;
  image_url: string | null;
  category: string | null;
  stop_id: string | null;
  address: string | null;
  booked_at: string | null;
}

export type ReviewKind = 'lodging' | 'activity';

export interface ReviewableItem {
  wishId: string;
  title: string;
  imageUrl: string | null;
  address: string | null;
  stopId: string | null;
  kind: ReviewKind;
  myRating: number | null;
  myComment: string | null;
  avgRating: number | null;
  reviewCount: number;
}

// ─── Dépenses (pour le bilan et les trophées) ────────────────────────────────
export interface PastExpense {
  amount: number;
  paid_by: string;
  expense_splits: { user_id: string; amount: number }[];
}

// ─── Récap ───────────────────────────────────────────────────────────────────
export interface RecapStats {
  days: number;
  cities: number;
  places: number;
  photos: number;
  total: number;             // € dépensés par le groupe
  perPerson: number;         // € par voyageur
}

export interface RecapBadge {
  id: 'photographer' | 'banker' | 'critic' | 'explorer';
  icon: IoniconName;
  title: string;             // « Le photographe »
  winner: PastMember;
  detail: string;            // « 12 photos »
}

export interface PastTripInfo {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  coverUrl: string | null;
}

export interface PastTripData {
  trip: PastTripInfo;
  members: PastMember[];
  photos: TripPhoto[];
  wishes: ReviewableWish[];
  reviews: ReviewRow[];
  expenses: PastExpense[];
  wishAuthors: Record<string, string>; // wish_id → added_by (trophée « L'explorateur »)
}
