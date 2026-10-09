-- ═════════════════════════════════════════════════════════════
-- HAKO — « J'ai réservé » sur une envie validée (logement surtout)
-- Qui a réservé et quand ; le planning (check-in) et la dépense
-- partagée sont créés côté client par services/bookingService.ts.
-- ═════════════════════════════════════════════════════════════

alter table public.wishes
  add column if not exists booked_at timestamptz,
  add column if not exists booked_by uuid references public.profiles(id) on delete set null,
  add column if not exists booked_amount numeric check (booked_amount is null or booked_amount >= 0);
