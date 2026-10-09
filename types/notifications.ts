// HAKO — Notifications in-app : types & interfaces

// ─── Types de notifications ───────────────────────────────────────────────────
// Payload typé par type (union discriminée sur `type`).
export type NotificationType =
  | 'match_invite'
  | 'wish_added'
  | 'wish_validated'
  | 'expense_added'
  | 'member_joined';

export interface MatchInvitePayload {
  match_id: string;
  title: string;
  creator_nickname: string;
}

/** Notifications d'activité d'un voyage (triggers SQL — migration trip_activity_notifications). */
export interface WishAddedPayload { trip_id: string; wish_id: string; title: string; actor: string; }
export interface WishValidatedPayload { trip_id: string; wish_id: string; title: string; }
export interface ExpenseAddedPayload { trip_id: string; expense_id: string; title: string; amount: number; actor: string; }
export interface MemberJoinedPayload { trip_id: string; actor: string; trip_name: string | null; }

interface NotificationBase {
  id: string;
  user_id: string;
  read: boolean;
  created_at: string;
}

// ─── Notification ─────────────────────────────────────────────────────────────
export type AppNotification =
  | (NotificationBase & { type: 'match_invite'; payload: MatchInvitePayload })
  | (NotificationBase & { type: 'wish_added'; payload: WishAddedPayload })
  | (NotificationBase & { type: 'wish_validated'; payload: WishValidatedPayload })
  | (NotificationBase & { type: 'expense_added'; payload: ExpenseAddedPayload })
  | (NotificationBase & { type: 'member_joined'; payload: MemberJoinedPayload });

export type MatchInviteNotification = Extract<AppNotification, { type: 'match_invite' }>;
export type TripActivityNotification = Exclude<AppNotification, MatchInviteNotification>;

export function isTripActivity(n: AppNotification): n is TripActivityNotification {
  return n.type !== 'match_invite';
}
