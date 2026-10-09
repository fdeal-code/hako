// HAKO — Budget : soldes, remboursements, totaux par catégorie et par ville
// Fonctions pures → testées dans tests/budgetSummary.test.ts.

export interface BudgetExpense {
  amount: number;
  paid_by: string;
  category: string;
  stop_id?: string | null;
  expense_splits: { user_id: string; amount: number }[];
}

export interface Debt { from: string; to: string; amount: number }

export interface CategoryTotal { category: string; total: number; count: number; share: number }

export interface StopTotal { stopId: string | null; total: number; count: number }

const EPSILON = 0.01;

/** Payé − part de chacun (> 0 : on lui doit · < 0 : il doit). */
export function computeBalances(expenses: readonly BudgetExpense[]): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const e of expenses) {
    balances[e.paid_by] = (balances[e.paid_by] ?? 0) + e.amount;
    for (const s of e.expense_splits) balances[s.user_id] = (balances[s.user_id] ?? 0) - s.amount;
  }
  return balances;
}

/** Remboursements minimaux : les plus gros débiteurs remboursent les plus gros créanciers. */
export function settleDebts(balances: Readonly<Record<string, number>>): Debt[] {
  const debtors = Object.entries(balances).filter(([, v]) => v < -EPSILON)
    .map(([id, v]) => ({ id, amount: -v })).sort((a, b) => b.amount - a.amount);
  const creditors = Object.entries(balances).filter(([, v]) => v > EPSILON)
    .map(([id, v]) => ({ id, amount: v })).sort((a, b) => b.amount - a.amount);
  const debts: Debt[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    if (!d || !c) break;
    const amount = Math.min(d.amount, c.amount);
    if (amount > EPSILON) debts.push({ from: d.id, to: c.id, amount: Math.round(amount * 100) / 100 });
    d.amount -= amount;
    c.amount -= amount;
    if (d.amount < EPSILON) i++;
    if (c.amount < EPSILON) j++;
  }
  return debts;
}

/** Total par catégorie, du plus gros au plus petit, avec la part du total (0 → 1). */
export function totalsByCategory(expenses: readonly BudgetExpense[]): CategoryTotal[] {
  const grand = expenses.reduce((s, e) => s + e.amount, 0);
  const map = new Map<string, { total: number; count: number }>();
  for (const e of expenses) {
    const row = map.get(e.category) ?? { total: 0, count: 0 };
    map.set(e.category, { total: row.total + e.amount, count: row.count + 1 });
  }
  return [...map.entries()]
    .map(([category, r]) => ({ category, total: r.total, count: r.count, share: grand > 0 ? r.total / grand : 0 }))
    .sort((a, b) => b.total - a.total);
}

/** Total par étape, dans l'ordre du trajet ; les dépenses sans étape à la fin (stopId null). */
export function totalsByStop(expenses: readonly BudgetExpense[], stopOrder: readonly string[]): StopTotal[] {
  const rows: StopTotal[] = stopOrder.map(stopId => {
    const list = expenses.filter(e => e.stop_id === stopId);
    return { stopId, total: list.reduce((s, e) => s + e.amount, 0), count: list.length };
  });
  const loose = expenses.filter(e => !e.stop_id || !stopOrder.includes(e.stop_id));
  if (loose.length > 0) rows.push({ stopId: null, total: loose.reduce((s, e) => s + e.amount, 0), count: loose.length });
  return rows;
}
