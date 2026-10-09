import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { prepProgress, prepSummaryLabel, sortTasks } from '../utils/preparation.ts';

const task = (id: string, done: boolean, assignedTo: string | null, createdAt: string) => ({ id, done, assignedTo, createdAt });

describe('sortTasks', () => {
  test('mes tâches d’abord, puis les plus anciennes ; faites à part', () => {
    const { open, done } = sortTasks([
      task('a', false, null, '2026-10-01'),
      task('b', true, 'me', '2026-10-02'),
      task('c', false, 'me', '2026-10-03'),
      task('d', false, 'ami', '2026-09-30'),
    ], 'me');
    assert.deepEqual(open.map(t => t.id), ['c', 'd', 'a']);
    assert.deepEqual(done.map(t => t.id), ['b']);
  });
});

describe('prepProgress', () => {
  test('additionne essentiels et tâches', () => {
    assert.deepEqual(prepProgress(3, 5, [task('a', true, null, ''), task('b', false, null, '')]), { done: 4, total: 7 });
  });
});

describe('prepSummaryLabel', () => {
  test('tâches + essentiels', () => {
    assert.equal(prepSummaryLabel(2, 3, 5), '2 tâches à faire · 3/5 essentiels');
    assert.equal(prepSummaryLabel(1, 5, 5), '1 tâche à faire · 5/5 essentiels');
    assert.equal(prepSummaryLabel(0, 2, 5), '2/5 essentiels');
  });
  test('tout est prêt', () => {
    assert.equal(prepSummaryLabel(0, 5, 5), 'Tout est prêt, bon voyage !');
  });
});
