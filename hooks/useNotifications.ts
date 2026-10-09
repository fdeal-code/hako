// HAKO — Hook notifications in-app (liste + badge non-lues, temps réel)

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/services/supabase';
import { getMyNotifications, markNotificationRead } from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import { AppNotification } from '@/types/notifications';

const CHANNEL_PREFIX = 'notifications';

interface UseNotificationsResult {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: serviceError } = await getMyNotifications();
    if (serviceError !== null) {
      setError(serviceError);
    } else {
      setNotifications(data);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  /* Realtime : badge et liste à jour dès l'insertion */
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`${CHANNEL_PREFIX}-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => { void refresh(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, refresh]);

  const markRead = useCallback(async (notificationId: string) => {
    await markNotificationRead(notificationId);
    void refresh();
  }, [refresh]);

  return {
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
    loading,
    error,
    refresh,
    markRead,
  };
}
