// HAKO — Service boîte de réception (invitations de voyage, demandes d'amis)
// Logique extraite de PendingInvitationsSheet / écran d'accueil.
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { FriendRequest, PendingInvitation } from '@/types/inbox';
import { track } from '@/services/telemetryService';

export async function getPendingInvitations(email: string): Promise<ServiceResult<PendingInvitation[]>> {
  const { data, error } = await supabase
    .from('invitations')
    .select('*, trips(name, destination, cover_image_url, start_date, end_date)')
    .eq('invited_email', email.toLowerCase())
    .eq('status', 'pending');
  if (error) return serviceError(error.message);
  return { data: (data ?? []) as PendingInvitation[], error: null };
}

export async function acceptInvitation(invitation: PendingInvitation, userId: string): Promise<ServiceResult<true>> {
  const { error: updateError } = await supabase
    .from('invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invitation.id);
  if (updateError) return serviceError(updateError.message);
  const { error } = await supabase
    .from('trip_members')
    .insert({ trip_id: invitation.trip_id, user_id: userId, role: 'member' });
  if (error) return serviceError(error.message);
  track('trip_joined', { via: 'invitation' }, invitation.trip_id);
  return { data: true, error: null };
}

export async function declineInvitation(invitationId: string): Promise<ServiceResult<true>> {
  const { error } = await supabase.from('invitations').update({ status: 'declined' }).eq('id', invitationId);
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}

export async function getFriendRequests(userId: string): Promise<ServiceResult<FriendRequest[]>> {
  const { data: requests, error } = await supabase
    .from('friendships')
    .select('id, requester_id')
    .eq('addressee_id', userId)
    .eq('status', 'pending');
  if (error) return serviceError(error.message);
  const rows = (requests ?? []) as { id: string; requester_id: string }[];
  if (rows.length === 0) return { data: [], error: null };

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url, email')
    .in('id', rows.map(r => r.requester_id));
  if (profileError) return serviceError(profileError.message);
  const byId = new Map(((profiles ?? []) as NonNullable<FriendRequest['requester']>[]).map(p => [p.id, p]));
  return {
    data: rows.map(r => ({ id: r.id, requester_id: r.requester_id, requester: byId.get(r.requester_id) ?? null })),
    error: null,
  };
}

export async function acceptFriendRequest(requestId: string): Promise<ServiceResult<true>> {
  const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', requestId);
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}

export async function declineFriendRequest(requestId: string): Promise<ServiceResult<true>> {
  const { error } = await supabase.from('friendships').delete().eq('id', requestId);
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}
