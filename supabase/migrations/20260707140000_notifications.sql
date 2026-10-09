-- ═════════════════════════════════════════════════════════════
-- HAKO — Notifications in-app (infra minimale réutilisable)
-- Aucune infra générique n'existait (la cloche de la Home est
-- couplée aux invitations de trips + demandes d'amis).
-- Premier consommateur : 'match_invite' (Trip Match).
-- ═════════════════════════════════════════════════════════════

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Chacun ne voit que les siennes
create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

-- Marquer comme lue : uniquement les siennes (et sans les réattribuer)
create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notifications_delete_own"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- INSERT : tout utilisateur connecté peut notifier quelqu'un (nécessaire
-- pour l'insertion client-side à la création d'un match).
-- ⚠️ Volontairement permissif pour ce scope — à durcir quand l'insertion
-- passera par une Edge Function (service_role).
create policy "notifications_insert_authenticated"
  on public.notifications for insert
  with check (auth.uid() is not null);

-- Realtime : requis par hooks/useNotifications.ts (badge en direct)
alter publication supabase_realtime add table public.notifications;
