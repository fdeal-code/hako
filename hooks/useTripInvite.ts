// HAKO — Hook « Inviter des amis » (app/trip/[id]/invite.tsx)
// Lien d'invitation (WhatsApp…), amis en un tap, invitation par e-mail,
// suivi des invitations envoyées.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Share } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { Friend, getAcceptedFriends } from '@/services/friendService';
import { cancelInvitation, getInviteContext, inviteByEmail, TripInvitation } from '@/services/invitationService';
import { getOrCreateInviteToken } from '@/services/inviteLinkService';
import { track } from '@/services/telemetryService';
import { isValidEmail } from '@/utils/authValidation';
import { buildTripInviteMessage } from '@/utils/shareLinks';

export type FriendInviteState = 'member' | 'invited' | 'available';
export type EmailIssue = 'invalid' | 'self' | 'already';

export function useTripInvite(tripId: string) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? '';
  const myEmail = (session?.user?.email ?? '').toLowerCase();

  const [tripName, setTripName] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [invitations, setInvitations] = useState<TripInvitation[] | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [email, setEmail] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null); // 'link', 'email' ou id d'ami
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId || !userId) return;
    void Promise.all([getInviteContext(tripId), getAcceptedFriends(userId)]).then(([ctx, fr]) => {
      if (ctx.data) {
        setTripName(ctx.data.tripName);
        setMemberIds(ctx.data.memberIds);
        setInvitations(ctx.data.invitations);
      } else setInvitations([]);
      setFriends(fr.data ?? []);
      setError(ctx.error ?? fr.error);
    });
  }, [tripId, userId]);

  const invitedEmails = useMemo(
    () => new Set((invitations ?? []).filter(i => i.status !== 'declined').map(i => i.invited_email.toLowerCase())),
    [invitations],
  );

  const friendState = useCallback((f: Friend): FriendInviteState => {
    if (memberIds.includes(f.id)) return 'member';
    if (f.email && invitedEmails.has(f.email.toLowerCase())) return 'invited';
    return 'available';
  }, [memberIds, invitedEmails]);

  // Amis à inviter d'abord, puis invités, puis déjà membres
  const sortedFriends = useMemo(() => {
    const rank: Record<FriendInviteState, number> = { available: 0, invited: 1, member: 2 };
    return [...friends].sort((a, b) => rank[friendState(a)] - rank[friendState(b)]);
  }, [friends, friendState]);

  const invite = useCallback(async (target: string, key: string): Promise<boolean> => {
    setError(null);
    setBusyId(key);
    const { data, error: err } = await inviteByEmail(tripId, userId, target);
    setBusyId(null);
    if (err !== null) { setError(err); return false; }
    setInvitations(prev => [data, ...(prev ?? [])]);
    return true;
  }, [tripId, userId]);

  const inviteFriend = useCallback((f: Friend) => { if (f.email) void invite(f.email, f.id); }, [invite]);

  const emailIssue = ((): EmailIssue | null => {
    const cleaned = email.trim().toLowerCase();
    if (!cleaned) return null;
    if (!isValidEmail(cleaned)) return 'invalid';
    if (cleaned === myEmail) return 'self';
    if (invitedEmails.has(cleaned)) return 'already';
    return null;
  })();

  const inviteEmail = useCallback(async () => {
    if (emailIssue || !email.trim()) return;
    if (await invite(email, 'email')) setEmail('');
  }, [emailIssue, email, invite]);

  const cancel = useCallback(async (inv: TripInvitation) => {
    setBusyId(inv.id);
    const { error: err } = await cancelInvitation(inv.id);
    setBusyId(null);
    if (err !== null) { setError(err); return; }
    setInvitations(prev => (prev ?? []).filter(i => i.id !== inv.id));
  }, []);

  const shareLink = useCallback(async () => {
    setError(null);
    setBusyId('link');
    const { data: token, error: err } = await getOrCreateInviteToken(tripId, userId);
    setBusyId(null);
    if (err !== null) { setError(err); return; }
    track('invite_link_shared', { from: 'invite' }, tripId);
    await Share.share({ message: buildTripInviteMessage(token, tripName || 'notre voyage') });
  }, [tripId, userId, tripName]);

  return {
    tripName, memberCount: memberIds.length, invitations, friends: sortedFriends, friendState,
    email, setEmail, emailIssue, inviteEmail, inviteFriend, cancel, shareLink, busyId, error,
  };
}
