// HAKO — Tests de l'après-voyage (avis, récap, trophées)
// Lancer : npm run test:utils

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildRecapMessage, buildReviewables, podium, recapBadges, recapStats, tripDayCount,
} from '../utils/pastRecap.ts';

const wishes = [
  { id: 'w1', title: 'Hôtel Lago', image_url: null, category: 'hotel', stop_id: 's1', address: null, booked_at: null },
  { id: 'w2', title: 'Lac de Braies', image_url: null, category: 'monument', stop_id: 's1', address: null, booked_at: null },
  { id: 'w3', title: 'Agriturismo', image_url: null, category: 'autre', stop_id: 's2', address: null, booked_at: '2026-06-01' },
];
const reviews = [
  { wish_id: 'w2', user_id: 'me', rating: 5, comment: 'Magique' },
  { wish_id: 'w2', user_id: 'a', rating: 4, comment: null },
  { wish_id: 'w1', user_id: 'a', rating: 3, comment: null },
];
const members = [
  { userId: 'me', nickname: 'Félix', avatarUrl: null },
  { userId: 'a', nickname: 'Léa', avatarUrl: null },
];

describe('avis', () => {
  it('liste les logements d’abord, avec ma note et la moyenne', () => {
    const items = buildReviewables(wishes, reviews, 'me');
    assert.deepEqual(items.map(i => [i.title, i.kind]), [
      ['Agriturismo', 'lodging'], ['Hôtel Lago', 'lodging'], ['Lac de Braies', 'activity'],
    ]);
    const lac = items.find(i => i.wishId === 'w2');
    assert.equal(lac?.myRating, 5);
    assert.equal(lac?.avgRating, 4.5);
    assert.equal(items.find(i => i.wishId === 'w1')?.myRating, null);
  });

  it('classe le podium par moyenne', () => {
    const top = podium(buildReviewables(wishes, reviews, 'me'));
    assert.deepEqual(top.map(i => i.title), ['Lac de Braies', 'Hôtel Lago']);
  });
});

describe('récap', () => {
  it('compte les jours départ et retour inclus', () => {
    assert.equal(tripDayCount('2026-06-12', '2026-06-19'), 8);
    assert.equal(tripDayCount('2026-06-12', '2026-06-12'), 1);
  });

  it('calcule les stats et la part par personne', () => {
    const stats = recapStats({
      startDate: '2026-06-12', endDate: '2026-06-19', cityCount: 2, placeCount: 3, photoCount: 10,
      expenses: [{ amount: 300, paid_by: 'a', expense_splits: [] }, { amount: 100, paid_by: 'me', expense_splits: [] }],
      memberCount: 2,
    });
    assert.deepEqual(stats, { days: 8, cities: 2, places: 3, photos: 10, total: 400, perPerson: 200 });
  });

  it('décerne les trophées', () => {
    const badges = recapBadges({
      members,
      photos: [
        { id: 'p1', photoUrl: '', uploadedBy: 'a', caption: null, createdAt: '' },
        { id: 'p2', photoUrl: '', uploadedBy: 'a', caption: null, createdAt: '' },
        { id: 'p3', photoUrl: '', uploadedBy: 'me', caption: null, createdAt: '' },
      ],
      expenses: [{ amount: 300, paid_by: 'a', expense_splits: [] }, { amount: 100, paid_by: 'me', expense_splits: [] }],
      reviews,
      wishAuthors: { w1: 'me', w2: 'me', w3: 'a' },
    });
    assert.deepEqual(badges.map(b => [b.id, b.winner.nickname, b.detail]), [
      ['photographer', 'Léa', '2 photos'],
      ['banker', 'Léa', 'a avancé 300 €'],
      ['critic', 'Léa', '2 avis'],
      ['explorer', 'Félix', '2 idées validées'],
    ]);
  });

  it('rédige le message de partage', () => {
    const message = buildRecapMessage({
      name: 'Dolomites', dates: '12 → 19 juin',
      stats: { days: 8, cities: 2, places: 3, photos: 10, total: 400, perPerson: 200 },
      top: podium(buildReviewables(wishes, reviews, 'me')),
    });
    assert.ok(message.startsWith('🌍 Dolomites — 12 → 19 juin'));
    assert.ok(message.includes('1. Lac de Braies (4.5/5)'));
  });
});
