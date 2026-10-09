// HAKO — Service Commentaires d'envie
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { WishComment } from '@/types/wishComment';

const FIELDS = 'id, wish_id, user_id, content, created_at, author:profiles(nickname, avatar_url)';
const MAX_LENGTH = 1000;

export async function listWishComments(wishId: string): Promise<ServiceResult<WishComment[]>> {
  const { data, error } = await supabase.from('wish_comments').select(FIELDS)
    .eq('wish_id', wishId).order('created_at', { ascending: true });
  if (error) return serviceError(error.message);
  return { data: (data ?? []) as unknown as WishComment[], error: null };
}

export async function addWishComment(wishId: string, userId: string, content: string): Promise<ServiceResult<WishComment>> {
  const text = content.trim().slice(0, MAX_LENGTH);
  if (!text) return serviceError('Le commentaire est vide.');
  const { data, error } = await supabase.from('wish_comments')
    .insert({ wish_id: wishId, user_id: userId, content: text }).select(FIELDS).single();
  if (error) return serviceError(error.message);
  return { data: data as unknown as WishComment, error: null };
}

export async function deleteWishComment(commentId: string): Promise<ServiceResult<true>> {
  const { error } = await supabase.from('wish_comments').delete().eq('id', commentId);
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}
