// HAKO — Liens système entrants (expo-router)
// Le menu Partager (TikTok, Instagram, Safari…) rouvre l'app avec un lien
// interne « hako://dataUrl=<clé>… » : on l'envoie vers l'écran de partage.
// Les autres liens (invitations « /join/<token> »…) passent tels quels.

import { getShareExtensionKey } from 'expo-share-intent';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) return '/share';
    return path;
  } catch {
    return '/';
  }
}
