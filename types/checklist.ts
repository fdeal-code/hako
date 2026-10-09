// HAKO — Checklist « Prêt pour le départ ? »

import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type ChecklistItemKey = 'passport' | 'tickets' | 'lodging' | 'esim' | 'insurance';

export interface ChecklistRow {
  id: string;
  trip_id: string;
  item: ChecklistItemKey;
  done_by: string | null;
  done_at: string;
}

export interface ChecklistItemDef {
  key: ChecklistItemKey;
  label: string;
  hint: string;
  icon: IoniconName;
  /** Lien partenaire proposé tant que l'élément n'est pas coché (affiliation au bon moment). */
  partner?: 'esim' | 'insurance';
}

export const CHECKLIST_ITEMS: readonly ChecklistItemDef[] = [
  { key: 'passport',  label: 'Papiers d’identité', hint: 'Passeport ou carte d’identité valides', icon: 'card-outline' },
  { key: 'tickets',   label: 'Billets de transport', hint: 'Aller, retour et trajets entre villes', icon: 'airplane-outline' },
  { key: 'lodging',   label: 'Logements réservés', hint: 'Une nuit sous un toit pour chaque étape', icon: 'bed-outline' },
  { key: 'esim',      label: 'Data à l’étranger', hint: 'eSIM ou forfait international', icon: 'cellular-outline', partner: 'esim' },
  { key: 'insurance', label: 'Assurance voyage', hint: 'Annulation, santé, bagages', icon: 'shield-checkmark-outline', partner: 'insurance' },
];
