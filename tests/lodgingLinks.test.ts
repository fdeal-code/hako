import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { lodgingNameFromUrl, lodgingSite, withLodgingAffiliate } from '../utils/lodgingLinks.ts';

describe('lodgingSite', () => {
  test('reconnaît les sites', () => {
    assert.equal(lodgingSite('https://www.booking.com/hotel/jp/gracery-shinjuku.fr.html'), 'booking');
    assert.equal(lodgingSite('https://www.hostelworld.com/hostels/p/89953/piece-hostel-sanjo/'), 'hostelworld');
    assert.equal(lodgingSite('https://www.airbnb.fr/rooms/12345'), 'airbnb');
    assert.equal(lodgingSite('https://example.com/hotel'), 'other');
    assert.equal(lodgingSite('pas une url'), 'other');
  });
});

describe('lodgingNameFromUrl', () => {
  test('Booking', () => {
    assert.equal(lodgingNameFromUrl('https://www.booking.com/hotel/jp/gracery-shinjuku.fr.html?aid=1'), 'Gracery Shinjuku');
    assert.equal(lodgingNameFromUrl('https://www.booking.com/hotel/it/la-casa-di-anna.html'), 'La Casa di Anna');
  });
  test('Hostelworld (ancien et nouveau format)', () => {
    assert.equal(lodgingNameFromUrl('https://www.hostelworld.com/pwa/hosteldetails.php/Piece-Hostel-Sanjo/Kyoto/89953'), 'Piece Hostel Sanjo');
    assert.equal(lodgingNameFromUrl('https://www.hostelworld.com/hostels/p/89953/piece-hostel-sanjo/'), 'Piece Hostel Sanjo');
  });
  test('Airbnb ou inconnu → null', () => {
    assert.equal(lodgingNameFromUrl('https://www.airbnb.fr/rooms/12345'), null);
    assert.equal(lodgingNameFromUrl('nope'), null);
  });
});

describe('withLodgingAffiliate', () => {
  test('ajoute ou remplace l’identifiant', () => {
    assert.equal(
      withLodgingAffiliate('https://www.booking.com/hotel/jp/x.html?aid=999&lang=fr', { bookingAid: '123' }),
      'https://www.booking.com/hotel/jp/x.html?aid=123&lang=fr',
    );
    assert.equal(
      withLodgingAffiliate('https://www.hostelworld.com/hostels/p/1/x/', { hostelworld: 'hako' }),
      'https://www.hostelworld.com/hostels/p/1/x/?affiliate=hako',
    );
  });
  test('sans identifiant ou autre site : inchangé', () => {
    assert.equal(withLodgingAffiliate('https://www.booking.com/hotel/jp/x.html', {}), 'https://www.booking.com/hotel/jp/x.html');
    assert.equal(withLodgingAffiliate('https://www.airbnb.fr/rooms/1', { bookingAid: '1' }), 'https://www.airbnb.fr/rooms/1');
  });
});
