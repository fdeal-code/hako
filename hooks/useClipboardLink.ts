// HAKO — Lien copié dans le presse-papier (bandeau « Lien TikTok copié → Coller »)
// Vérifié au montage et au retour dans l'app (ex. après avoir copié un lien
// dans TikTok). Sur iOS, le contenu n'est lu qu'au tap sur « Coller » (sinon
// iOS affiche son alerte de collage) : on sait seulement qu'un lien existe.

import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { extractUrl } from '@/utils/wishLinks';

export interface ClipboardLink {
  url: string | null; // null sur iOS tant que l'utilisateur n'a pas collé
}

async function readClipboard(): Promise<ClipboardLink | null> {
  try {
    if (Platform.OS === 'ios') return (await Clipboard.hasUrlAsync()) ? { url: null } : null;
    const url = extractUrl(await Clipboard.getStringAsync());
    return url ? { url } : null;
  } catch {
    return null;
  }
}

export function useClipboardLink() {
  const [clipboard, setClipboard] = useState<ClipboardLink | null>(null);

  useEffect(() => {
    const refresh = () => { void readClipboard().then(setClipboard); };
    refresh();
    const sub = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => sub.remove();
  }, []);

  /** Lit le lien (déclenche l'alerte de collage iOS). null si rien d'exploitable. */
  const readLink = useCallback(async (): Promise<string | null> => {
    try {
      const url = extractUrl(clipboard?.url ?? await Clipboard.getStringAsync());
      if (!url) setClipboard(null);
      return url;
    } catch {
      setClipboard(null);
      return null;
    }
  }, [clipboard]);

  return { clipboard, readLink };
}
