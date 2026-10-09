// HAKO — Tests de la fiche activité
// Lancer : npm run test:utils

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bigWord, durationLabel, fromMinutes, shiftSlot } from '../utils/activityDetail.ts';

describe('fiche activité', () => {
  it('choisit le grand mot', () => {
    assert.equal(bigWord('hotel', 'Machiya', false), 'DODO');
    assert.equal(bigWord(null, 'Shinkansen Odawara → Kyoto', true), 'TRAJET');
    assert.equal(bigWord(null, 'Kayak au lever du soleil', false), 'KAYAK');
    assert.equal(bigWord(null, 'Un très long-nom', false), 'GO');
  });

  it('calcule la durée', () => {
    assert.equal(durationLabel('07:00:00', '09:30:00'), '2 h 30');
    assert.equal(durationLabel('12:41', '13:26'), '45 min');
    assert.equal(durationLabel('10:00', null), null);
  });

  it('décale l’horaire par pas de 15 min', () => {
    assert.deepEqual(shiftSlot('07:00', '09:30', 'start', 15), { start: '07:15', end: '09:45' });
    assert.deepEqual(shiftSlot('07:00', '07:15', 'end', -15), { start: '07:00', end: '07:15' }); // 15 min minimum
    assert.deepEqual(shiftSlot('23:30', '23:45', 'start', 30), { start: '23:30', end: '23:45' });
    assert.deepEqual(shiftSlot('10:00', null, 'end', 15), { start: '10:00', end: '11:15' });
    assert.equal(fromMinutes(-20), '00:00');
  });
});
