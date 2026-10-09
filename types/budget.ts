// HAKO — Budget : catégories (valeurs de la contrainte expenses_category_check)

import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface ExpenseCategoryMeta { label: string; icon: IoniconName }

export const EXPENSE_CATEGORIES: Record<string, ExpenseCategoryMeta> = {
  food:          { label: 'Repas',     icon: 'restaurant-outline' },
  transport:     { label: 'Transport', icon: 'airplane-outline' },
  accommodation: { label: 'Logement',  icon: 'bed-outline' },
  activity:      { label: 'Activités', icon: 'ticket-outline' },
  shopping:      { label: 'Courses',   icon: 'cart-outline' },
  other:         { label: 'Autre',     icon: 'cube-outline' },
};

export function categoryMeta(category: string): ExpenseCategoryMeta {
  return EXPENSE_CATEGORIES[category] ?? EXPENSE_CATEGORIES.other ?? { label: 'Autre', icon: 'cube-outline' };
}

export interface BudgetMember { id: string; nickname: string; avatarUrl: string | null }
