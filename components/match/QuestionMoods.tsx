// HAKO — Question 6 : ambiances (deck swipable)

import { SwipeDeck, SwipeCardContent } from '@/components/match/SwipeDeck';

export const MOOD_CARDS: readonly SwipeCardContent[] = [
  { id: 'chill',   title: 'Chill total',      emoji: '🧘', gradient: ['#6BBFA3', '#2E7D5F'] },
  { id: 'fête',    title: 'Fête & soirées',   emoji: '🪩', gradient: ['#E86A8A', '#9C2E4E'] },
  { id: 'culture', title: 'Culture & visites', emoji: '🏛️', gradient: ['#C4924F', '#7A5220'] },
  { id: 'food',    title: 'Food & terrasses', emoji: '🍜', gradient: ['#E88A4A', '#A34E1F'] },
];

interface QuestionMoodsProps {
  onChange: (moods: string[]) => void;
}

export function QuestionMoods({ onChange }: QuestionMoodsProps) {
  return <SwipeDeck cards={MOOD_CARDS} onComplete={onChange} />;
}
