// HAKO — Hook préférences de notifications

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { getMyNotificationPrefs, setNotificationPref } from '@/services/notificationPrefsService';
import { NOTIFICATION_CATEGORIES, NotificationCategory, NotificationMode } from '@/types/notificationPrefs';

interface UseNotificationPrefsResult {
  modeOf: (category: NotificationCategory) => NotificationMode;
  isEnabled: (category: NotificationCategory) => boolean;
  toggle: (category: NotificationCategory) => Promise<string | null>;
  loading: boolean;
}

export function useNotificationPrefs(): UseNotificationPrefsResult {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [modes, setModes] = useState<Partial<Record<NotificationCategory, NotificationMode>>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await getMyNotificationPrefs();
    if (data) setModes(Object.fromEntries(data.map(p => [p.category, p.mode])));
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const modeOf = useCallback((category: NotificationCategory): NotificationMode => {
    const def = NOTIFICATION_CATEGORIES.find(c => c.category === category);
    return modes[category] ?? def?.defaultMode ?? 'instant';
  }, [modes]);

  const isEnabled = useCallback((category: NotificationCategory) => modeOf(category) !== 'off', [modeOf]);

  const toggle = useCallback(async (category: NotificationCategory) => {
    if (!userId) return 'Connecte-toi pour modifier tes préférences.';
    const def = NOTIFICATION_CATEGORIES.find(c => c.category === category);
    const next: NotificationMode = isEnabled(category) ? 'off' : def?.onMode ?? 'instant';
    setModes(prev => ({ ...prev, [category]: next })); // optimiste
    const { error } = await setNotificationPref(userId, category, next);
    if (error !== null) void refresh();
    return error;
  }, [userId, isEnabled, refresh]);

  return { modeOf, isEnabled, toggle, loading };
}
