-- ═════════════════════════════════════════════════════════════
-- HAKO — Documents vraiment privés
-- Avant :
--   • le bucket `documents` était public : quiconque avait le lien d'un
--     fichier (passeport, billet, confirmation) pouvait l'ouvrir ;
--   • un document « Perso » (is_shared = false, ex. passeport) était quand
--     même renvoyé par la base à tous les membres du voyage.
-- Après :
--   • bucket privé, l'app ouvre les fichiers par des liens signés courts ;
--   • un fichier n'est lisible que par les membres du voyage qui ont le
--     droit de voir le document correspondant (et par celui qui l'a envoyé) ;
--   • documents.file_url contient désormais le chemin dans le bucket
--     (« <trip_id>/<fichier> ») au lieu d'une URL publique ;
--   • un document « Perso » n'est visible / modifiable que par son auteur.
-- Les PDF de démo du Japon ont été déplacés de demo-japan/ vers
-- <trip_id>/demo-*.pdf avant cette migration (supabase storage mv).
-- ═════════════════════════════════════════════════════════════

-- ─── 1. file_url : URL publique → chemin dans le bucket ───────
update public.documents
set file_url = regexp_replace(
  substring(file_url from '/storage/v1/object/(?:public|sign)/documents/([^?]*)'),
  '^demo-japan/', trip_id::text || '/demo-'
)
where file_url ~ '/storage/v1/object/(public|sign)/documents/';

-- ─── 2. Bucket privé ──────────────────────────────────────────
update storage.buckets set public = false where id = 'documents';

-- ─── 3. Helpers ───────────────────────────────────────────────
-- Voyage d'un fichier d'après son dossier (« <trip_id>/… »), null sinon
create or replace function public.storage_trip_id(p_name text)
returns uuid language sql immutable as $$
  select case
    when (storage.foldername(p_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(p_name))[1])::uuid
  end;
$$;

-- Peut-on lire ce fichier ? Il faut voir un document qui le référence
create or replace function public.can_read_document_file(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.documents d
    where d.file_url = p_name
      and public.is_trip_member(d.trip_id)
      and (d.is_shared or d.uploaded_by = auth.uid())
  );
$$;

-- ─── 4. Table documents : « Perso » = visible par son auteur seul ─
drop policy if exists documents_members on public.documents;

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents for select
  using (public.is_trip_member(trip_id) and (is_shared or uploaded_by = auth.uid()));

drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents for insert
  with check (public.is_trip_member(trip_id) and uploaded_by = auth.uid());

drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update
  using (public.is_trip_member(trip_id) and (is_shared or uploaded_by = auth.uid()))
  with check (public.is_trip_member(trip_id) and (is_shared or uploaded_by = auth.uid()));

drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents for delete
  using (public.is_trip_member(trip_id) and (is_shared or uploaded_by = auth.uid()));

-- ─── 5. Stockage : lecture et envoi réservés aux membres ──────
drop policy if exists "documents: lecture" on storage.objects;
drop policy if exists "documents: lecture par les membres" on storage.objects;
create policy "documents: lecture par les membres" on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (owner = auth.uid() or public.can_read_document_file(name))
  );

drop policy if exists "documents: envoi par les membres connectés" on storage.objects;
drop policy if exists "documents: envoi dans un voyage dont on est membre" on storage.objects;
create policy "documents: envoi dans un voyage dont on est membre" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_trip_member(public.storage_trip_id(name)));
-- (mise à jour / suppression : inchangées, réservées à l'auteur du fichier)
