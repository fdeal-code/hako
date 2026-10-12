// HAKO — Service Connexion / inscription
// Le profil est créé côté base par un trigger à l'inscription (voir la
// migration rls_core_tables) ; on le complète ici (avatar) quand une session
// existe déjà. Pattern service : ServiceResult<T> (voir tripService.ts).

import * as Linking from 'expo-linking';

import { supabase } from '@/services/supabase';
import { fileExtension, uploadLocalFile } from '@/services/storageService';
import { serviceError, ServiceResult } from '@/services/tripService';
import { parseAuthRedirect } from '@/utils/authLinks';
import { authErrorMessage } from '@/utils/authValidation';

export async function signInWithEmail(email: string, password: string): Promise<ServiceResult<true>> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) return serviceError(authErrorMessage(error.message));
  return { data: true, error: null };
}

export interface SignUpInput { email: string; password: string; nickname: string; photoUri: string | null }

/** Crée le compte. needsConfirmation = l'e-mail doit être confirmé avant de se connecter. */
export async function signUpAccount(input: SignUpInput): Promise<ServiceResult<{ needsConfirmation: boolean }>> {
  const email = input.email.trim().toLowerCase();
  const nickname = input.nickname.trim();
  const { data, error } = await supabase.auth.signUp({ email, password: input.password, options: { data: { nickname } } });
  if (error) return serviceError(authErrorMessage(error.message));
  const user = data.user;
  if (!data.session || !user) return { data: { needsConfirmation: true }, error: null };

  // Session ouverte : on complète le profil (photo) — sans bloquer l'inscription en cas d'échec
  let avatarUrl: string | null = null;
  if (input.photoUri) {
    const { data: url } = await uploadLocalFile('avatars', `${user.id}/profile.${fileExtension(input.photoUri)}`, input.photoUri);
    avatarUrl = url;
    if (url) await supabase.auth.updateUser({ data: { avatar_url: url } });
  }
  await supabase.from('profiles').upsert({ id: user.id, email, nickname, avatar_url: avatarUrl });
  return { data: { needsConfirmation: false }, error: null };
}

/** Page de l'app ouverte par le lien de l'e-mail (hako://reset-password). */
export const RESET_PASSWORD_PATH = '/reset-password';

export async function sendPasswordReset(email: string): Promise<ServiceResult<true>> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: Linking.createURL(RESET_PASSWORD_PATH),
  });
  if (error) return serviceError(authErrorMessage(error.message));
  return { data: true, error: null };
}

/** Ouvre la session de récupération à partir du lien reçu par e-mail. */
export async function startRecoverySession(url: string): Promise<ServiceResult<true>> {
  const link = parseAuthRedirect(url);
  if (link.error) return serviceError('Ce lien a expiré ou a déjà servi. Redemande un e-mail depuis l’écran de connexion.');
  if (link.accessToken && link.refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
    if (error) return serviceError(authErrorMessage(error.message));
    return { data: true, error: null };
  }
  if (link.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(link.code);
    if (error) return serviceError(authErrorMessage(error.message));
    return { data: true, error: null };
  }
  return serviceError('Lien incomplet. Ouvre le lien reçu par e-mail depuis ce téléphone.');
}

export async function updatePassword(password: string): Promise<ServiceResult<true>> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return serviceError(authErrorMessage(error.message));
  return { data: true, error: null };
}
