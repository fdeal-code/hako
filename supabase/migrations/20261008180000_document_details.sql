-- ═════════════════════════════════════════════════════════════
-- HAKO — Infos structurées d'un billet (écran « Billet »)
-- Optionnelles, saisies à l'ajout : trajet, horaires, siège, porte,
-- passager, référence. Le fichier (PDF / photo) reste la source.
-- ═════════════════════════════════════════════════════════════

alter table public.documents
  add column if not exists details jsonb;
