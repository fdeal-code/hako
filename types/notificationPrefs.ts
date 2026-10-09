// HAKO — Préférences de notifications (règle anti-spam)

export type NotificationCategory =
  | 'decisions' | 'expenses' | 'group' | 'new_wishes' | 'hako_ideas' | 'quiet_hours';

export type NotificationMode = 'instant' | 'digest' | 'off' | 'on';

export interface NotificationPref {
  user_id: string;
  category: NotificationCategory;
  mode: NotificationMode;
}

export interface NotificationCategoryDef {
  category: NotificationCategory;
  label: string;
  hint: string;
  section: 'live' | 'digest' | 'silence';
  /** Mode quand l'utilisateur n'a rien choisi. */
  defaultMode: NotificationMode;
  /** Mode « activé » (instant pour le direct, digest pour les résumés, on pour le silence). */
  onMode: NotificationMode;
  frequency?: string;
}

export const NOTIFICATION_CATEGORIES: readonly NotificationCategoryDef[] = [
  { category: 'decisions',   label: 'Votes & décisions', hint: 'Relances, envies validées',          section: 'live',    defaultMode: 'instant', onMode: 'instant' },
  { category: 'expenses',    label: 'Dépenses',          hint: 'Qui a payé, qui doit combien',       section: 'live',    defaultMode: 'instant', onMode: 'instant' },
  { category: 'group',       label: 'Le groupe',         hint: 'Nouveaux membres, changements',      section: 'live',    defaultMode: 'instant', onMode: 'instant' },
  { category: 'new_wishes',  label: 'Nouvelles envies',  hint: 'Un récap le soir',                   section: 'digest',  defaultMode: 'digest',  onMode: 'digest', frequency: '1×/jour' },
  { category: 'hako_ideas',  label: 'Idées Hako',        hint: 'Logements, activités, événements',   section: 'digest',  defaultMode: 'digest',  onMode: 'digest', frequency: '1×/sem.' },
  { category: 'quiet_hours', label: 'Pas de notifs la nuit', hint: 'De 23:00 à 08:00',               section: 'silence', defaultMode: 'on',      onMode: 'on' },
];
