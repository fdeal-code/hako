-- ═════════════════════════════════════════════════════════════
-- HAKO — Dashboard en direct
-- Les tuiles du dashboard (documents, envies, budget, planning) se
-- mettent à jour (album et avis : voir 20261009100000_photos_storage) quand un membre du groupe ajoute quelque chose.
-- Sans publication supabase_realtime, les souscriptions postgres_changes
-- ne reçoivent rien (voir hooks/useFutureDashboard.ts).
-- ═════════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  foreach t in array array['documents', 'wishes', 'expenses', 'planning_items'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
