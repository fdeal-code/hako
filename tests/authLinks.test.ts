import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseAuthRedirect } from '../utils/authLinks.ts';

describe('parseAuthRedirect', () => {
  test('jetons dans le fragment (mode implicite)', () => {
    const r = parseAuthRedirect('hako://reset-password#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=recovery');
    assert.equal(r.accessToken, 'abc');
    assert.equal(r.refreshToken, 'def');
    assert.equal(r.type, 'recovery');
    assert.equal(r.error, null);
  });
  test('code dans la requête (mode PKCE)', () => {
    const r = parseAuthRedirect('exp://192.168.1.2:8081/--/reset-password?code=xyz');
    assert.equal(r.code, 'xyz');
    assert.equal(r.accessToken, null);
  });
  test('lien expiré', () => {
    const r = parseAuthRedirect('hako://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    assert.equal(r.error, 'Email link is invalid or has expired');
  });
  test('rien dans le lien', () => {
    assert.deepEqual(parseAuthRedirect('hako://reset-password'), { accessToken: null, refreshToken: null, code: null, type: null, error: null });
  });
});
