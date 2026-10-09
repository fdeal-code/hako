// HAKO — Hook boîte de réception : invitations, demandes d'amis et
// notifications in-app réunies (badge de la cloche + page Notifications).

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import {
  acceptFriendRequest,
  acceptInvitation,
  declineFriendRequest,
  declineInvitation,
  getFriendRequests,
  getPendingInvitations,
} from '@/services/inboxService';
import { FriendRequest, PendingInvitation } from '@/types/inbox';
import { AppNotification } from '@/types/notifications';
import { tripEvents } from '@/utils/events';

interface UseInboxResult {
  invitations: PendingInvitation[];
  friendRequests: FriendRequest[];
  notifications: AppNotification[];
  /** Pour le point rouge de la cloche. */
  badgeCount: number;
  refresh: () => void;
  markRead: (notificationId: string) => Promise<void>;
  acceptTripInvitation: (invitation: PendingInvitation) => Promise<string | null>;
  declineTripInvitation: (invitationId: string) => Promise<string | null>;
  acceptFriend: (requestId: string) => Promise<string | null>;
  declineFriend: (requestId: string) => Promise<string | null>;
}

export function useInbox(): UseInboxResult {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? null;
  const { notifications, unreadCount, markRead } = useNotifications();
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);

  const refresh = useCallback(() => {
    if (email) void getPendingInvitations(email).then(({ data }) => setInvitations(data ?? []));
    if (userId) void getFriendRequests(userId).then(({ data }) => setFriendRequests(data ?? []));
  }, [email, userId]);

  useFocusEffect(refresh);

  const acceptTripInvitation = useCallback(async (invitation: PendingInvitation) => {
    if (!userId) return 'Connecte-toi pour rejoindre ce voyage.';
    const { error } = await acceptInvitation(invitation, userId);
    if (error === null) { tripEvents.emit(); refresh(); }
    return error;
  }, [userId, refresh]);

  const declineTripInvitation = useCallback(async (invitationId: string) => {
    const { error } = await declineInvitation(invitationId);
    refresh();
    return error;
  }, [refresh]);

  const acceptFriend = useCallback(async (requestId: string) => {
    const { error } = await acceptFriendRequest(requestId);
    refresh();
    return error;
  }, [refresh]);

  const declineFriend = useCallback(async (requestId: string) => {
    const { error } = await declineFriendRequest(requestId);
    refresh();
    return error;
  }, [refresh]);

  return {
    invitations,
    friendRequests,
    notifications,
    badgeCount: invitations.length + friendRequests.length + unreadCount,
    refresh,
    markRead,
    acceptTripInvitation,
    declineTripInvitation,
    acceptFriend,
    declineFriend,
  };
}
