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
