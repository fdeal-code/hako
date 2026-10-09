// HAKO — Tests de l'ajout au planning (créneau libre, chevauchements)
// Lancer : npm run test:utils

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { endFor, firstFreeStart, nudge, overlapping } from '../utils/planSlot.ts';

const day = [
  { title: 'Fushimi', start_time: '09:00:00', end_time: '11:30:00' },
  { title: 'Kinkaku-ji', start_time: '13:00', end_time: '14:30' },
  { title: 'Dîner', start_time: '19:30', end_time: null },
];

describe('ajout au planning', () => {
  it('repère les chevauchements', () => {
    assert.deepEqual(overlapping(day, '11:00', '12:00').map(d => d.title), ['Fushimi']);
    assert.deepEqual(overlapping(day, '11:30', '13:00').map(d => d.title), []);
    assert.deepEqual(overlapping(day, '20:00', '21:00').map(d => d.title), ['Dîner']); // sans fin : 1 h
  });

  it('trouve le premier créneau libre', () => {
    assert.equal(firstFreeStart(day, 60), '11:30');
    assert.equal(firstFreeStart(day, 120), '14:30');
    assert.equal(firstFreeStart([], 60), '09:00');
    assert.equal(firstFreeStart([{ start_time: '09:00', end_time: '23:00' }], 60), null);
  });

  it('calcule la fin et décale par quart d’heure', () => {
    assert.equal(endFor('10:15', 150), '12:45');
    assert.equal(endFor('23:00', 120), '23:45');
    assert.equal(nudge('09:00', -15), '08:45');
    assert.equal(nudge('00:00', -15), '00:00');
  });
});
