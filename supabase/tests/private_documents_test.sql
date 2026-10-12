-- HAKO — Test des documents privés (migration 20261012100000)
-- Auteur A, autre membre B, personne extérieure X sur un voyage qui a des
-- documents. Un document est passé en « Perso » le temps du test.
-- Le bloc se termine TOUJOURS par une exception : rien n'est modifié.
--   npx supabase db query --linked -f supabase/tests/private_documents_test.sql

do $$
declare
  a uuid; b uuid; x uuid; trip uuid;
  shared_doc uuid; private_doc uuid; shared_file text; private_file text;
  n integer;
  ok text := ''; ko text := '';
begin
  -- Un voyage avec au moins 2 documents (fichiers dans le bucket) et 2 membres
  select d.trip_id into trip from public.documents d
   join storage.objects o on o.bucket_id = 'documents' and o.name = d.file_url
   group by d.trip_id having count(*) >= 2
   order by count(*) desc limit 1;
  if trip is null then raise exception 'Aucun voyage avec 2 documents stockés'; end if;
  select d.uploaded_by into a from public.documents d where d.trip_id = trip limit 1;
  select m.user_id into b from public.trip_members m where m.trip_id = trip and m.user_id <> a limit 1;
  select p.id into x from public.profiles p
   where not exists (select 1 from public.trip_members m where m.trip_id = trip and m.user_id = p.id) limit 1;
  if b is null or x is null then raise exception 'Il faut un autre membre et une personne extérieure'; end if;

  select d.id, d.file_url into shared_doc, shared_file from public.documents d where d.trip_id = trip and d.uploaded_by = a order by d.created_at limit 1;
  select d.id, d.file_url into private_doc, private_file from public.documents d where d.trip_id = trip and d.uploaded_by = a and d.id <> shared_doc order by d.created_at limit 1;
  update public.documents set is_shared = true where id = shared_doc;
  update public.documents set is_shared = false where id = private_doc;

  perform set_config('role', 'authenticated', true);

  -- ═══ A, l'auteur ═══
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.documents where id in (shared_doc, private_doc);
  if n = 2 then ok := ok || ' | A voit ses 2 documents'; else ko := ko || ' | A ne voit pas ses documents'; end if;
  select count(*) into n from storage.objects where bucket_id = 'documents' and name in (shared_file, private_file);
  if n = 2 then ok := ok || ' | A lit ses 2 fichiers'; else ko := ko || ' | A ne lit pas ses fichiers (' || n || ')'; end if;

  -- ═══ B, autre membre ═══
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.documents where id = shared_doc;
  if n = 1 then ok := ok || ' | B voit le document partagé'; else ko := ko || ' | B ne voit pas le document partagé'; end if;
  select count(*) into n from public.documents where id = private_doc;
  if n = 0 then ok := ok || ' | B ne voit pas le document Perso'; else ko := ko || ' | FUITE : B voit le document Perso'; end if;
  select count(*) into n from storage.objects where bucket_id = 'documents' and name = shared_file;
  if n = 1 then ok := ok || ' | B lit le fichier partagé'; else ko := ko || ' | B ne lit pas le fichier partagé'; end if;
  select count(*) into n from storage.objects where bucket_id = 'documents' and name = private_file;
  if n = 0 then ok := ok || ' | B ne lit pas le fichier Perso'; else ko := ko || ' | FUITE : B lit le fichier Perso'; end if;
  delete from public.documents where id = private_doc;
  get diagnostics n = row_count;
  if n = 0 then ok := ok || ' | B ne supprime pas le document Perso'; else ko := ko || ' | FUITE : B supprime le document Perso'; end if;

  -- ═══ X, extérieur au voyage ═══
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  select count(*) into n from public.documents where trip_id = trip;
  if n = 0 then ok := ok || ' | X ne voit aucun document'; else ko := ko || ' | FUITE : X voit ' || n || ' documents'; end if;
  select count(*) into n from storage.objects where bucket_id = 'documents' and name in (shared_file, private_file);
  if n = 0 then ok := ok || ' | X ne lit aucun fichier'; else ko := ko || ' | FUITE : X lit ' || n || ' fichiers'; end if;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('documents', trip::text || '/intrus.pdf', x);
    ko := ko || ' | FUITE : X dépose un fichier dans le voyage';
  exception when others then ok := ok || ' | X ne dépose rien dans le voyage'; end;

  -- ═══ Anonyme ═══
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  select count(*) into n from storage.objects where bucket_id = 'documents';
  if n = 0 then ok := ok || ' | anonyme ne lit rien'; else ko := ko || ' | FUITE : anonyme lit ' || n || ' fichiers'; end if;

  perform set_config('role', 'postgres', true);
  select count(*) into n from storage.buckets where id = 'documents' and public;
  if n = 0 then ok := ok || ' | bucket privé'; else ko := ko || ' | bucket encore public'; end if;

  raise exception E'RESULTATS\nOK :%\nPROBLEMES :%', ok, coalesce(nullif(ko, ''), ' aucun');
end $$;
