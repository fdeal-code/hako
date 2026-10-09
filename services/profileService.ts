// HAKO — Service profil (stats, modification du pseudo et de la photo)
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { fileExtension, uploadLocalFile } from '@/services/storageService';
import { serviceError, ServiceResult } from '@/services/tripService';

export interface ProfileStats { trips: number; wishes: number; pendingRequests: number }

export async function getProfileStats(userId: string): Promise<ServiceResult<ProfileStats>> {
  const [trips, wishes, requests] = await Promise.all([
    supabase.from('trip_members').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('wishes').select('*', { count: 'exact', head: true }).eq('added_by', userId),
    supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('addressee_id', userId).eq('status', 'pending'),
  ]);
  const failed = trips.error ?? wishes.error ?? requests.error;
  if (failed) return serviceError(failed.message);
  return { data: { trips: trips.count ?? 0, wishes: wishes.count ?? 0, pendingRequests: requests.count ?? 0 }, error: null };
}

export interface ProfileUpdate { userId: string; email: string; nickname: string; photoUri: string | null; currentAvatar: string | null }

/** Enregistre pseudo + photo (envoyée dans avatars/<uid>/). Renvoie l'URL de l'avatar. */
export async function updateProfile(input: ProfileUpdate): Promise<ServiceResult<string | null>> {
  let avatarUrl = input.currentAvatar;
  if (input.photoUri) {
    const { data: url, error } = await uploadLocalFile('avatars', `${input.userId}/profile.${fileExtension(input.photoUri)}`, input.photoUri);
    if (error !== null) return serviceError(error);
    avatarUrl = `${url}?t=${Date.now()}`; // casse le cache de l'ancienne photo
  }
  const nickname = input.nickname.trim();
  const { error: authError } = await supabase.auth.updateUser({ data: { nickname, avatar_url: avatarUrl } });
  if (authError) return serviceError(authError.message);
  const { error } = await supabase.from('profiles').upsert({ id: input.userId, email: input.email, nickname, avatar_url: avatarUrl }, { onConflict: 'id' });
  if (error) return serviceError(error.message);
  return { data: avatarUrl, error: null };
}
