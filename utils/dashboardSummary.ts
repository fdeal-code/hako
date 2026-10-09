// HAKO — Résumés affichés sur les tuiles du dashboard (fonctions pures)
// Testées dans tests/dashboardSummary.test.ts.

export interface ExpenseForSummary {
  amount: number;          // euros
  paid_by: string;
  expense_splits: { user_id: string; amount: number }[];
}

export interface BudgetSummary {
  total: number;           // dépensé par le groupe (€)
  expenseCount: number;
  myBalance: number;       // > 0 : on me doit · < 0 : je dois
}

const EPSILON = 0.01;

export function summarizeBudget(expenses: readonly ExpenseForSummary[], userId: string | null): BudgetSummary {
  let total = 0;
  let myBalance = 0;
  for (const e of expenses) {
    total += e.amount;
    if (!userId) continue;
    if (e.paid_by === userId) myBalance += e.amount;
    for (const split of e.expense_splits) if (split.user_id === userId) myBalance -= split.amount;
  }
  return { total, expenseCount: expenses.length, myBalance: Math.abs(myBalance) < EPSILON ? 0 : myBalance };
}

/** « 1 240 € » (pas de décimales sur une tuile). */
export function formatEuros(amount: number): string {
  const rounded = Math.round(amount);
  return `${String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
}

/** Ligne sous le total : « Tu dois 45 € », « On te doit 30 € », « Tout est équilibré ». */
export function balanceLabel(myBalance: number): string {
  if (myBalance > 0) return `On te doit ${formatEuros(myBalance)}`;
  if (myBalance < 0) return `Tu dois ${formatEuros(-myBalance)}`;
  return 'Tout est équilibré';
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}
