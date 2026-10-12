import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { countUnvoted } from '../utils/wishVotes.ts';

describe('countUnvoted', () => {
  const wishes = [
    { status: 'pending', wish_votes: [] },
    { status: 'debate', wish_votes: [{ user_id: 'me' }, { user_id: 'ami' }] },
    { status: 'debate', wish_votes: [{ user_id: 'ami' }] },
    { status: 'validated', wish_votes: [] },
    { status: 'archived', wish_votes: null },
  ];
  test('seulement les envies ouvertes où je n’ai pas voté', () => {
    assert.equal(countUnvoted(wishes, 'me'), 2);
    assert.equal(countUnvoted(wishes, 'ami'), 1);
  });
  test('tout voté → 0', () => {
    assert.equal(countUnvoted([{ status: 'pending', wish_votes: [{ user_id: 'me' }] }], 'me'), 0);
  });
});
