// HAKO — Lien d'invitation : aperçu d'un voyage avant de le rejoindre

export interface InvitePreview {
  trip_id: string;
  name: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  budget_per_person: number | null;
  inviter: string;
  member_count: number;
  member_names: string[];
  wish_count: number;
  already_member: boolean;
}
