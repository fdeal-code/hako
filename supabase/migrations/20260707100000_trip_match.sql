-- ═════════════════════════════════════════════════════════════
-- HAKO — Feature "Trip Match"
-- Un groupe répond à un questionnaire, une Edge Function (service_role)
-- génère des propositions de destinations, puis le groupe vote.
--
-- 5 tables : trip_matches, match_participants, match_responses,
--            match_proposals, match_proposal_votes
-- RLS activé sur les 5. Aucune table existante n'est modifiée.
-- ═════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. TABLES
-- ─────────────────────────────────────────────

create table public.trip_matches (
  id         uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  -- Nullable : le trip n'existe pas encore au lancement du match.
  -- ON DELETE SET NULL : si le trip est supprimé plus tard, le match survit.
  trip_id    uuid references public.trips(id) on delete set null,
  title      text,
  status     text not null default 'collecting'
             check (status in ('collecting','proposing','voting','completed')),
  created_at timestamptz not null default now()
);

create table public.match_participants (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.trip_matches(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (match_id, user_id)
);

create table public.match_responses (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.trip_matches(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  answers    jsonb not null,
  created_at timestamptz not null default now(),
  unique (match_id, user_id)
);

create table public.match_proposals (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references public.trip_matches(id) on delete cascade,
  destination     text,
  country_code    text,
  argument        text,
  budget_estimate numeric,
  best_dates      text,
  match_score     int,
  position        int,
  created_at      timestamptz not null default now()
);

-- Calquée sur wish_votes (id / FK cible / user_id), sans colonne de valeur :
-- un vote = un like sur la proposition.
create table public.match_proposal_votes (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.match_proposals(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (proposal_id, user_id)
);

-- Index sur les FK interrogées par les policies et les écrans
-- (les contraintes UNIQUE couvrent déjà (match_id, user_id) et (proposal_id, user_id))
create index idx_trip_matches_creator     on public.trip_matches (creator_id);
create index idx_match_proposals_match    on public.match_proposals (match_id);
create index idx_match_proposal_votes_usr on public.match_proposal_votes (user_id);

-- ─────────────────────────────────────────────
-- 2. HELPER RLS — is_match_participant
-- SECURITY DEFINER : indispensable pour éviter la récursion infinie
-- (la policy SELECT de match_participants ne peut pas interroger
-- match_participants elle-même sous RLS).
-- ─────────────────────────────────────────────

create or replace function public.is_match_participant(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.match_participants
    where match_id = p_match_id
      and user_id  = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────
-- 3. TRIGGER — le creator devient participant automatiquement
-- Choix trigger (plutôt que côté service) : l'invariant est garanti au
-- niveau DB quel que soit le client, et il n'y a aucune fenêtre où le
-- creator ne verrait pas son propre match via les policies participants.
-- SECURITY DEFINER pour passer outre le RLS de match_participants.
-- ─────────────────────────────────────────────

create or replace function public.handle_new_trip_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.match_participants (match_id, user_id)
  values (new.id, new.creator_id)
  on conflict (match_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_trip_match_created
  after insert on public.trip_matches
  for each row execute function public.handle_new_trip_match();

-- ─────────────────────────────────────────────
-- 4. RLS
-- ─────────────────────────────────────────────

alter table public.trip_matches         enable row level security;
alter table public.match_participants   enable row level security;
alter table public.match_responses      enable row level security;
alter table public.match_proposals      enable row level security;
alter table public.match_proposal_votes enable row level security;

-- ── trip_matches ──
-- SELECT : participants (le creator l'est toujours via le trigger ;
-- le check creator_id couvre l'instant même de l'INSERT ... RETURNING)
create policy "trip_matches_select_participants"
  on public.trip_matches for select
  using (creator_id = auth.uid() or public.is_match_participant(id));

create policy "trip_matches_insert_creator"
  on public.trip_matches for insert
  with check (auth.uid() = creator_id);

-- UPDATE (changement de status) : uniquement le creator,
-- et il ne peut pas réattribuer le match à quelqu'un d'autre
create policy "trip_matches_update_creator"
  on public.trip_matches for update
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

-- DELETE : uniquement le creator (les ON DELETE CASCADE font le reste)
create policy "trip_matches_delete_creator"
  on public.trip_matches for delete
  using (auth.uid() = creator_id);

-- ── match_participants ──
create policy "match_participants_select_participants"
  on public.match_participants for select
  using (public.is_match_participant(match_id));

-- Le creator ajoute les autres participants (lui-même est inséré par trigger)
create policy "match_participants_insert_creator"
  on public.match_participants for insert
  with check (
    exists (
      select 1 from public.trip_matches m
      where m.id = match_id and m.creator_id = auth.uid()
    )
  );

-- ── match_responses ──
create policy "match_responses_select_participants"
  on public.match_responses for select
  using (public.is_match_participant(match_id));

create policy "match_responses_insert_own"
  on public.match_responses for insert
  with check (
    auth.uid() = user_id
    and public.is_match_participant(match_id)
  );

-- ── match_proposals ──
-- SELECT uniquement. Pas de policy INSERT/UPDATE/DELETE : les propositions
-- sont écrites par la Edge Function en service_role, qui bypass le RLS.
create policy "match_proposals_select_participants"
  on public.match_proposals for select
  using (public.is_match_participant(match_id));

-- ── match_proposal_votes ──
create policy "match_proposal_votes_select_participants"
  on public.match_proposal_votes for select
  using (
    exists (
      select 1 from public.match_proposals p
      where p.id = proposal_id
        and public.is_match_participant(p.match_id)
    )
  );

create policy "match_proposal_votes_insert_own"
  on public.match_proposal_votes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.match_proposals p
      where p.id = proposal_id
        and public.is_match_participant(p.match_id)
    )
  );
