-- HAKO — Plusieurs photos par envie (annonces de logement lues depuis le lien)
-- image_url reste la photo principale (cartes de vote) ; photos garde la
-- galerie proposée par l'annonce, 8 au maximum.
alter table public.wishes add column if not exists photos text[] not null default '{}';
alter table public.wishes drop constraint if exists wishes_photos_max;
alter table public.wishes add constraint wishes_photos_max check (coalesce(array_length(photos, 1), 0) <= 8);
