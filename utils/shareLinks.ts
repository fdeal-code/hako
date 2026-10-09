// HAKO — Liens de partage / deep links
// (Aucun utilitaire d'invitation par lien n'existait : les invitations de
// trips passent par la table `invitations`. Celui-ci devient la référence.)

import * as Linking from 'expo-linking';

const WHATSAPP_SHARE_URL = 'https://wa.me/';

/** Deep link vers le questionnaire d'un match (scheme `hako` défini dans app.json). */
export function buildMatchDeepLink(matchId: string): string {
  return Linking.createURL(`/match/${matchId}/questionnaire`);
}

/** Message d'invitation à rejoindre un match (Share natif à la création). */
export function buildMatchInviteMessage(matchId: string, title: string): string {
  return [
    `Rejoins notre Trip Match « ${title} » ! 🎯`,
    'Chacun répond à 6 questions, l’IA propose 3 destinations, on vote :',
    buildMatchDeepLink(matchId),
  ].join('\n');
}

/** Lien WhatsApp avec message de relance pré-rempli. */
export function buildMatchWhatsAppReminderUrl(matchId: string): string {
  const message = [
    'On attend plus que toi pour le Trip Match ! 🎯',
    'Réponds au questionnaire (2 min chrono) et on découvre où on part :',
    buildMatchDeepLink(matchId),
  ].join('\n');
  return `${WHATSAPP_SHARE_URL}?text=${encodeURIComponent(message)}`;
}

/** Relance WhatsApp pour une envie qui attend des votes. */
export function buildWishVoteReminderUrl(wishTitle: string, pendingNames: readonly string[]): string {
  const who = pendingNames.length > 0 ? `${pendingNames.join(', ')}, ` : '';
  const message = `${who}on n’attend plus que ton vote sur « ${wishTitle} » dans Hako 🗳️`;
  return `${WHATSAPP_SHARE_URL}?text=${encodeURIComponent(message)}`;
}

/** Deep link vers l'écran d'invitation d'un voyage. */
export function buildTripInviteLink(token: string): string {
  return Linking.createURL(`/join/${token}`);
}

/** Message d'invitation partagé (WhatsApp via la feuille de partage native). */
export function buildTripInviteMessage(token: string, tripName: string): string {
  return [
    `Rejoins « ${tripName} » sur Hako ✈️`,
    'Envies, votes, planning, budget : tout est dans la boîte.',
    buildTripInviteLink(token),
  ].join('\n');
}
