// HAKO — Style & budget d'un voyage (dernière étape de la création)

import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// Mêmes valeurs que les « Tags d'ambiance » des envies (docs/FEATURES.md)
export type TripVibe = 'chill' | 'aventure' | 'foodie' | 'culture' | 'fete' | 'nature';

export interface TripVibeOption {
  id: TripVibe;
  label: string;
  icon: IoniconName;
}

export const TRIP_VIBES: readonly TripVibeOption[] = [
  { id: 'chill',    label: 'Chill',    icon: 'sunny-outline' },
  { id: 'aventure', label: 'Aventure', icon: 'trail-sign-outline' },
  { id: 'foodie',   label: 'Foodie',   icon: 'restaurant-outline' },
  { id: 'culture',  label: 'Culture',  icon: 'library-outline' },
  { id: 'fete',     label: 'Fête',     icon: 'musical-notes-outline' },
  { id: 'nature',   label: 'Nature',   icon: 'leaf-outline' },
];

/** Budget par personne, hors transport, en euros. */
export interface TripBudgetPreset {
  label: string;
  amount: number;
}

export const BUDGET_PRESETS: readonly TripBudgetPreset[] = [
  { label: 'Serré',      amount: 300 },
  { label: 'Tranquille', amount: 600 },
  { label: 'Confort',    amount: 1200 },
];
