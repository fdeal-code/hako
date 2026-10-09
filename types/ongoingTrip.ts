// HAKO — Voyage en cours (dashboard « en cours »)

import { TicketDetails } from '@/types/documents';

export interface OngoingItem {
  id: string;
  title: string;
  day_date: string;
  start_time: string | null;
  end_time: string | null;
  wish: { image_url: string | null; address: string | null; latitude: number | null; longitude: number | null } | null;
}

/** Envie de la ville du jour pas encore au planning (« À faire dans le coin »). */
export interface NearbyWish {
  id: string;
  title: string;
  status: string;
  category: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  stop_id: string | null;
}

export interface OngoingDoc {
  id: string;
  title: string;
  category: string;
  event_date: string | null;
  details: TicketDetails | null;
}

export interface OngoingExpense {
  amount: number;
  date: string | null;
  paid_by: string;
  expense_splits: { user_id: string; amount: number }[];
}

export interface OngoingData {
  today: OngoingItem[];
  tomorrow: OngoingItem[];
  docs: OngoingDoc[];
  expenses: OngoingExpense[];
  /** Envies validées ou à voter, pas encore planifiées */
  unplanned: NearbyWish[];
}
