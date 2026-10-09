// HAKO — Préparatifs : fonctions pures (tri des tâches, avancement)
// Aucun import local : testable avec node --test.

export interface TaskLike { done: boolean; assignedTo: string | null; createdAt: string }

/** À faire d'abord (les miennes en tête, puis les plus anciennes), puis les faites. */
export function sortTasks<T extends TaskLike>(tasks: readonly T[], me: string): { open: T[]; done: T[] } {
  const byAge = (a: T, b: T) => a.createdAt.localeCompare(b.createdAt);
  const open = tasks.filter(t => !t.done).sort((a, b) => {
    const mine = Number(b.assignedTo === me) - Number(a.assignedTo === me);
    return mine !== 0 ? mine : byAge(a, b);
  });
  const done = tasks.filter(t => t.done).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { open, done };
}

/** Avancement global : essentiels cochés + tâches faites. */
export function prepProgress(essentialsDone: number, essentialsTotal: number, tasks: readonly TaskLike[]): { done: number; total: number } {
  return {
    done: essentialsDone + tasks.filter(t => t.done).length,
    total: essentialsTotal + tasks.length,
  };
}

/** « 2 tâches à faire · 3/5 essentiels » — ou « Tout est prêt ». */
export function prepSummaryLabel(openTasks: number, essentialsDone: number, essentialsTotal: number): string {
  if (openTasks === 0 && essentialsDone >= essentialsTotal) return 'Tout est prêt, bon voyage !';
  const parts: string[] = [];
  if (openTasks > 0) parts.push(`${openTasks} tâche${openTasks > 1 ? 's' : ''} à faire`);
  parts.push(`${essentialsDone}/${essentialsTotal} essentiels`);
  return parts.join(' · ');
}
