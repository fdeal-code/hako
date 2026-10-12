import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { errorSummary, isValidEventName, routeName, sanitizeProps } from '../utils/telemetry.ts';

describe('telemetry', () => {
  test('noms d’événements', () => {
    assert.ok(isValidEventName('trip_created'));
    assert.ok(!isValidEventName('Trip Created'));
    assert.ok(!isValidEventName('x'));
  });
  test('propriétés : simples, coupées, au plus 8', () => {
    const out = sanitizeProps({ kind: 'place', count: 3, ok: true, nested: { a: 1 }, 'Bad Key': 1, long: 'x'.repeat(100) });
    assert.deepEqual(out, { kind: 'place', count: 3, ok: true, long: 'x'.repeat(40) });
    const many = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`k${i}`, i]));
    assert.equal(Object.keys(sanitizeProps(many)).length, 8);
  });
  test('écran sans identifiant ni groupe', () => {
    assert.equal(routeName(['trip', '[id]', 'envies']), '/trip/[id]/envies');
    assert.equal(routeName(['(tabs)']), '/');
    assert.equal(routeName(['(auth)', 'login']), '/login');
  });
  test('résumé d’erreur', () => {
    const e = new TypeError('boom');
    assert.equal(errorSummary(e).message, 'TypeError: boom');
    assert.equal(errorSummary('oups').message, 'oups');
  });
});
