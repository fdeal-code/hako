// HAKO — Tests du partage vers Hako
// Lancer : npm run test:utils

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sharedLink, tripMoment, tripsForShare } from '../utils/shareIntake.ts';

const trips = [
  { id: 'colombie', name: 'Colombie', start_date: '2026-08-01', end_date: '2026-08-15' },
  { id: 'lisbonne', name: 'Lisbonne', start_date: '2027-03-01', end_date: '2027-03-05' },
  { id: 'japon', name: 'Japon', start_date: '2026-10-04', end_date: '2026-10-17' },
  { id: 'rome', name: 'Rome', start_date: '2026-12-01', end_date: '2026-12-04' },
  { id: 'maroc', name: 'Maroc', start_date: '2026-03-01', end_date: '2026-03-08' },
];

describe('partage vers Hako', () => {
  it('trouve le lien partagé', () => {
    assert.equal(sharedLink({ webUrl: 'https://vm.tiktok.com/ZM8x/' }), 'https://vm.tiktok.com/ZM8x/');
    assert.equal(sharedLink({ text: 'Regarde ça ! https://www.instagram.com/reel/abc/ trop beau' }), 'https://www.instagram.com/reel/abc/');
    assert.equal(sharedLink({ text: 'pas de lien' }), null);
    assert.equal(sharedLink({}), null);
  });

  it('classe les voyages : en cours, à venir, passés', () => {
    assert.deepEqual(tripsForShare(trips, '2026-10-09').map(t => t.id), ['japon', 'rome', 'lisbonne', 'colombie', 'maroc']);
    assert.equal(tripMoment(trips[2]!, '2026-10-09'), 'now');
    assert.equal(tripMoment(trips[0]!, '2026-10-09'), 'past');
  });
});
