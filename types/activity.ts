// HAKO — Fiche d'une activité (page app/trip/[id]/planning-detail.tsx)

import { MapTicket } from '@/types/tripMap';

export interface ActivityLink { url: string; title?: string; thumbnail?: string }

export interface ActivityWish {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  google_rating: number | null;
  link_url: string | null;
  links: ActivityLink[] | null;
  status: string;
  booked_at: string | null;
  booked_amount: number | null;
  budget: string | null;          // ancien niveau (secours)
  duration?: string | null;       // ancienne durée (colonne absente en base)
  price_per_person: number | null;
  duration_minutes: number | null;
  added_by: string | null;
  wish_votes: { user_id: string; vote: string }[];
}

export interface ActivityItem {
  id: string;
  trip_id: string;
  title: string;
  day_date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  stop_id: string | null;
  is_locked: boolean | null;
  added_by: string | null;
  wish_id: string | null;
  wish: ActivityWish | null;
}

export interface ActivityMember { userId: string; nickname: string; avatarUrl: string | null }

export interface ActivityDetail {
  item: ActivityItem;
  members: ActivityMember[];
  stop: { id: string; position: number; place_name: string } | null;
  dayDocs: MapTicket[];
}
