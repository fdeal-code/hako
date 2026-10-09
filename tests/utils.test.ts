// HAKO — Tests des fonctions pures (aucune dépendance : lanceur intégré de Node ≥ 22)
// Lancer : npm run test:utils

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addDays, adjustNights, buildDestinationLabel, distributeNights, isNightSplitValid,
  nearestStop, nightOwners, nightsAfterAppend, nightsAfterRemoval, nightsBetween,
  splitDatesIntoStops, stopColor, stopForDay, stopsForDay, tripDays,
} from '../utils/tripStops.ts';
import { activitiesPerDay, clampBudget, lodgingPerNight } from '../utils/tripBudget.ts';
import { computeWishStatus, majorityThreshold } from '../utils/wishVotes.ts';
import { regionForPoints, stopPoints } from '../utils/mapRegion.ts';
import { bookingUrl, partnerLinks } from '../utils/affiliateLinks.ts';

const draft = (place_name: string, nights: number) => ({
  place_name, description: place_name, secondary_text: '', place_id: null, country_code: null, nights,
});

describe('dates (UTC, jamais décalées)', () => {
  it('compte les nuits', () => assert.equal(nightsBetween('2026-06-02', '2026-06-09'), 7));
  it('passe les fins de mois et le changement d’heure', () => {
    assert.equal(addDays('2026-02-28', 1), '2026-03-01');
    assert.equal(addDays('2026-03-28', 3), '2026-03-31');
  });
  it('liste les jours du voyage', () => assert.equal(tripDays('2026-06-02', '2026-06-09').length, 8));
});

describe('répartition des nuits', () => {
  it('répartit équitablement', () => assert.deepEqual(distributeNights(7, 3), [3, 2, 2]));
  it('valide le total', () => {
    assert.ok(isNightSplitValid([draft('Rome', 3), draft('Florence', 2), draft('Braies', 2)], 7));
    assert.ok(!isNightSplitValid([draft('Rome', 0)], 0));
  });
  it('ajuste sans changer le total et garde 1 nuit min', () => {
    assert.deepEqual(adjustNights([3, 2, 2], 0, 1), [4, 1, 2]);
    assert.deepEqual(adjustNights([1, 1, 1], 0, 1), [1, 1, 1]);
    for (let k = 0; k < 200; k++) {
      const n = [1 + (k % 4), 2, 1 + (k % 3)];
      const r = adjustNights(n, k % 3, k % 2 ? 1 : -1);
      assert.equal(r.reduce((a, b) => a + b), n.reduce((a, b) => a + b));
      assert.ok(r.every(x => x >= 1));
    }
  });
  it('redistribue après suppression / ajout', () => {
    assert.deepEqual(nightsAfterRemoval([3, 2, 2], 1), [5, 2]);
    assert.deepEqual(nightsAfterRemoval([3, 2, 2], 0), [5, 2]);
    assert.deepEqual(nightsAfterAppend([3, 2, 2]), [3, 2, 1, 1]);
    assert.equal(nightsAfterAppend([3, 1]), null);
  });
  it('associe chaque nuit à sa ville', () => assert.deepEqual(nightOwners([3, 2, 2]), [0, 0, 0, 1, 1, 2, 2]));
});

describe('étapes datées', () => {
  const dated = splitDatesIntoStops('2026-06-02', [draft('Rome', 3), draft('Florence', 2), draft('Braies', 2)]);
  it('le jour de transfert appartient aux deux villes', () => {
    assert.deepEqual(dated.map(s => [s.start_date, s.end_date]), [
      ['2026-06-02', '2026-06-05'], ['2026-06-05', '2026-06-07'], ['2026-06-07', '2026-06-09'],
    ]);
    assert.equal(stopsForDay(dated, '2026-06-05').length, 2);
    assert.equal(stopForDay(dated.map((s, i) => ({ ...s, id: String(i), trip_id: 't', position: i, lat: null, lng: null, created_at: '' })), '2026-06-05')?.place_name, 'Florence');
  });
  it('construit le libellé', () => {
    assert.equal(buildDestinationLabel(['Rome']), 'Rome');
    assert.equal(buildDestinationLabel(['Rome', 'Florence', 'Lac de Braies']), 'Rome, Florence +1');
  });
  it('trouve la ville la plus proche', () => {
    const stops = [{ id: 'rome', lat: 41.9, lng: 12.5 }, { id: 'flo', lat: 43.77, lng: 11.25 }, { id: 'x', lat: null, lng: null }];
    assert.equal(nearestStop(stops, 43.72, 10.4)?.id, 'flo');
    assert.equal(nearestStop([{ lat: null, lng: null }], 1, 1), null);
  });
  it('boucle sur la palette', () => assert.equal(stopColor(6, ['a', 'b', 'c']), 'a'));
});

describe('votes à la majorité', () => {
  const up = { vote: 'up' as const };
  const down = { vote: 'down' as const };
  it('seuil', () => { assert.equal(majorityThreshold(4), 3); assert.equal(majorityThreshold(1), 1); });
  it('un seul « pour » ne valide plus', () => assert.equal(computeWishStatus([up], 4), 'debate'));
  it('valide / écarte à la majorité', () => {
    assert.equal(computeWishStatus([up, up, up], 4), 'validated');
    assert.equal(computeWishStatus([down, down, down], 4), 'archived');
    assert.equal(computeWishStatus([], 4), 'pending');
    assert.equal(computeWishStatus([up], 1), 'validated');
  });
});

describe('budget, carte, partenaires', () => {
  it('traduit le budget', () => {
    assert.equal(lodgingPerNight(600, 7), 39);
    assert.equal(activitiesPerDay(600, 7), 19);
    assert.equal(clampBudget(624), 600);
  });
  it('cadre plusieurs villes', () => {
    const r = regionForPoints(stopPoints([{ lat: 41.9, lng: 12.5 }, { lat: 43.77, lng: 11.25 }, { lat: null, lng: null }]));
    assert.ok(r && r.latitudeDelta > 1.8);
    assert.equal(regionForPoints([]), null);
  });
  it('pré-remplit la recherche Booking', () => {
    const url = bookingUrl({ city: 'Florence', checkin: '2026-06-05', checkout: '2026-06-07', travelers: 4, maxPerNightPerPerson: 45 }, '123');
    assert.ok(url.includes('ss=Florence') && url.includes('group_adults=4') && url.includes('aid=123'));
    assert.equal(partnerLinks('activities', { city: 'Rome', checkin: 'a', checkout: 'b', travelers: 2 }).length, 2);
  });
});
