// HAKO — Tests du planning (journée, transfert)
// Lancer : npm run test:utils

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { arrivalIndex, dayHeader, entryKind, longDayLabel, stopsOnDay } from '../utils/planningDay.ts';

const stops = [
  { id: 'rome', position: 0, place_name: 'Rome', start_date: '2026-06-02', end_date: '2026-06-05' },
  { id: 'flo', position: 1, place_name: 'Florence', start_date: '2026-06-05', end_date: '2026-06-07' },
  { id: 'braies', position: 2, place_name: 'Braies', start_date: '2026-06-07', end_date: '2026-06-09' },
];

describe('journée du planning', () => {
  it('formate la date', () => {
    assert.equal(longDayLabel('2026-06-05'), 'VEN. 05 JUIN');
  });

  it('trouve les étapes du jour', () => {
    assert.deepEqual(stopsOnDay(stops, '2026-06-05').map(s => s.id), ['rome', 'flo']);
    assert.deepEqual(stopsOnDay(stops, '2026-06-03').map(s => s.id), ['rome']);
  });

  it('écrit l’en-tête du jour', () => {
    assert.equal(dayHeader(stops, '2026-06-05'), 'ROME · VEN. 05 JUIN · DERNIER JOUR');
    assert.equal(dayHeader(stops, '2026-06-02'), 'ROME · MAR. 02 JUIN · ARRIVÉE');
    assert.equal(dayHeader(stops, '2026-06-03'), 'ROME · MER. 03 JUIN · JOUR 2');
    assert.equal(dayHeader(stops, '2026-06-09'), 'BRAIES · MAR. 09 JUIN · JOUR 3');
  });

  it('reconnaît le type de créneau', () => {
    assert.equal(entryKind({ id: '1', title: 'Train → Florence', start_time: null, stop_id: null, wish: null }, false), 'transport');
    assert.equal(entryKind({ id: '2', title: 'Visite', start_time: null, stop_id: null, wish: null }, true), 'transport');
    assert.equal(entryKind({ id: '3', title: 'Check-in · Appart', start_time: null, stop_id: null, wish: null }, false), 'lodging');
    assert.equal(entryKind({ id: '4', title: 'Apéro', start_time: null, stop_id: null, wish: { category: 'bar' } }, false), 'food');
    assert.equal(entryKind({ id: '5', title: 'Offices', start_time: null, stop_id: null, wish: { category: 'monument' } }, false), 'activity');
  });

  it('place le bandeau d’arrivée avant le premier créneau de la nouvelle ville', () => {
    const day = [
      { id: 'a', title: 'Check-out', start_time: '09:00', stop_id: 'rome', wish: null },
      { id: 'b', title: 'Train → Florence', start_time: '11:30', stop_id: 'rome', wish: null },
      { id: 'c', title: 'Check-in', start_time: '14:00', stop_id: 'flo', wish: null },
    ];
    assert.equal(arrivalIndex(day, stops, '2026-06-05'), 2);
    assert.equal(arrivalIndex(day, stops, '2026-06-03'), -1);
  });
});
