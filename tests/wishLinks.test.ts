// HAKO — Tests de l'ajout d'envie (liens, légendes, ambiances)
// Lancer : npm run test:utils

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  captionToQuery, categoryFromTypes, detectLinkSource, distanceKm, extractUrl,
  formatStopRange, shortUrl, suggestVibes,
} from '../utils/wishLinks.ts';

describe('liens collés', () => {
  it('extrait le lien d’un texte partagé', () => {
    assert.equal(extractUrl('Regarde ça https://vm.tiktok.com/ZM8xK2/ !'), 'https://vm.tiktok.com/ZM8xK2/');
    assert.equal(extractUrl('(https://youtu.be/abc).'), 'https://youtu.be/abc');
    assert.equal(extractUrl('pas de lien ici'), null);
  });

  it('reconnaît la source', () => {
    assert.equal(detectLinkSource('https://www.tiktok.com/@a/video/1'), 'tiktok');
    assert.equal(detectLinkSource('https://www.instagram.com/reel/xyz'), 'instagram');
    assert.equal(detectLinkSource('https://youtu.be/abc'), 'youtube');
    assert.equal(detectLinkSource('https://example.com'), 'other');
  });

  it('raccourcit le lien pour le bandeau', () => {
    assert.equal(shortUrl('https://www.tiktok.com/@dolomites.wild/video/123', 12), 'tiktok.com/@…');
    assert.equal(shortUrl('https://vm.tiktok.com/Z'), 'vm.tiktok.com/Z');
  });
});

describe('légende → lieu', () => {
  it('garde les mots des hashtags, retire mentions, liens et emojis', () => {
    assert.equal(
      captionToQuery('POV : le lac de Braies 🌅 #lagodibraies @dolomites.wild https://t.co/x'),
      'POV le lac de Braies lagodibraies',
    );
  });

  it('déduit catégorie et ambiances des types Google', () => {
    assert.equal(categoryFromTypes(['natural_feature', 'establishment']), 'monument');
    assert.equal(categoryFromTypes(['restaurant', 'food']), 'restaurant');
    assert.equal(categoryFromTypes(['locality']), null);
    assert.deepEqual(suggestVibes(['natural_feature'], true), ['nature', 'insta']);
    assert.deepEqual(suggestVibes(['bar'], false), ['fete']);
  });

  it('mesure la distance à une étape', () => {
    const romeFlorence = distanceKm(41.9028, 12.4964, 43.7696, 11.2558);
    assert.ok(romeFlorence > 220 && romeFlorence < 240);
  });
});

describe('libellé d’étape', () => {
  it('formate les dates d’une étape', () => {
    assert.equal(formatStopRange('2026-06-07', '2026-06-09'), '07 → 09 juin');
    assert.equal(formatStopRange('2026-05-30', '2026-06-02'), '30 mai → 02 juin');
  });
});
