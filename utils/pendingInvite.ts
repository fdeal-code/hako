// HAKO — Invitation en attente pendant la connexion
// Un invité arrive par /join/[token] sans compte : on garde le token le
// temps du login, puis l'AuthGate le ramène sur l'écran d'invitation.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'hako.pendingInviteToken';

export async function savePendingInvite(token: string): Promise<void> {
  try { await AsyncStorage.setItem(KEY, token); } catch { /* stockage indisponible : l'invité repassera par le lien */ }
}

export async function takePendingInvite(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(KEY);
    if (token) await AsyncStorage.removeItem(KEY);
    return token;
  } catch {
    return null;
  }
}
