-- HAKO — Test des tables de mesure (migration 20261012110000)
-- Un utilisateur écrit ses événements mais ne peut rien relire ; personne
-- n'écrit au nom d'un autre ; un anonyme peut signaler une erreur, pas un
-- événement. Le bloc se termine TOUJOURS par une exception : rien n'est gardé.
--   npx supabase db query --linked -f supabase/tests/telemetry_test.sql

do $$
declare
  u uuid; other uuid; n integer;
  ok text := ''; ko text := '';
begin
  select id into u from public.profiles order by id limit 1;
  select id into other from public.profiles where id <> u order by id limit 1;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);

  begin
    insert into public.app_events (session_id, name, props) values ('test', 'trip_created', '{"a":1}');
    ok := ok || ' | événement enregistré';
  exception when others then ko := ko || ' | événement refusé : ' || sqlerrm; end;

  begin
    insert into public.app_events (user_id, session_id, name) values (other, 'test', 'trip_created');
    ko := ko || ' | FUITE : événement au nom d’un autre';
  exception when others then ok := ok || ' | pas d’événement au nom d’un autre'; end;

  begin
    insert into public.app_events (session_id, name) values ('test', 'Nom Invalide !');
    ko := ko || ' | nom invalide accepté';
  exception when others then ok := ok || ' | nom invalide refusé'; end;

  select count(*) into n from public.app_events;
  if n = 0 then ok := ok || ' | impossible de relire les événements'; else ko := ko || ' | FUITE : ' || n || ' événements lisibles'; end if;

  begin
    insert into public.app_errors (session_id, message, fatal) values ('test', 'TypeError: test', true);
    ok := ok || ' | erreur enregistrée';
  exception when others then ko := ko || ' | erreur refusée : ' || sqlerrm; end;
  select count(*) into n from public.app_errors;
  if n = 0 then ok := ok || ' | impossible de relire les erreurs'; else ko := ko || ' | FUITE : erreurs lisibles'; end if;

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    insert into public.app_errors (session_id, message) values ('test', 'Erreur avant connexion');
    ok := ok || ' | anonyme signale une erreur';
  exception when others then ko := ko || ' | anonyme ne peut pas signaler : ' || sqlerrm; end;
  begin
    insert into public.app_events (session_id, name) values ('test', 'app_open');
    ko := ko || ' | FUITE : anonyme écrit un événement';
  exception when others then ok := ok || ' | anonyme n’écrit pas d’événement'; end;

  raise exception E'RESULTATS\nOK :%\nPROBLEMES :%', ok, coalesce(nullif(ko, ''), ' aucun');
end $$;
