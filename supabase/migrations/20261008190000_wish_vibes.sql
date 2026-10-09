-- ═════════════════════════════════════════════════════════════
-- HAKO — Ambiances d'une envie (écran « Nouvelle envie » / aperçu TikTok)
-- Mêmes valeurs que trips.vibes, plus 'insta' (Insta spot).
-- Servent au filtre par ambiance des envies et d'On t'aide.
-- ═════════════════════════════════════════════════════════════

alter table public.wishes
  add column if not exists vibes text[] not null default '{}';

create index if not exists wishes_vibes_idx on public.wishes using gin (vibes);
