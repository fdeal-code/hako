import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { storagePath } from '../utils/storagePath.ts';

describe('storagePath', () => {
  test('chemin déjà stocké', () => {
    assert.equal(storagePath('trip-1/billet.pdf', 'documents'), 'trip-1/billet.pdf');
    assert.equal(storagePath('/trip-1/billet.pdf', 'documents'), 'trip-1/billet.pdf');
  });
  test('ancienne URL publique ou signée', () => {
    assert.equal(storagePath('https://x.supabase.co/storage/v1/object/public/documents/trip-1/a%20b.pdf', 'documents'), 'trip-1/a b.pdf');
    assert.equal(storagePath('https://x.supabase.co/storage/v1/object/sign/documents/trip-1/a.pdf?token=abc', 'documents'), 'trip-1/a.pdf');
  });
  test('URL externe ou autre bucket → null', () => {
    assert.equal(storagePath('https://example.com/billet.pdf', 'documents'), null);
    assert.equal(storagePath('https://x.supabase.co/storage/v1/object/public/covers/a.jpg', 'documents'), null);
    assert.equal(storagePath('  ', 'documents'), null);
  });
});
