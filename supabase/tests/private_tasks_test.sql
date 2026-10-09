-- HAKO — Test des tâches privées (migration 20261009180000)
-- Deux membres d'un même voyage : A crée une tâche privée et une tâche de
-- groupe, B ne doit voir / modifier / supprimer que celle du groupe.
-- Le bloc se termine TOUJOURS par une exception : rien n'est modifié.
--   npx supabase db query --linked -f supabase/tests/private_tasks_test.sql

do $$
declare
  a uuid; b uuid; trip uuid;
  priv uuid; grp uuid;
  n integer; notif_before integer; notif_after integer;
  ok text := ''; ko text := '';
begin
  -- Un voyage avec au moins deux membres
  select m1.trip_id, m1.user_id, m2.user_id into trip, a, b
    from public.trip_members m1 join public.trip_members m2 on m2.trip_id = m1.trip_id and m2.user_id <> m1.user_id
   limit 1;
  if trip is null then raise exception 'Aucun voyage à deux membres'; end if;
  select count(*) into notif_before from public.notifications;

  perform set_config('role', 'authenticated', true);

  -- ═══ A ═══
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.wishes (trip_id, added_by, title, type, status, is_private)
    values (trip, a, 'Test privé', 'orga', 'pending', true) returning id into priv;
  insert into public.wishes (trip_id, added_by, title, type, status, is_private)
    values (trip, a, 'Test groupe', 'orga', 'pending', false) returning id into grp;
  select count(*) into n from public.wishes where id in (priv, grp);
  if n = 2 then ok := ok || ' | A voit ses 2 tâches'; else ko := ko || ' | A ne voit pas ses tâches'; end if;

  begin
    insert into public.wishes (trip_id, added_by, title, type, status, is_private) values (trip, a, 'Envie privée', 'place', 'pending', true);
    ko := ko || ' | FUITE : envie (non orga) privée acceptée';
  exception when others then ok := ok || ' | privé réservé aux tâches'; end;

  -- ═══ B ═══
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.wishes where id = priv;
  if n = 0 then ok := ok || ' | B ne voit pas la tâche privée'; else ko := ko || ' | FUITE : B voit la tâche privée'; end if;
  select count(*) into n from public.wishes where id = grp;
  if n = 1 then ok := ok || ' | B voit la tâche de groupe'; else ko := ko || ' | B ne voit pas la tâche de groupe'; end if;

  update public.wishes set done = true where id = priv;
  get diagnostics n = row_count;
  if n = 0 then ok := ok || ' | B ne coche pas la tâche privée'; else ko := ko || ' | FUITE : B coche la tâche privée'; end if;
  delete from public.wishes where id = priv;
  get diagnostics n = row_count;
  if n = 0 then ok := ok || ' | B ne supprime pas la tâche privée'; else ko := ko || ' | FUITE : B supprime la tâche privée'; end if;

  update public.wishes set done = true where id = grp;
  get diagnostics n = row_count;
  if n = 1 then ok := ok || ' | B coche la tâche de groupe'; else ko := ko || ' | B ne peut pas cocher la tâche de groupe'; end if;

  begin
    update public.wishes set is_private = true where id = grp;
    ko := ko || ' | FUITE : B rend privée la tâche de A';
  exception when others then ok := ok || ' | B ne change pas la visibilité'; end;

  begin
    insert into public.wishes (trip_id, added_by, title, type, status, is_private) values (trip, a, 'Usurpation', 'orga', 'pending', true);
    ko := ko || ' | FUITE : B crée une tâche privée au nom de A';
  exception when others then ok := ok || ' | B ne crée pas de tâche privée pour A'; end;

  -- ═══ A rend sa tâche de groupe privée ═══
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.wishes set is_private = true where id = grp;
  get diagnostics n = row_count;
  if n = 1 then ok := ok || ' | A change la visibilité'; else ko := ko || ' | A ne peut pas changer la visibilité'; end if;

  perform set_config('role', 'postgres', true);
  select count(*) into notif_after from public.notifications;
  if notif_after = notif_before then ok := ok || ' | aucune notification pour les tâches'; else ko := ko || ' | FUITE : notification envoyée (' || (notif_after - notif_before) || ')'; end if;

  raise exception E'RESULTATS\nOK :%\nPROBLEMES :%', ok, coalesce(nullif(ko, ''), ' aucun');
end $$;
