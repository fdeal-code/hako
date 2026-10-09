// HAKO — Question 6 : ambiances (deck swipable)

import { Colors } from '@/constants/theme';
import { SwipeDeck, SwipeCardContent } from '@/components/match/SwipeDeck';

export const MOOD_CARDS: readonly SwipeCardContent[] = [
  { id: 'chill',   title: 'Chill total',      emoji: '🧘', gradient: Colors.matchGradients.chill },
  { id: 'fête',    title: 'Fête & soirées',   emoji: '🪩', gradient: Colors.matchGradients.party },
  { id: 'culture', title: 'Culture & visites', emoji: '🏛️', gradient: Colors.matchGradients.culture },
  { id: 'food',    title: 'Food & terrasses', emoji: '🍜', gradient: Colors.matchGradients.food },
];

interface QuestionMoodsProps {
  onChange: (moods: string[]) => void;
}

export function QuestionMoods({ onChange }: QuestionMoodsProps) {
  return <SwipeDeck cards={MOOD_CARDS} onComplete={onChange} />;
}
