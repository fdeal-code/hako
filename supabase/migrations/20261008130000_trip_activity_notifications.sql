-- ═════════════════════════════════════════════════════════════
-- HAKO — Notifications d'activité d'un voyage (centre de notifications)
-- Générées côté base par des triggers SECURITY DEFINER : aucun client
-- n'a besoin d'écrire chez les autres. Types :
--   wish_added     — un membre propose une envie (tous sauf l'auteur)
--   wish_validated — une envie atteint la majorité (« Qui réserve ? »)
--   expense_added  — un membre ajoute une dépense (tous sauf le payeur)
--   member_joined  — un nouveau membre rejoint le voyage
-- Spec : docs/FEATURES.md → « Notifications ».
-- ⚠️ Respect des préférences (notification_prefs) : à brancher avec le push.
-- ═════════════════════════════════════════════════════════════

create or replace function public.notify_trip_members(
  p_trip_id uuid,
  p_exclude uuid,
  p_type text,
  p_payload jsonb
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, type, payload)
  select tm.user_id, p_type, p_payload || jsonb_build_object('trip_id', p_trip_id)
  from public.trip_members tm
  where tm.trip_id = p_trip_id
    and (p_exclude is null or tm.user_id <> p_exclude);
$$;

create or replace function public.nickname_of(p_user_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select nickname from public.profiles where id = p_user_id), 'Un membre');
$$;

-- ─── Envie ajoutée ───────────────────────────────────────────
create or replace function public.on_wish_added_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_trip_members(
    new.trip_id, new.added_by, 'wish_added',
    jsonb_build_object('wish_id', new.id, 'title', new.title, 'actor', public.nickname_of(new.added_by))
  );
  return new;
end $$;

drop trigger if exists trg_wish_added_notify on public.wishes;
create trigger trg_wish_added_notify
  after insert on public.wishes
  for each row execute function public.on_wish_added_notify();

-- ─── Envie validée (passage au statut 'validated') ───────────
create or replace function public.on_wish_validated_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'validated' and old.status is distinct from 'validated' then
    perform public.notify_trip_members(
      new.trip_id, null, 'wish_validated',
      jsonb_build_object('wish_id', new.id, 'title', new.title)
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_wish_validated_notify on public.wishes;
create trigger trg_wish_validated_notify
  after update of status on public.wishes
  for each row execute function public.on_wish_validated_notify();

-- ─── Dépense ajoutée ─────────────────────────────────────────
create or replace function public.on_expense_added_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_trip_members(
    new.trip_id, new.paid_by, 'expense_added',
    jsonb_build_object('expense_id', new.id, 'title', new.title, 'amount', new.amount,
                       'actor', public.nickname_of(new.paid_by))
  );
  return new;
end $$;

drop trigger if exists trg_expense_added_notify on public.expenses;
create trigger trg_expense_added_notify
  after insert on public.expenses
  for each row execute function public.on_expense_added_notify();

-- ─── Nouveau membre ──────────────────────────────────────────
create or replace function public.on_member_joined_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_trip_members(
    new.trip_id, new.user_id, 'member_joined',
    jsonb_build_object('actor', public.nickname_of(new.user_id),
                       'trip_name', (select name from public.trips where id = new.trip_id))
  );
  return new;
end $$;

drop trigger if exists trg_member_joined_notify on public.trip_members;
create trigger trg_member_joined_notify
  after insert on public.trip_members
  for each row execute function public.on_member_joined_notify();
