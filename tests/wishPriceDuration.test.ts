// HAKO — Tests du prix et de la durée des envies
// Lancer : npm run test:utils

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { durationMinutes, formatMinutes, formatPrice, parsePrice, priceLabel, spanHours } from '../utils/wishPriceDuration.ts';

describe('prix et durée', () => {
  it('formate le prix', () => {
    assert.equal(formatPrice(0), 'Gratuit');
    assert.equal(formatPrice(25), '25 €');
    assert.equal(formatPrice(12.5), '12,50 €');
  });

  it('lit un prix saisi', () => {
    assert.equal(parsePrice('25'), 25);
    assert.equal(parsePrice('12,5 €'), 12.5);
    assert.equal(parsePrice(''), null);
    assert.equal(parsePrice('abc'), null);
    assert.equal(parsePrice('-3'), null);
  });

  it('formate la durée', () => {
    assert.equal(formatMinutes(45), '45 min');
    assert.equal(formatMinutes(90), '1 h 30');
    assert.equal(formatMinutes(120), '2 h');
    assert.equal(formatMinutes(240), 'Demi-journée');
    assert.equal(formatMinutes(480), 'Journée');
  });

  it('retombe sur les anciennes valeurs', () => {
    assert.equal(priceLabel(null, '€€'), '€€');
    assert.equal(priceLabel(30, '€€'), '30 €');
    assert.equal(priceLabel(undefined, null), null);
    assert.equal(durationMinutes(null, 'half-day'), 240);
    assert.equal(durationMinutes(75, '1h'), 75);
  });

  it('arrondit la durée à l’heure pour le planning', () => {
    assert.equal(spanHours(150), 3);
    assert.equal(spanHours(60), 1);
    assert.equal(spanHours(20), 1);
    assert.equal(spanHours(null), 1);
  });
});
