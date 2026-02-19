// HAKO — TypeScript types & interfaces

// ─── User ────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
}

// ─── Trip ────────────────────────────────────────────────────────────────────
export type TripStatus = 'future' | 'active' | 'past';
export type UserRole = 'organizer' | 'member';

export interface Trip {
  id: string;
  name: string;
  destination: string;
  cover_url?: string;
  start_date: string;
  end_date: string;
  status: TripStatus;
  created_by: string;
  members: TripMember[];
  created_at: string;
}

export interface TripMember {
  user_id: string;
  trip_id: string;
  role: UserRole;
  user: User;
}

// ─── Envie (Wish) ─────────────────────────────────────────────────────────────
export type EnvieStatus = 'validated' | 'debate' | 'pending' | 'archived';

export interface Envie {
  id: string;
  trip_id: string;
  added_by: string;
  title: string;
  description?: string;
  link_url?: string;
  cover_url?: string;
  status: EnvieStatus;
  votes_love: number;
  votes_pass: number;
  user_vote?: 'love' | 'pass' | null;
  created_at: string;
}

// ─── Planning ─────────────────────────────────────────────────────────────────
export interface PlanningDay {
  id: string;
  trip_id: string;
  date: string;
  items: PlanningItem[];
}

export interface PlanningItem {
  id: string;
  day_id: string;
  envie_id?: string;
  title: string;
  description?: string;
  time?: string;
  location?: string;
  order: number;
}

// ─── Document ─────────────────────────────────────────────────────────────────
export type DocumentType = 'ticket' | 'reservation' | 'insurance' | 'passport' | 'other';

export interface TripDocument {
  id: string;
  trip_id: string;
  uploaded_by: string;
  name: string;
  type: DocumentType;
  file_url: string;
  file_size?: number;
  created_at: string;
}

// ─── Budget ───────────────────────────────────────────────────────────────────
export type ExpenseCategory = 'transport' | 'accommodation' | 'food' | 'activity' | 'other';

export interface Expense {
  id: string;
  trip_id: string;
  paid_by: string;
  title: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  split_between: string[];
  created_at: string;
}

// ─── Navigation params ────────────────────────────────────────────────────────
export type RootStackParamList = {
  '(tabs)': undefined;
  '(auth)/login': undefined;
  'trip/[id]/dashboard': { id: string };
  'trip/[id]/envies': { id: string };
  'trip/[id]/planning': { id: string };
  'trip/[id]/map': { id: string };
  'trip/[id]/documents': { id: string };
  'trip/[id]/budget': { id: string };
  'trip/create': undefined;
};
