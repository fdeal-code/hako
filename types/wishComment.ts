// HAKO — Commentaire sur une envie (table wish_comments)

export interface WishComment {
  id: string;
  wish_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author: { nickname: string | null; avatar_url: string | null } | null;
}
