-- ═════════════════════════════════════════════════════════════
-- HAKO — Préférences de notifications (règle anti-spam)
-- Une ligne par (utilisateur, catégorie). Absence de ligne = défaut.
-- Catégories : decisions (votes & envies validées), expenses, group,
-- new_wishes (résumé), hako_ideas (suggestions, 1×/semaine max),
-- quiet_hours (silence de nuit — utilisé par le futur push).
-- Les notifications in-app des catégories « off » ne sont plus créées.
-- ⚠️ Appliquer après trip_activity_notifications (remplace notify_trip_members).
-- ═════════════════════════════════════════════════════════════

create table public.notification_prefs (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  category   text not null check (category in ('decisions', 'expenses', 'group', 'new_wishes', 'hako_ideas', 'quiet_hours')),
  mode       text not null check (mode in ('instant', 'digest', 'off', 'on')),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.notification_prefs enable row level security;

create policy "notification_prefs_select_own" on public.notification_prefs
  for select using (auth.uid() = user_id);
create policy "notification_prefs_insert_own" on public.notification_prefs
  for insert with check (auth.uid() = user_id);
create policy "notification_prefs_update_own" on public.notification_prefs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Type de notification → catégorie de préférence
create or replace function public.notification_category(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'wish_validated' then 'decisions'
    when 'wish_added'     then 'new_wishes'
    when 'expense_added'  then 'expenses'
    when 'member_joined'  then 'group'
    else 'decisions'
  end;
$$;

-- Remplace la version de trip_activity_notifications : respecte « off »
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
    and (p_exclude is null or tm.user_id <> p_exclude)
    and not exists (
      select 1 from public.notification_prefs np
      where np.user_id = tm.user_id
        and np.category = public.notification_category(p_type)
        and np.mode = 'off'
    );
$$;
