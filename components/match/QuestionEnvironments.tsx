// HAKO — Question 5 : environnements (deck swipable)

import { Colors } from '@/constants/theme';
import { SwipeDeck, SwipeCardContent } from '@/components/match/SwipeDeck';

export const ENVIRONMENT_CARDS: readonly SwipeCardContent[] = [
  { id: 'mer',      title: 'La mer',      emoji: '🌊', gradient: Colors.matchGradients.ocean },
  { id: 'montagne', title: 'La montagne', emoji: '⛰️', gradient: Colors.matchGradients.mountain },
  { id: 'ville',    title: 'La ville',    emoji: '🏙️', gradient: Colors.matchGradients.city },
  { id: 'campagne', title: 'La campagne', emoji: '🌾', gradient: Colors.matchGradients.country },
];

interface QuestionEnvironmentsProps {
  onChange: (environments: string[]) => void;
}

export function QuestionEnvironments({ onChange }: QuestionEnvironmentsProps) {
  return <SwipeDeck cards={ENVIRONMENT_CARDS} onComplete={onChange} />;
}
