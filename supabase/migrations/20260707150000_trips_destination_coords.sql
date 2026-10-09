-- ═════════════════════════════════════════════════════════════
-- HAKO — Coordonnées de destination sur les trips
-- Les trips créés via Trip Match (completeMatch) ont une destination
-- texte issue de l'IA, sans coordonnées : la carte du dashboard n'a
-- rien à afficher. On stocke lat/lng (+ place_id Google) résolus par
-- la Geocoding API au moment de la création du trip.
-- Colonnes nullables : le trip se crée même si la résolution échoue
-- (réseau, quota) — la carte affiche alors un état vide explicite.
-- ═════════════════════════════════════════════════════════════

alter table public.trips
  add column destination_lat      double precision,
  add column destination_lng      double precision,
  add column destination_place_id text;
