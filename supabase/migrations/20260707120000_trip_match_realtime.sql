-- ═════════════════════════════════════════════════════════════
-- HAKO — Trip Match : Realtime
-- Requis par hooks/useTripMatch.ts : sans ajout à la publication
-- supabase_realtime, les souscriptions postgres_changes ne
-- reçoivent aucun événement (silencieusement).
-- Le RLS s'applique aussi au Realtime : seuls les participants
-- reçoivent les événements (policies SELECT existantes).
-- ═════════════════════════════════════════════════════════════

alter publication supabase_realtime add table public.trip_matches;
alter publication supabase_realtime add table public.match_responses;
alter publication supabase_realtime add table public.match_proposal_votes;
