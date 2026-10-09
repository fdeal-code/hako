// HAKO — Tests de la carte (trajets, billets, durées)
// Lancer : npm run test:utils

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildLegs, driveMinutes, formatDuration, placesForStop, ticketDuration, ticketForLeg } from '../utils/tripMap.ts';

const stops = [
  { id: 'tokyo', place_name: 'Tokyo', lat: 35.6762, lng: 139.6503, start_date: '2026-10-04', end_date: '2026-10-08' },
  { id: 'hakone', place_name: 'Hakone', lat: 35.2323, lng: 139.1069, start_date: '2026-10-08', end_date: '2026-10-09' },
  { id: 'kyoto', place_name: 'Kyoto', lat: 35.0116, lng: 135.7681, start_date: '2026-10-09', end_date: '2026-10-13' },
];
const tickets = [
  { id: 'vol', title: 'Vol Paris → Tokyo', category: 'flight', event_date: '2026-10-04', details: { from: 'CDG', to: 'HND', departure: '11:25', arrival: '07:05' } },
  { id: 'shin', title: 'Shinkansen Odawara → Kyoto', category: 'transport', event_date: '2026-10-09', details: { from: 'Odawara', to: 'Kyoto', departure: '12:41', arrival: '14:52' } },
  { id: 'hotel', title: 'Machiya', category: 'hotel', event_date: '2026-10-09', details: null },
];

describe('trajets', () => {
  it('relie les étapes et retrouve les billets', () => {
    const legs = buildLegs(stops, tickets);
    assert.deepEqual(legs.map(l => [l.fromLabel, l.toLabel, l.mode, l.ticket?.id ?? null]), [
      ['CDG', 'HND', 'flight', 'vol'],
      ['Tokyo', 'Hakone', 'car', null],
      ['Hakone', 'Kyoto', 'train', 'shin'],
    ]);
    assert.equal(legs[2]?.durationMinutes, 131);
    assert.ok((legs[1]?.distanceKm ?? 0) > 60 && (legs[1]?.distanceKm ?? 0) < 80);
  });

  it('ne prend pas un billet d’un autre jour ni un hôtel', () => {
    assert.equal(ticketForLeg(tickets, '2026-10-08', 'Tokyo', 'Hakone'), null);
  });

  it('calcule et formate les durées', () => {
    assert.equal(ticketDuration(tickets[0] ?? null), 1180); // vol de nuit : 11:25 → 07:05
    assert.equal(formatDuration(131), '2 h 11');
    assert.equal(formatDuration(45), '45 min');
    assert.equal(formatDuration(780), '13 h');
    assert.equal(driveMinutes(75), 78);
  });
});

describe('lieux d’une ville', () => {
  it('logements d’abord, puis par créneau', () => {
    const base = { category: null, status: 'validated', address: null, latitude: 0, longitude: 0, imageUrl: null, plannedTime: null };
    const places = [
      { ...base, id: 'b', title: 'Kinkaku-ji', stopId: 'kyoto', booked: false, plannedDay: '2026-10-10' },
      { ...base, id: 'a', title: 'Fushimi', stopId: 'kyoto', booked: false, plannedDay: '2026-10-10', plannedTime: '07:00' },
      { ...base, id: 'c', title: 'Machiya', stopId: 'kyoto', booked: true, plannedDay: null },
      { ...base, id: 'd', title: 'Shibuya', stopId: 'tokyo', booked: false, plannedDay: null },
    ];
    assert.deepEqual(placesForStop(places, 'kyoto').map(p => p.id), ['c', 'a', 'b']);
    assert.equal(placesForStop(places, null).length, 4);
  });
});
