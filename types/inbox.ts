// HAKO — Boîte de réception : invitations de voyage + demandes d'amis

export interface PendingInvitation {
  id: string;
  trip_id: string;
  invited_by: string;
  trips: {
    name: string;
    destination: string;
    cover_image_url?: string | null;
    start_date: string;
    end_date: string;
  };
}

export interface FriendRequest {
  id: string;
  requester_id: string;
  requester: {
    id: string;
    nickname: string | null;
    avatar_url: string | null;
    email: string | null;
  } | null;
}
