// HAKO — Tests des résumés du dashboard (tuile BUDGET)
// Lancer : npm run test:utils

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { balanceLabel, formatEuros, plural, summarizeBudget } from '../utils/dashboardSummary.ts';

const expenses = [
  // Moi : 90 € de resto partagé en 3
  { amount: 90, paid_by: 'me', expense_splits: [{ user_id: 'me', amount: 30 }, { user_id: 'a', amount: 30 }, { user_id: 'b', amount: 30 }] },
  // A : 60 € d'essence partagé entre A et moi
  { amount: 60, paid_by: 'a', expense_splits: [{ user_id: 'a', amount: 30 }, { user_id: 'me', amount: 30 }] },
];

describe('tuile BUDGET', () => {
  it('additionne le total du groupe et calcule mon solde', () => {
    assert.deepEqual(summarizeBudget(expenses, 'me'), { total: 150, expenseCount: 2, myBalance: 30 });
    assert.equal(summarizeBudget(expenses, 'b').myBalance, -30);
    assert.equal(summarizeBudget([], 'me').total, 0);
  });

  it('formate le solde', () => {
    assert.equal(balanceLabel(30), 'On te doit 30 €');
    assert.equal(balanceLabel(-45.4), 'Tu dois 45 €');
    assert.equal(balanceLabel(0), 'Tout est équilibré');
    assert.equal(formatEuros(1240.6), '1 241 €');
  });

  it('accorde au pluriel', () => {
    assert.equal(plural(1, 'activité'), '1 activité');
    assert.equal(plural(3, 'activité'), '3 activités');
  });
});
