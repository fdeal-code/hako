// HAKO — Planning (écran app/trip/[id]/planning.tsx)

import { MapTicket } from '@/types/tripMap';

export interface PlanningEntry {
  id: string;
  title: string;
  day_date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  stop_id: string | null;
  wish_id: string | null;
  wish: {
    title: string;
    category: string | null;
    address: string | null;
    image_url: string | null;
    status: string;
    wish_votes: { vote: string }[];
  } | null;
}

/** Envie validée pas encore au planning (« À planifier »). */
export interface PlannableWish {
  id: string;
  title: string;
  image_url: string | null;
  category: string | null;
  stop_id: string | null;
  duration_minutes: number | null;
  duration?: string | null;   // ancienne durée (colonne absente en base : jamais renseignée)
}

export interface PlanningData {
  startDate: string;
  endDate: string;
  entries: PlanningEntry[];
  tickets: MapTicket[];
  toPlan: PlannableWish[];
}
