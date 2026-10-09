import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_WISH_FILTERS, activeFilterCount, compareWishes, matchesWishFilters, toggleValue,
} from '../utils/wishFilters.ts';
import type { FilterableWish } from '../utils/wishFilters.ts';

const wish = (o: Partial<FilterableWish>): FilterableWish => ({ created_at: '2026-10-01T10:00:00Z', upVotes: 0, ...o });

describe('toggleValue', () => {
  test('ajoute puis retire', () => {
    assert.deepEqual(toggleValue([], 'bar'), ['bar']);
    assert.deepEqual(toggleValue(['bar', 'cafe'], 'bar'), ['cafe']);
  });
});

describe('activeFilterCount', () => {
  test('défaut = 0, tri non défaut compte', () => {
    assert.equal(activeFilterCount(DEFAULT_WISH_FILTERS), 0);
    assert.equal(activeFilterCount({ ...DEFAULT_WISH_FILTERS, vibes: ['chill'], sort: 'oldest' }), 2);
  });
});

describe('matchesWishFilters', () => {
  test('sans filtre, tout passe', () => {
    assert.ok(matchesWishFilters(wish({}), DEFAULT_WISH_FILTERS));
  });
  test('type par défaut = inspiration', () => {
    assert.ok(matchesWishFilters(wish({ type: null }), { ...DEFAULT_WISH_FILTERS, types: ['inspiration'] }));
    assert.ok(!matchesWishFilters(wish({ type: 'orga' }), { ...DEFAULT_WISH_FILTERS, types: ['place'] }));
  });
  test('catégorie absente exclue quand on filtre', () => {
    assert.ok(!matchesWishFilters(wish({}), { ...DEFAULT_WISH_FILTERS, categories: ['bar'] }));
    assert.ok(matchesWishFilters(wish({ category: 'bar' }), { ...DEFAULT_WISH_FILTERS, categories: ['bar', 'cafe'] }));
  });
  test('ambiance : au moins une en commun', () => {
    const f = { ...DEFAULT_WISH_FILTERS, vibes: ['foodie'] };
    assert.ok(matchesWishFilters(wish({ vibes: ['chill', 'foodie'] }), f));
    assert.ok(!matchesWishFilters(wish({ vibes: ['chill'] }), f));
    assert.ok(!matchesWishFilters(wish({ vibes: null }), f));
  });
});

describe('compareWishes', () => {
  const old = wish({ created_at: '2026-09-01T00:00:00Z', upVotes: 5 });
  const recent = wish({ created_at: '2026-10-01T00:00:00Z', upVotes: 1 });
  test('récent / ancien / plus voté', () => {
    assert.deepEqual([old, recent].sort((a, b) => compareWishes(a, b, 'recent')), [recent, old]);
    assert.deepEqual([recent, old].sort((a, b) => compareWishes(a, b, 'oldest')), [old, recent]);
    assert.deepEqual([recent, old].sort((a, b) => compareWishes(a, b, 'most_voted')), [old, recent]);
  });
});
