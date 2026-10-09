-- HAKO — Test de la sécurité des tables principales (migration 20261009160000)
-- Simule un membre du voyage, une personne extérieure puis invitée, et
-- vérifie chaque parcours. Le bloc se termine TOUJOURS par une exception :
-- tout est annulé, rien n'est modifié en base. Le message liste les résultats.
--
--   (cat begin + migration + ce fichier + commit) | npx supabase db query --linked
-- Variables : membre = test@mail.com, extérieur = test@mail.fr, voyage = un voyage de l'organisateur dont l'extérieur n'est pas membre.

do $$
declare
  member_id  uuid := '90316eca-b3e8-4f1b-9977-9b81309e3413';  -- test@mail.com (organisateur du Japon)
  outsider   uuid := '88c414e5-7c85-49c1-ba44-4228f3da489b';  -- test@mail.fr (hors du voyage)
  jtrip      uuid;
  own_trip   uuid;
  inv_id     uuid;
  n          integer;
  ok         text := '';
  ko         text := '';
begin
  -- Le voyage en cours de l'organisateur dont l'extérieur n'est pas membre
  select t.id into jtrip from public.trips t
   where t.owner_id = member_id
     and not exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = outsider)
     and exists (select 1 from public.wishes w where w.trip_id = t.id)
   order by t.start_date desc limit 1;
  if jtrip is null then raise exception 'Voyage de test introuvable'; end if;

  -- ═══ En tant que MEMBRE ═══
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', member_id, 'role', 'authenticated', 'email', 'test@mail.com')::text, true);

  select count(*) into n from public.trips where id = jtrip;
  if n = 1 then ok := ok || ' | membre voit le voyage'; else ko := ko || ' | membre NE voit PAS le voyage'; end if;
  select count(*) into n from public.wishes where wishes.trip_id = jtrip;
  if n > 0 then ok := ok || ' | membre voit les envies (' || n || ')'; else ko := ko || ' | membre ne voit pas les envies'; end if;
  select count(*) into n from public.expense_splits;
  if n > 0 then ok := ok || ' | membre voit des parts de dépenses'; else ko := ko || ' | aucune part visible'; end if;

  begin
    insert into public.wishes (trip_id, added_by, title, status, type) values (jtrip, member_id, 'Test RLS', 'pending', 'place');
    ok := ok || ' | membre ajoute une envie';
  exception when others then ko := ko || ' | membre ne peut pas ajouter : ' || sqlerrm; end;

  begin
    insert into public.invitations (trip_id, invited_by, invited_email) values (jtrip, member_id, 'test@mail.fr') returning id into inv_id;
    ok := ok || ' | membre invite par e-mail';
  exception when others then ko := ko || ' | invitation refusée : ' || sqlerrm; end;

  -- ═══ En tant qu'EXTÉRIEUR (invité mais pas encore membre) ═══
  perform set_config('request.jwt.claims', json_build_object('sub', outsider, 'role', 'authenticated', 'email', 'test@mail.fr')::text, true);

  select count(*) into n from public.wishes where wishes.trip_id = jtrip;
  if n = 0 then ok := ok || ' | extérieur ne voit pas les envies'; else ko := ko || ' | FUITE : extérieur voit ' || n || ' envies'; end if;
  select count(*) into n from public.planning_items where planning_items.trip_id = jtrip;
  if n = 0 then ok := ok || ' | extérieur ne voit pas le planning'; else ko := ko || ' | FUITE planning'; end if;
  select count(*) into n from public.documents where documents.trip_id = jtrip;
  if n = 0 then ok := ok || ' | extérieur ne voit pas les documents'; else ko := ko || ' | FUITE documents'; end if;
  select count(*) into n from public.expenses where expenses.trip_id = jtrip;
  if n = 0 then ok := ok || ' | extérieur ne voit pas les dépenses'; else ko := ko || ' | FUITE dépenses'; end if;
  select count(*) into n from public.trips where id = jtrip;
  if n = 1 then ok := ok || ' | invité voit l’aperçu du voyage'; else ko := ko || ' | invité ne voit pas le voyage'; end if;
  select count(*) into n from public.invitations where id = inv_id;
  if n = 1 then ok := ok || ' | invité voit son invitation'; else ko := ko || ' | invité ne voit pas son invitation'; end if;

  begin
    insert into public.wishes (trip_id, added_by, title, status, type) values (jtrip, outsider, 'Intrus', 'pending', 'place');
    ko := ko || ' | FUITE : extérieur a ajouté une envie';
  exception when others then ok := ok || ' | extérieur bloqué à l’ajout'; end;

  update public.trips set name = 'Piraté' where id = jtrip;
  get diagnostics n = row_count;
  if n = 0 then ok := ok || ' | extérieur ne peut pas renommer'; else ko := ko || ' | FUITE : renommage'; end if;

  delete from public.wishes where wishes.trip_id = jtrip;
  get diagnostics n = row_count;
  if n = 0 then ok := ok || ' | extérieur ne peut pas supprimer'; else ko := ko || ' | FUITE : suppression'; end if;

  begin
    insert into public.trip_members (trip_id, user_id, role) values (jtrip, member_id, 'member');
    ko := ko || ' | FUITE : extérieur ajoute quelqu’un d’autre';
  exception when others then ok := ok || ' | extérieur ne peut pas ajouter un autre membre'; end;

  -- Créer son propre voyage
  begin
    insert into public.trips (name, destination, start_date, end_date) values ('Test RLS', 'Lisbonne', '2027-01-01', '2027-01-05')
      returning id into own_trip;
    insert into public.trip_members (trip_id, user_id, role) values (own_trip, outsider, 'owner');
    select count(*) into n from public.trips where id = own_trip;
    if n = 1 then ok := ok || ' | création de voyage OK'; else ko := ko || ' | voyage créé mais invisible'; end if;
  exception when others then ko := ko || ' | création de voyage refusée : ' || sqlerrm; end;

  -- Accepter l'invitation
  begin
    update public.invitations set status = 'accepted', accepted_at = now() where id = inv_id;
    get diagnostics n = row_count;
    insert into public.trip_members (trip_id, user_id, role) values (jtrip, outsider, 'member');
    select count(*) into n from public.wishes where wishes.trip_id = jtrip;
    if n > 0 then ok := ok || ' | invitation acceptée, envies visibles'; else ko := ko || ' | acceptée mais rien de visible'; end if;
  exception when others then ko := ko || ' | acceptation refusée : ' || sqlerrm; end;

  -- Profils et amis
  select count(*) into n from public.profiles;
  if n > 1 then ok := ok || ' | profils des autres lisibles'; else ko := ko || ' | profils illisibles'; end if;
  update public.profiles set nickname = 'Piraté' where id = member_id;
  get diagnostics n = row_count;
  if n = 0 then ok := ok || ' | profil d’autrui non modifiable'; else ko := ko || ' | FUITE : profil modifié'; end if;
  begin
    insert into public.friendships (requester_id, addressee_id) values (outsider, member_id);
    ok := ok || ' | demande d’ami OK';
  exception when others then ko := ko || ' | demande d’ami refusée : ' || sqlerrm; end;
  begin
    insert into public.friendships (requester_id, addressee_id) values (member_id, outsider);
    ko := ko || ' | FUITE : demande d’ami au nom d’un autre';
  exception when others then ok := ok || ' | usurpation de demande d’ami bloquée'; end;

  raise exception E'RESULTATS\nOK :%\nPROBLEMES :%', ok, coalesce(nullif(ko, ''), ' aucun');
end $$;
