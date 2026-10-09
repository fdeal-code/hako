-- ═════════════════════════════════════════════════════════════
-- HAKO — Stockage de l'album photo (bucket `photos`)
-- Le bucket existait sans aucune règle d'accès : tout envoi était refusé
-- (« new row violates row-level security policy »). On le rend public en
-- lecture (photos affichées par URL) et ouvert à l'envoi pour les membres
-- connectés ; chacun ne peut supprimer que ses propres fichiers.
-- ═════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

drop policy if exists "photos: lecture publique" on storage.objects;
create policy "photos: lecture publique"
  on storage.objects for select
  using (bucket_id = 'photos');

drop policy if exists "photos: envoi par les membres connectés" on storage.objects;
create policy "photos: envoi par les membres connectés"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos');

drop policy if exists "photos: suppression de ses fichiers" on storage.objects;
create policy "photos: suppression de ses fichiers"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and owner = auth.uid());

-- Album et avis en direct (la migration dashboard_realtime avait été
-- appliquée avant l'ajout de ces deux tables)
do $$
declare
  t text;
begin
  foreach t in array array['trip_photos', 'activity_reviews'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
