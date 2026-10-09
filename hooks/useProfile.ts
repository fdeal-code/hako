// HAKO — Hook Profil (onglet Profil) : identité, stats, amis
// Rechargé à chaque retour sur l'onglet (modification, ajout d'ami).

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { Friend, getAcceptedFriends, removeFriend } from '@/services/friendService';
import { getProfileStats, ProfileStats } from '@/services/profileService';

export function useProfile() {
  const { session, signOut } = useAuth();
  const user = session?.user;
  const userId = user?.id ?? '';
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!userId) return;
    void Promise.all([getProfileStats(userId), getAcceptedFriends(userId)]).then(([s, f]) => {
      setStats(s.data);
      setFriends(f.data ?? []);
      setError(s.error ?? f.error);
    });
  }, [userId]);

  useFocusEffect(load);

  const unfriend = useCallback(async (friendId: string): Promise<string | null> => {
    const { error: err } = await removeFriend(userId, friendId);
    if (!err) setFriends(prev => (prev ?? []).filter(f => f.id !== friendId));
    return err;
  }, [userId]);

  const meta = (user?.user_metadata ?? {}) as { nickname?: string; avatar_url?: string };
  return {
    nickname: meta.nickname || 'Voyageur',
    avatarUrl: meta.avatar_url ?? null,
    email: user?.email ?? '',
    stats, friends, error, reload: load, unfriend, signOut,
  };
}
