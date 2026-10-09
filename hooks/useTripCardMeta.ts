// HAKO — Infos légères d'une carte voyage (accueil) : avatars + envies à voter
// Une requête jointe au lieu d'une requête par membre (ancienne TripCard).

import { useEffect, useState } from 'react';

import { supabase } from '@/services/supabase';

export interface CardMember {
  user_id: string;
  nickname: string | null;
  avatar_url: string | null;
}

const MAX_AVATARS = 4;

export function useTripCardMeta(tripId: string, withVotes: boolean) {
  const [members, setMembers] = useState<CardMember[]>([]);
  const [toVoteCount, setToVoteCount] = useState(0);

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
    if (withVotes) {
      void supabase
        .from('wishes').select('id', { count: 'exact', head: true })
        .eq('trip_id', tripId).in('status', ['pending', 'debate']).or('type.is.null,type.neq.orga') // sans les tâches d'orga
        .then(({ count }) => { if (!cancelled) setToVoteCount(count ?? 0); });
    }
    return () => { cancelled = true; };
  }, [tripId, withVotes]);

  return { members, toVoteCount };
}
