-- ═════════════════════════════════════════════════════════════
-- HAKO — Stockage des documents (bucket `documents`) + mise à jour photos
-- Le bucket `documents` n'avait aucune règle : tout envoi était refusé.
-- Un envoi avec upsert demande aussi le droit UPDATE (photos et documents).
-- ═════════════════════════════════════════════════════════════

drop policy if exists "documents: lecture" on storage.objects;
create policy "documents: lecture"
  on storage.objects for select
  using (bucket_id = 'documents');

drop policy if exists "documents: envoi par les membres connectés" on storage.objects;
create policy "documents: envoi par les membres connectés"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents');

drop policy if exists "documents: mise à jour de ses fichiers" on storage.objects;
create policy "documents: mise à jour de ses fichiers"
  on storage.objects for update to authenticated
  using (bucket_id = 'documents' and owner = auth.uid())
  with check (bucket_id = 'documents');

drop policy if exists "documents: suppression de ses fichiers" on storage.objects;
create policy "documents: suppression de ses fichiers"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and owner = auth.uid());

drop policy if exists "photos: mise à jour de ses fichiers" on storage.objects;
create policy "photos: mise à jour de ses fichiers"
  on storage.objects for update to authenticated
  using (bucket_id = 'photos' and owner = auth.uid())
  with check (bucket_id = 'photos');
