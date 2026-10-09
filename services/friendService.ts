// HAKO — Service amis
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';

export interface Friend {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  email: string | null;
}

const STATUS_ACCEPTED = 'accepted';

/** Amis acceptés (dans les deux sens de la demande). */
export async function getAcceptedFriends(userId: string): Promise<ServiceResult<Friend[]>> {
  const [sent, received] = await Promise.all([
    supabase.from('friendships').select('addressee_id').eq('requester_id', userId).eq('status', STATUS_ACCEPTED),
    supabase.from('friendships').select('requester_id').eq('addressee_id', userId).eq('status', STATUS_ACCEPTED),
  ]);
  if (sent.error) return serviceError(sent.error.message);
  if (received.error) return serviceError(received.error.message);

  const ids = [
    ...((sent.data ?? []) as { addressee_id: string }[]).map(f => f.addressee_id),
    ...((received.data ?? []) as { requester_id: string }[]).map(f => f.requester_id),
  ];
  if (ids.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url, email')
    .in('id', ids);
  if (error) return serviceError(error.message);
  return { data: (data ?? []) as Friend[], error: null };
}

export type FriendLink = 'none' | 'pending' | 'accepted';
export interface FoundProfile extends Friend { link: FriendLink }

/** Cherche un utilisateur par e-mail, avec l'état de la relation. null = introuvable. */
export async function findProfileByEmail(userId: string, email: string): Promise<ServiceResult<FoundProfile | null>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url, email')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  if (error) return serviceError(error.message);
  if (!data) return { data: null, error: null };
  const profile = data as Friend;

  const { data: links, error: linkError } = await supabase
    .from('friendships')
    .select('status')
    .or(`and(requester_id.eq.${userId},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${userId})`);
  if (linkError) return serviceError(linkError.message);
  const statuses = ((links ?? []) as { status: string }[]).map(l => l.status);
  const link: FriendLink = statuses.includes(STATUS_ACCEPTED) ? 'accepted' : statuses.length > 0 ? 'pending' : 'none';
  return { data: { ...profile, link }, error: null };
}

export async function sendFriendRequest(userId: string, friendId: string): Promise<ServiceResult<true>> {
  const { error } = await supabase.from('friendships').insert({ requester_id: userId, addressee_id: friendId, status: 'pending' });
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}

/** Retire un ami (supprime la relation, quel que soit le sens). */
export async function removeFriend(userId: string, friendId: string): Promise<ServiceResult<true>> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(`and(requester_id.eq.${userId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${userId})`);
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}
