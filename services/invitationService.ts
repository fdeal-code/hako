// HAKO — Service invitations d'un voyage (page « Inviter des amis »)
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';

export type InvitationStatus = 'pending' | 'accepted' | 'declined';
export interface TripInvitation { id: string; invited_email: string; status: InvitationStatus; created_at: string }

export interface InviteContext {
  tripName: string;
  memberIds: string[];
  invitations: TripInvitation[];
}

export async function getInviteContext(tripId: string): Promise<ServiceResult<InviteContext>> {
  const [trip, members, invitations] = await Promise.all([
    supabase.from('trips').select('name').eq('id', tripId).single(),
    supabase.from('trip_members').select('user_id').eq('trip_id', tripId),
    supabase.from('invitations').select('id, invited_email, status, created_at').eq('trip_id', tripId).order('created_at', { ascending: false }),
  ]);
  const failed = trip.error ?? members.error ?? invitations.error;
  if (failed) return serviceError(failed.message);
  return {
    data: {
      tripName: (trip.data as { name: string }).name,
      memberIds: ((members.data ?? []) as { user_id: string }[]).map(m => m.user_id),
      invitations: (invitations.data ?? []) as TripInvitation[],
    },
    error: null,
  };
}

export async function inviteByEmail(tripId: string, invitedBy: string, email: string): Promise<ServiceResult<TripInvitation>> {
  const { data, error } = await supabase
    .from('invitations')
    .insert({ trip_id: tripId, invited_by: invitedBy, invited_email: email.trim().toLowerCase(), status: 'pending' })
    .select('id, invited_email, status, created_at')
    .single();
  if (error) return serviceError(error.message);
  return { data: data as TripInvitation, error: null };
}

export async function cancelInvitation(invitationId: string): Promise<ServiceResult<true>> {
  const { error } = await supabase.from('invitations').delete().eq('id', invitationId);
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}
