// HAKO — Infos légères d'une carte voyage (accueil) : avatars + envies à voter
// Une requête jointe au lieu d'une requête par membre (ancienne TripCard).
// « À voter » = les envies où MOI je n'ai pas encore voté ; rechargé au
// retour sur l'accueil (après un vote).

import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { countWishesToVote } from '@/services/wishService';
import { tripEvents } from '@/utils/events';

export interface CardMember {
  user_id: string;
  nickname: string | null;
  avatar_url: string | null;
}

const MAX_AVATARS = 4;

export function useTripCardMeta(tripId: string, withVotes: boolean) {
  const [members, setMembers] = useState<CardMember[]>([]);
  const [toVoteCount, setToVoteCount] = useState(0);
  const { session } = useAuth();
  const userId = session?.user?.id ?? '';

  const loadVotes = useCallback(() => {
    if (!withVotes || !userId) return;
    void countWishesToVote(tripId, userId).then(({ data }) => { if (data !== null) setToVoteCount(data); });
  }, [tripId, userId, withVotes]);
  useFocusEffect(loadVotes);
  useEffect(() => tripEvents.subscribe(loadVotes), [loadVotes]);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from('trip_members')
      .select('user_id, profile:profiles(nickname, avatar_url)')
      .eq('trip_id', tripId)
      .limit(MAX_AVATARS)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []) as unknown as { user_id: string; profile: { nickname: string | null; avatar_url: string | null } | null }[];
        setMembers(rows.map(r => ({ user_id: r.user_id, nickname: r.profile?.nickname ?? null, avatar_url: r.profile?.avatar_url ?? null })));
      });
    return () => { cancelled = true; };
  }, [tripId]);

  return { members, toVoteCount };
}
