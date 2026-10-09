-- ═════════════════════════════════════════════════════════════
-- HAKO — Trip Match : dates exploitables sur les propositions
-- Fix du bug « null value in column "start_date" of relation
-- "trips" » : best_dates n'est qu'un libellé d'affichage ; la
-- Edge Function écrit désormais aussi start_date/end_date en ISO,
-- que completeMatch passe à la création du trip.
-- Nullables pour ne pas casser les propositions existantes
-- (l'app les détecte et invite à relancer une génération).
-- ═════════════════════════════════════════════════════════════

alter table public.match_proposals
  add column start_date date,
  add column end_date date;
