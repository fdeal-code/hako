import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { expenseDayOptions, parseAmount, splitEqually } from '../utils/expenseForm.ts';

describe('parseAmount', () => {
  test('accepte virgule, point et espaces', () => {
    assert.equal(parseAmount('12,50'), 12.5);
    assert.equal(parseAmount('12.5'), 12.5);
    assert.equal(parseAmount('1 200'), 1200);
  });
  test('refuse vide, zéro, négatif, texte, trop de décimales', () => {
    for (const raw of ['', '0', '-3', 'abc', '1.234', '1,2,3']) assert.equal(parseAmount(raw), null, raw);
  });
});

describe('splitEqually', () => {
  test('la somme des parts = le total au centime', () => {
    const parts = splitEqually(10, ['a', 'b', 'c']);
    assert.deepEqual(parts.map(p => p.amount), [3.34, 3.33, 3.33]);
    assert.equal(Math.round(parts.reduce((s, p) => s + p.amount, 0) * 100), 1000);
  });
  test('personne → aucune part', () => {
    assert.deepEqual(splitEqually(10, []), []);
  });
  test('montant rond', () => {
    assert.deepEqual(splitEqually(90, ['a', 'b']).map(p => p.amount), [45, 45]);
  });
});

describe('expenseDayOptions', () => {
  test('voyage à venir → aujourd’hui seul', () => {
    assert.deepEqual(expenseDayOptions('2026-12-01', '2026-12-05', '2026-10-09'), ['2026-10-09']);
  });
  test('voyage en cours → du jour au départ, plus récent d’abord', () => {
    assert.deepEqual(expenseDayOptions('2026-10-07', '2026-10-12', '2026-10-09'), ['2026-10-09', '2026-10-08', '2026-10-07']);
  });
  test('voyage terminé → tous ses jours', () => {
    assert.deepEqual(expenseDayOptions('2026-09-01', '2026-09-03', '2026-10-09'), ['2026-09-03', '2026-09-02', '2026-09-01']);
  });
  test('sans dates → aujourd’hui', () => {
    assert.deepEqual(expenseDayOptions(null, null, '2026-10-09'), ['2026-10-09']);
  });
});
