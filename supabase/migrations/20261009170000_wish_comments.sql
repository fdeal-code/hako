-- ═════════════════════════════════════════════════════════════
-- HAKO — Commentaires sur les envies
-- La fiche d'une envie écrivait dans `wish_comments`, mais la table
-- n'existait pas : aucun commentaire n'était enregistré.
-- Réservé aux membres du voyage ; on n'écrit et ne supprime que les siens.
-- Le nom et l'avatar viennent du profil (jointure author:profiles).
-- ═════════════════════════════════════════════════════════════

create table if not exists public.wish_comments (
  id         uuid primary key default gen_random_uuid(),
  wish_id    uuid not null references public.wishes(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  content    text not null check (char_length(trim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists wish_comments_wish_idx on public.wish_comments (wish_id, created_at);

alter table public.wish_comments enable row level security;

drop policy if exists wish_comments_select on public.wish_comments;
create policy wish_comments_select on public.wish_comments for select
  using (public.is_wish_member(wish_id));

drop policy if exists wish_comments_insert on public.wish_comments;
create policy wish_comments_insert on public.wish_comments for insert
  with check (user_id = auth.uid() and public.is_wish_member(wish_id));

drop policy if exists wish_comments_delete on public.wish_comments;
create policy wish_comments_delete on public.wish_comments for delete
  using (user_id = auth.uid());

-- Temps réel : les commentaires des autres apparaissent sans recharger
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wish_comments'
  ) then
    alter publication supabase_realtime add table public.wish_comments;
  end if;
end $$;
