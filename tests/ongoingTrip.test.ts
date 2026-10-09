// HAKO — Tests du voyage en cours
// Lancer : npm run test:utils

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { countdown, nowAndNext, pickTodayDoc, shortTime, toMinutes, tripDay } from '../utils/ongoingTrip.ts';

const day = [
  { title: 'Bateau', start_time: '08:30:00', end_time: '10:00:00' },
  { title: 'Shinkansen', start_time: '12:41:00', end_time: '14:52:00' },
  { title: 'Check-in', start_time: '16:00:00', end_time: '16:30:00' },
  { title: 'Dîner', start_time: '19:30:00', end_time: null },
];

describe('voyage en cours', () => {
  it('donne le jour du voyage', () => {
    assert.deepEqual(tripDay('2026-10-04', '2026-10-17', '2026-10-09'), { day: 6, total: 14 });
    assert.deepEqual(tripDay('2026-10-04', '2026-10-17', '2026-10-01'), { day: 1, total: 14 });
  });

  it('trouve l’activité en cours et la prochaine', () => {
    const at = (hhmm: string) => nowAndNext(day, toMinutes(hhmm) ?? 0);
    assert.equal(at('09:00').current?.title, 'Bateau');
    assert.equal(at('09:00').next?.title, 'Shinkansen');
    assert.equal(at('09:00').left, 3);
    assert.equal(at('11:00').current, null);
    assert.equal(at('20:00').current?.title, 'Dîner'); // sans heure de fin : 1 h
    assert.equal(at('21:00').next, null);
  });

  it('formate le compte à rebours', () => {
    assert.equal(countdown(600, 625), 'dans 25 min');
    assert.equal(countdown(600, 720), 'dans 2 h');
    assert.equal(countdown(600, 670), 'dans 1 h 10');
    assert.equal(shortTime('12:41:00'), '12:41');
  });

  it('choisit le billet du jour', () => {
    const docs = [
      { title: 'Machiya', category: 'hotel', event_date: '2026-10-09', details: { departure: '16:00' } },
      { title: 'Shinkansen', category: 'transport', event_date: '2026-10-09', details: { departure: '12:41' } },
      { title: 'Vol', category: 'flight', event_date: '2026-10-04', details: { departure: '11:25' } },
    ];
    assert.equal(pickTodayDoc(docs, '2026-10-09', toMinutes('10:00') ?? 0)?.title, 'Shinkansen');
    assert.equal(pickTodayDoc(docs, '2026-10-09', toMinutes('15:00') ?? 0)?.title, 'Machiya'); // train parti
    assert.equal(pickTodayDoc(docs, '2026-10-10', 0), null);
  });
});

describe('accès direct', () => {
  it('construit le lien « Y aller »', async () => {
    const { directionsUrl } = await import('../utils/ongoingTrip.ts');
    const dest = { label: 'Fushimi Inari', address: 'Kyoto', latitude: 34.9671, longitude: 135.7727 };
    assert.equal(directionsUrl(dest, 'ios'), 'https://maps.apple.com/?daddr=34.9671,135.7727&q=Fushimi%20Inari');
    assert.equal(directionsUrl(dest, 'android'), 'https://www.google.com/maps/dir/?api=1&destination=34.9671,135.7727');
    assert.equal(directionsUrl({ ...dest, latitude: null, longitude: null }, 'android'), 'https://www.google.com/maps/dir/?api=1&destination=Kyoto');
    assert.equal(directionsUrl({ label: 'x', address: null, latitude: null, longitude: null }, 'ios'), null);
  });

  it('retrouve le billet d’une activité', async () => {
    const { ticketFor } = await import('../utils/ongoingTrip.ts');
    const docs = [
      { title: 'Shinkansen Odawara → Kyoto', category: 'transport', event_date: '2026-10-09', details: { departure: '12:41' } },
      { title: 'Machiya', category: 'hotel', event_date: '2026-10-09', details: { departure: '16:00' } },
    ];
    assert.equal(ticketFor({ title: 'Shinkansen Odawara → Kyoto', start_time: '12:41:00', end_time: null }, docs, '2026-10-09')?.title, 'Shinkansen Odawara → Kyoto');
    assert.equal(ticketFor({ title: 'Check-in', start_time: '16:00:00', end_time: null }, docs, '2026-10-09')?.title, 'Machiya');
    assert.equal(ticketFor({ title: 'Dîner', start_time: '19:30:00', end_time: null }, docs, '2026-10-09'), null);
  });

  it('propose les envies de la ville du jour, validées d’abord', async () => {
    const { nearbyIdeas } = await import('../utils/ongoingTrip.ts');
    const wishes = [
      { title: 'Kaiseki', status: 'pending', stop_id: 'kyoto' },
      { title: 'Arcade', status: 'validated', stop_id: 'kyoto' },
      { title: 'USJ', status: 'debate', stop_id: 'osaka' },
    ];
    assert.deepEqual(nearbyIdeas(wishes, 'kyoto').map(w => w.title), ['Arcade', 'Kaiseki']);
    assert.deepEqual(nearbyIdeas(wishes, null), []);
  });
});
