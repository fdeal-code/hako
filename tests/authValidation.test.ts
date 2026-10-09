// HAKO — Tests de la connexion / inscription
// Lancer : npm run test:utils

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { authErrorMessage, isValidEmail, isValidNickname, passwordStrength } from '../utils/authValidation.ts';

describe('connexion / inscription', () => {
  it('vérifie l’e-mail', () => {
    assert.equal(isValidEmail('felix@hako.app'), true);
    assert.equal(isValidEmail(' felix@hako.app '), true);
    assert.equal(isValidEmail('felix@hako'), false);
    assert.equal(isValidEmail('felix hako.app'), false);
  });

  it('évalue le mot de passe', () => {
    assert.equal(passwordStrength('abc'), 'faible');
    assert.equal(passwordStrength('abcdefg'), 'moyen');
    assert.equal(passwordStrength('voyage2026'), 'fort');
  });

  it('vérifie le pseudo', () => {
    assert.equal(isValidNickname('F'), false);
    assert.equal(isValidNickname('Fel'), true);
  });

  it('traduit les erreurs', () => {
    assert.equal(authErrorMessage('Invalid login credentials'), 'E-mail ou mot de passe incorrect.');
    assert.equal(authErrorMessage('User already registered'), 'Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.');
    assert.equal(authErrorMessage('Autre chose'), 'Autre chose');
  });
});
