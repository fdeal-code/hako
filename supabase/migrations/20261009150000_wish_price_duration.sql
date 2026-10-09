-- ═════════════════════════════════════════════════════════════
-- HAKO — Prix et durée précis sur les envies
-- Avant : budget en niveaux (€, €€, €€€) et durée en 5 choix fixes.
-- Maintenant : prix par personne en euros et durée en minutes, saisis dès
-- l'ajout de l'envie. Les anciennes colonnes restent lues en secours.
-- ═════════════════════════════════════════════════════════════

alter table public.wishes
  add column if not exists price_per_person numeric check (price_per_person is null or price_per_person >= 0),
  add column if not exists duration_minutes integer check (duration_minutes is null or duration_minutes > 0);
