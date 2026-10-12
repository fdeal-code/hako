import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { cleanListingName, extractListing, isAllowedListingUrl, looksBlocked } from '../supabase/functions/parse-listing/extract.ts';

describe('isAllowedListingUrl', () => {
  test('plateformes de logement seulement', () => {
    assert.ok(isAllowedListingUrl('https://www.booking.com/hotel/jp/x.html'));
    assert.ok(isAllowedListingUrl('https://www.hostelworld.com/hostels/p/1/x/'));
    assert.ok(isAllowedListingUrl('https://www.airbnb.fr/rooms/1'));
    assert.ok(!isAllowedListingUrl('http://169.254.169.254/latest/meta-data'));
    assert.ok(!isAllowedListingUrl('https://booking.com.evil.io/x'));
    assert.ok(!isAllowedListingUrl('file:///etc/passwd'));
  });
});

describe('looksBlocked', () => {
  test('vérification anti-robot', () => {
    assert.ok(looksBlocked(202, '<html></html>'));
    assert.ok(looksBlocked(200, '<script>window.awsWafCookieDomainList = []</script>'));
    assert.ok(!looksBlocked(200, '<html><head><title>Hôtel</title></head></html>'));
  });
});

describe('cleanListingName', () => {
  test('retire le suffixe du site', () => {
    assert.equal(cleanListingName('Len Kyoto, Kyoto - 2026 Prices & Reviews'), 'Len Kyoto, Kyoto');
    assert.equal(cleanListingName('Gracery Shinjuku | Booking.com'), 'Gracery Shinjuku');
    assert.equal(cleanListingName(null), null);
  });
});

describe('extractListing', () => {
  const html = `<html><head>
    <meta property="og:title" content="Casa Azul &amp; Jardin - Airbnb">
    <meta property="og:image" content="https://a0.muscache.com/im/pictures/abc.jpg?im_w=720">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Hotel","name":"Casa Azul","image":["https://cdn.example.com/1.jpg",{"url":"/2.jpg"}],
      "address":{"@type":"PostalAddress","streetAddress":"12 rue X","addressLocality":"Lisbonne"},
      "aggregateRating":{"ratingValue":"4.7"},"offers":{"price":"312.50","priceCurrency":"EUR"}}</script>
    <link rel="icon" href="/logo.svg">
  </head><body><img src="https://a0.muscache.com/im/pictures/abc.jpg"></body></html>`;
  test('nom, photos, adresse, note, prix', () => {
    const d = extractListing(html, 'https://www.airbnb.fr/rooms/1');
    assert.equal(d.name, 'Casa Azul');
    assert.deepEqual(d.photos, ['https://cdn.example.com/1.jpg', 'https://www.airbnb.fr/2.jpg', 'https://a0.muscache.com/im/pictures/abc.jpg?im_w=720']);
    assert.equal(d.address, '12 rue X, Lisbonne');
    assert.equal(d.rating, 4.7);
    assert.equal(d.priceTotal, 312.5);
    assert.equal(d.currency, 'EUR');
  });
  test('sans données structurées : aperçu de partage', () => {
    const d = extractListing('<meta property="og:title" content="Len Kyoto, Kyoto - 2026 Prices & Reviews"><meta property="og:image" content="https://a.hwstatic.com/image/upload/f_auto,q_auto,t_30/propertyimages/9/93521/56.jpg">', 'https://www.hostelworld.com/');
    assert.equal(d.name, 'Len Kyoto, Kyoto');
    assert.equal(d.photos.length, 1);
    assert.equal(d.priceTotal, null);
  });
});
