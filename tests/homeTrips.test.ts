import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { splitHomeTrips } from '../utils/homeTrips.ts';

const t = (id: string, start_date: string, end_date: string) => ({ id, start_date, end_date });
const TODAY = '2026-10-09';

describe('splitHomeTrips', () => {
  test('en cours en vedette, puis à venir, puis terminés du plus récent', () => {
    const { featured, others } = splitHomeTrips([
      t('vieux', '2025-05-01', '2025-05-10'),
      t('loin', '2027-03-01', '2027-03-08'),
      t('japon', '2026-10-05', '2026-10-15'),
      t('colombie', '2026-08-01', '2026-08-15'),
      t('bientot', '2026-11-01', '2026-11-05'),
    ], TODAY);
    assert.equal(featured?.id, 'japon');
    assert.deepEqual(others.map(o => o.id), ['bientot', 'loin', 'colombie', 'vieux']);
  });
  test('que des voyages terminés : rien en vedette', () => {
    const { featured, others } = splitHomeTrips([t('a', '2026-01-01', '2026-01-05'), t('b', '2026-06-01', '2026-06-05')], TODAY);
    assert.equal(featured, null);
    assert.deepEqual(others.map(o => o.id), ['b', 'a']);
  });
  test('aucun voyage', () => {
    assert.deepEqual(splitHomeTrips([], TODAY), { featured: null, others: [] });
  });
});
