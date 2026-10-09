-- ═════════════════════════════════════════════════════════════
-- HAKO — Lien trip_members → profiles
-- trip_members.user_id pointait seulement vers auth.users : la jointure
-- PostgREST « profile:profiles(nickname, avatar_url) » échouait (PGRST200),
-- donc la liste des membres ne se chargeait pas (album, avis, récap,
-- paramètres, équilibre, avatars du dashboard et des envies).
-- profiles.id = auth.users.id : on ajoute la clé étrangère vers profiles.
-- ═════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.trip_members'::regclass and conname = 'trip_members_user_id_profiles_fkey'
  ) then
    alter table public.trip_members
      add constraint trip_members_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- Recharge le cache de schéma de l'API pour que la jointure soit reconnue
notify pgrst, 'reload schema';
