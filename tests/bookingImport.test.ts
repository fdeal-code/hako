import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  bookingWarnings, docCategoryFor, expenseCategoryFor, isDuplicate, planningSlotsFor, ticketDetailsFor,
} from '../utils/bookingImport.ts';
import type { BookingLike } from '../utils/bookingImport.ts';

const base: BookingLike = {
  kind: 'flight', title: 'Vol Paris → Tokyo', provider: 'Air France', reference: 'ABC123',
  start_date: '2026-11-02', start_time: '10:35', end_date: '2026-11-03', end_time: '06:50',
  from_place: 'Paris CDG', to_place: 'Tokyo HND', travelers: ['Félix', 'Léa'], total_price: 1240, currency: 'EUR',
};

describe('catégories', () => {
  test('document et dépense', () => {
    assert.equal(docCategoryFor('flight'), 'flight');
    assert.equal(docCategoryFor('train'), 'transport');
    assert.equal(docCategoryFor('car'), 'transport');
    assert.equal(docCategoryFor('hotel'), 'hotel');
    assert.equal(expenseCategoryFor('flight'), 'transport');
    assert.equal(expenseCategoryFor('hotel'), 'accommodation');
    assert.equal(expenseCategoryFor('restaurant'), 'food');
  });
});

describe('ticketDetailsFor', () => {
  test('ne garde que les champs connus', () => {
    assert.deepEqual(ticketDetailsFor(base), {
      from: 'Paris CDG', to: 'Tokyo HND', departure: '10:35', arrival: '06:50', reference: 'ABC123', passenger: 'Félix, Léa',
    });
    assert.deepEqual(ticketDetailsFor({ ...base, kind: 'hotel', from_place: null, to_place: null, travelers: [], reference: null }), {});
  });
});

describe('planningSlotsFor', () => {
  test('vol de nuit : même titre que le billet, pas d’heure de fin le jour du départ', () => {
    assert.deepEqual(planningSlotsFor(base), [
      { title: 'Vol Paris → Tokyo', day: '2026-11-02', start: '10:35', end: null, notes: 'Paris CDG → Tokyo HND · Réf. ABC123' },
    ]);
  });
  test('hôtel : check-in et check-out avec heures par défaut', () => {
    const slots = planningSlotsFor({ ...base, kind: 'hotel', title: 'Hôtel Gracery', start_time: null, end_time: null, from_place: null, to_place: null });
    assert.deepEqual(slots.map(s => [s.title, s.day, s.start]), [
      ['Check-in · Hôtel Gracery', '2026-11-02', '15:00'],
      ['Check-out · Hôtel Gracery', '2026-11-03', '11:00'],
    ]);
  });
  test('voiture : prise et retour', () => {
    const slots = planningSlotsFor({ ...base, kind: 'car', title: 'Location Toyota', provider: 'Hertz', end_date: '2026-11-06' });
    assert.equal(slots.length, 2);
    assert.equal(slots[0]?.title, 'Prise du véhicule · Location Toyota (Hertz)');
  });
  test('sans date : rien au planning', () => {
    assert.deepEqual(planningSlotsFor({ ...base, start_date: null }), []);
  });
});

describe('bookingWarnings', () => {
  test('hors des dates du voyage, devise étrangère', () => {
    assert.deepEqual(bookingWarnings({ ...base, currency: 'JPY' }, '2026-11-03', '2026-11-12'), ['outside_trip', 'foreign_currency']);
  });
  test('tout va bien', () => {
    assert.deepEqual(bookingWarnings(base, '2026-11-01', '2026-11-12'), []);
  });
  test('sans date ni prix', () => {
    assert.deepEqual(bookingWarnings({ ...base, start_date: null, end_date: null, total_price: null }, null, null), ['no_date', 'no_price']);
  });
});

describe('isDuplicate', () => {
  test('même référence et même jour', () => {
    assert.ok(isDuplicate(base, [{ reference: 'ABC123', day: '2026-11-02' }]));
    assert.ok(!isDuplicate(base, [{ reference: 'ABC123', day: '2026-11-09' }]));
    assert.ok(!isDuplicate({ ...base, reference: null }, [{ reference: null, day: '2026-11-02' }]));
  });
});
