import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { stopForNight, stopsWithoutLodging } from '../utils/lodgingGaps.ts';

const stops = [
  { id: 'tokyo', place_name: 'Tokyo', start_date: '2026-11-02', end_date: '2026-11-06' },
  { id: 'kyoto', place_name: 'Kyoto', start_date: '2026-11-06', end_date: '2026-11-09' },
  { id: 'osaka', place_name: 'Osaka', start_date: '2026-11-09', end_date: '2026-11-11' },
];
const none = { hotelDays: [], bookedStopIds: [], checkInDays: [] };

describe('stopsWithoutLodging', () => {
  test('rien de réservé : toutes les étapes', () => {
    assert.deepEqual(stopsWithoutLodging(stops, none, '2026-10-12').map(s => s.id), ['tokyo', 'kyoto', 'osaka']);
  });
  test('document, envie réservée ou check-in couvrent l’étape', () => {
    const c = { hotelDays: ['2026-11-02T00:00:00'], bookedStopIds: ['kyoto'], checkInDays: ['2026-11-09'] };
    assert.deepEqual(stopsWithoutLodging(stops, c, '2026-10-12'), []);
  });
  test('le jour du départ ne couvre pas l’étape', () => {
    const c = { hotelDays: ['2026-11-06'], bookedStopIds: [], checkInDays: [] };
    assert.deepEqual(stopsWithoutLodging(stops, c, '2026-10-12').map(s => s.id), ['tokyo', 'osaka']);
  });
  test('étapes passées ignorées', () => {
    assert.deepEqual(stopsWithoutLodging(stops, none, '2026-11-09').map(s => s.id), ['osaka']);
  });
});

describe('stopForNight', () => {
  test('arrivée incluse, départ exclu', () => {
    assert.equal(stopForNight(stops, '2026-11-06')?.id, 'kyoto');
    assert.equal(stopForNight(stops, '2026-11-05')?.id, 'tokyo');
    assert.equal(stopForNight(stops, '2026-11-11'), null);
  });
});
