-- ═════════════════════════════════════════════════════════════
-- HAKO — Style & budget d'un voyage (dernière étape de la création)
-- Sert à filtrer les suggestions « On t'aide » (logements, activités).
-- Les deux colonnes sont optionnelles : l'étape peut être passée.
-- ═════════════════════════════════════════════════════════════

alter table public.trips
  add column if not exists vibes text[] not null default '{}',
  -- Budget par personne, hors transport, en euros entiers
  add column if not exists budget_per_person integer check (budget_per_person is null or budget_per_person > 0);
