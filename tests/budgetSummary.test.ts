// HAKO — Tests du budget (équilibre, catégories, villes)
// Lancer : npm run test:utils

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeBalances, settleDebts, totalsByCategory, totalsByStop } from '../utils/budgetSummary.ts';

const share3 = (amount: number) => ['a', 'b', 'c'].map(user_id => ({ user_id, amount: amount / 3 }));
const expenses = [
  { amount: 90, paid_by: 'a', category: 'food', stop_id: 's1', expense_splits: share3(90) },
  { amount: 300, paid_by: 'b', category: 'accommodation', stop_id: 's1', expense_splits: share3(300) },
  { amount: 60, paid_by: 'a', category: 'food', stop_id: 's2', expense_splits: share3(60) },
  { amount: 30, paid_by: 'c', category: 'transport', stop_id: null, expense_splits: share3(30) },
];

describe('équilibre', () => {
  it('calcule les soldes', () => {
    const b = computeBalances(expenses);
    assert.equal(Math.round(b.a ?? 0), -10);   // payé 150, part 160
    assert.equal(Math.round(b.b ?? 0), 140);   // payé 300, part 160
    assert.equal(Math.round(b.c ?? 0), -130);  // payé 30, part 160
  });

  it('propose les remboursements minimaux', () => {
    const debts = settleDebts(computeBalances(expenses));
    assert.deepEqual(debts.map(d => [d.from, d.to, Math.round(d.amount)]), [['c', 'b', 130], ['a', 'b', 10]]);
  });

  it('ne propose rien quand tout est réglé', () => {
    assert.deepEqual(settleDebts({ a: 0, b: 0.004 }), []);
  });
});

describe('totaux', () => {
  it('par catégorie, du plus gros au plus petit', () => {
    const rows = totalsByCategory(expenses);
    assert.deepEqual(rows.map(r => [r.category, r.total, r.count]), [['accommodation', 300, 1], ['food', 150, 2], ['transport', 30, 1]]);
    assert.equal(rows[1]?.share, 150 / 480);
  });

  it('par ville dans l’ordre du trajet, sans ville à la fin', () => {
    const rows = totalsByStop(expenses, ['s1', 's2', 's3']);
    assert.deepEqual(rows.map(r => [r.stopId, r.total]), [['s1', 390], ['s2', 60], ['s3', 0], [null, 30]]);
  });
});
