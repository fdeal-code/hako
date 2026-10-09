// HAKO — Question 5 : environnements (deck swipable)

import { SwipeDeck, SwipeCardContent } from '@/components/match/SwipeDeck';

export const ENVIRONMENT_CARDS: readonly SwipeCardContent[] = [
  { id: 'mer',      title: 'La mer',      emoji: '🌊', gradient: ['#4A9FD8', '#1F5E8C'] },
  { id: 'montagne', title: 'La montagne', emoji: '⛰️', gradient: ['#7BA05B', '#3E5B2E'] },
  { id: 'ville',    title: 'La ville',    emoji: '🏙️', gradient: ['#8B7BB8', '#4A3E6B'] },
  { id: 'campagne', title: 'La campagne', emoji: '🌾', gradient: ['#D8A855', '#8C6A1F'] },
];

interface QuestionEnvironmentsProps {
  onChange: (environments: string[]) => void;
}

export function QuestionEnvironments({ onChange }: QuestionEnvironmentsProps) {
  return <SwipeDeck cards={ENVIRONMENT_CARDS} onComplete={onChange} />;
}
