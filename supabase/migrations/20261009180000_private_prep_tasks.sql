-- ═════════════════════════════════════════════════════════════
-- HAKO — Préparatifs : tâches privées
-- Une tâche d'orga (wishes type 'orga') est soit pour le groupe, soit
-- visible uniquement par la personne qui l'a créée (is_private).
--   • RLS : une ligne privée n'est lue / modifiée / supprimée que par
--     son auteur (les autres membres ne la voient même pas en temps réel).
--   • Seul l'auteur peut changer la visibilité d'une tâche.
--   • Les tâches d'orga ne déclenchent plus la notification « envie
--     ajoutée » (elle aurait affiché le titre d'une tâche privée).
-- ═════════════════════════════════════════════════════════════

alter table public.wishes add column if not exists is_private boolean not null default false;

-- Une envie privée = forcément une tâche d'orga
alter table public.wishes drop constraint if exists wishes_private_only_orga;
alter table public.wishes add constraint wishes_private_only_orga
  check (not is_private or type = 'orga');

-- ─── RLS : remplace la politique « membres » de 20261009160000 ──
drop policy if exists wishes_members on public.wishes;

drop policy if exists wishes_select on public.wishes;
create policy wishes_select on public.wishes for select
  using (public.is_trip_member(trip_id) and (not is_private or added_by = auth.uid()));

drop policy if exists wishes_insert on public.wishes;
create policy wishes_insert on public.wishes for insert
  with check (public.is_trip_member(trip_id) and (not is_private or added_by = auth.uid()));

drop policy if exists wishes_update on public.wishes;
create policy wishes_update on public.wishes for update
  using (public.is_trip_member(trip_id) and (not is_private or added_by = auth.uid()))
  with check (public.is_trip_member(trip_id) and (not is_private or added_by = auth.uid()));

drop policy if exists wishes_delete on public.wishes;
create policy wishes_delete on public.wishes for delete
  using (public.is_trip_member(trip_id) and (not is_private or added_by = auth.uid()));

-- Votes et commentaires : pas sur la tâche privée de quelqu'un d'autre
create or replace function public.is_wish_member(p_wish_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.wishes w
    where w.id = p_wish_id
      and public.is_trip_member(w.trip_id)
      and (not w.is_private or w.added_by = auth.uid())
  );
$$;

-- ─── Seul l'auteur change la visibilité ──────────────────────
create or replace function public.guard_wish_privacy()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_private is distinct from old.is_private and old.added_by is distinct from auth.uid() then
    raise exception 'Seule la personne qui a créé la tâche peut changer sa visibilité';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_wish_privacy on public.wishes;
create trigger trg_guard_wish_privacy
  before update of is_private on public.wishes
  for each row execute function public.guard_wish_privacy();

-- ─── Notification « envie ajoutée » : pas pour les tâches d'orga ─
create or replace function public.on_wish_added_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'orga' then
    return new; -- tâche des Préparatifs (éventuellement privée) : pas une envie
  end if;
  perform public.notify_trip_members(
    new.trip_id, new.added_by, 'wish_added',
    jsonb_build_object('wish_id', new.id, 'title', new.title, 'actor', public.nickname_of(new.added_by))
  );
  return new;
end $$;
