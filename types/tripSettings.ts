// HAKO — Paramètres d'un voyage (page app/trip/[id]/settings.tsx)

import { TripVibe } from '@/types/tripStyle';

export type TripMemberRole = 'owner' | 'member';

export interface TripSettingsMember {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  role: TripMemberRole;
}

export interface TripSettings {
  id: string;
  name: string;
  destination: string;
  startDate: string;           // "YYYY-MM-DD"
  endDate: string;             // "YYYY-MM-DD"
  coverUrl: string | null;
  ownerId: string;
  vibes: TripVibe[];
  budgetPerPerson: number | null; // € par personne, hors transport
  members: TripSettingsMember[];
}

/** Champs modifiables directement sur la ligne `trips`. */
export interface TripSettingsPatch {
  name?: string;
  cover_image_url?: string | null;
  vibes?: TripVibe[];
  budget_per_person?: number | null;
}
