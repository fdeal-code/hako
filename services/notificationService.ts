// HAKO — Service Notifications in-app
// Pattern service : ServiceResult<T> (voir tripService.ts). In-app
// uniquement — le push (expo-notifications) est un chantier dédié.

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { AppNotification, NotificationType } from '@/types/notifications';

const NOTIFICATIONS_LIMIT = 50;
const TYPE_MATCH_INVITE: NotificationType = 'match_invite';
const DEFAULT_NICKNAME = 'Un ami';

/** Mes notifications, plus récentes d'abord (RLS : chacun les siennes). */
export async function getMyNotifications(): Promise<ServiceResult<AppNotification[]>> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(NOTIFICATIONS_LIMIT);
  if (error) return serviceError(error.message);
  return { data: (data ?? []) as AppNotification[], error: null };
}

export async function markNotificationRead(
  notificationId: string,
): Promise<ServiceResult<true>> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}

/**
 * Notifie chaque participant invité à un match (type 'match_invite').
 * Best effort : appelé par tripMatchService.createMatch, un échec ne doit
 * pas invalider la création du match.
 */
export async function notifyMatchInvite(
  matchId: string,
  title: string,
  participantIds: string[],
  creatorId: string,
): Promise<ServiceResult<true>> {
  if (participantIds.length === 0) return { data: true, error: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', creatorId)
    .single();
  const creatorNickname =
    (profile as { nickname: string | null } | null)?.nickname ?? DEFAULT_NICKNAME;

  const { error } = await supabase.from('notifications').insert(
    participantIds.map(userId => ({
      user_id: userId,
      type: TYPE_MATCH_INVITE,
      payload: { match_id: matchId, title, creator_nickname: creatorNickname },
    })),
  );
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}
