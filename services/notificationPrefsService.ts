// HAKO — Service préférences de notifications
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { NotificationCategory, NotificationMode, NotificationPref } from '@/types/notificationPrefs';

const TABLE = 'notification_prefs';

export async function getMyNotificationPrefs(): Promise<ServiceResult<NotificationPref[]>> {
  const { data, error } = await supabase.from(TABLE).select('user_id, category, mode');
  if (error) return serviceError(error.message);
  return { data: (data ?? []) as NotificationPref[], error: null };
}

export async function setNotificationPref(
  userId: string,
  category: NotificationCategory,
  mode: NotificationMode,
): Promise<ServiceResult<true>> {
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, category, mode, updated_at: new Date().toISOString() }, { onConflict: 'user_id,category' });
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}
