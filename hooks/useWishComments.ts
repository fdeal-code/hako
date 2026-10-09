// HAKO — Hook Commentaires d'une envie : chargement, envoi, suppression
// des siens, et mise à jour en direct quand un membre commente.

import { useCallback, useEffect, useState } from 'react';

import { addWishComment, deleteWishComment, listWishComments } from '@/services/wishCommentService';
import { supabase } from '@/services/supabase';
import { WishComment } from '@/types/wishComment';

const CHANNEL_PREFIX = 'wish-comments';

export function useWishComments(wishId: string | null, userId: string | null) {
  const [comments, setComments] = useState<WishComment[]>([]);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(() => {
    if (!wishId) return;
    void listWishComments(wishId).then(({ data, error }) => {
      if (error !== null) console.log('[COMMENTAIRES] chargement', error);
      if (data) setComments(data);
    });
  }, [wishId]);

  useEffect(() => {
    if (!wishId) return;
    void listWishComments(wishId).then(({ data }) => setComments(data ?? []));
    const channel = supabase
      .channel(`${CHANNEL_PREFIX}-${wishId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wish_comments', filter: `wish_id=eq.${wishId}` }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [wishId, refresh]);

  /** Envoie un commentaire ; renvoie un message d'erreur, ou null. */
  const send = useCallback(async (content: string): Promise<string | null> => {
    if (!wishId || !userId) return 'Connecte-toi pour commenter.';
    setSending(true);
    const { data, error } = await addWishComment(wishId, userId, content);
    setSending(false);
    if (error !== null) return error;
    setComments(prev => (prev.some(c => c.id === data.id) ? prev : [...prev, data]));
    return null;
  }, [wishId, userId]);

  const remove = useCallback(async (commentId: string): Promise<string | null> => {
    setComments(prev => prev.filter(c => c.id !== commentId));
    const { error } = await deleteWishComment(commentId);
    if (error !== null) refresh();
    return error;
  }, [refresh]);

  return { comments, sending, send, remove };
}
