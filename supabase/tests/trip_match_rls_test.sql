-- ═════════════════════════════════════════════════════════════
-- HAKO — Test RLS Trip Match (SQL editor du dashboard)
--
-- PRÉPARATION :
--   1. Récupérer 2 user ids réels (Dashboard → Authentication → Users) :
--      USER_A = le creator, USER_B = un utilisateur SANS lien avec le match.
--   2. Remplacer les deux UUID ci-dessous.
--   3. Exécuter BLOC PAR BLOC (les blocs "DOIT ÉCHOUER" lèvent une erreur
--      RLS : c'est le résultat attendu — relancer le bloc suivant après).
--   4. Tout se passe dans une transaction → ROLLBACK final, aucune donnée
--      n'est conservée.
-- ═════════════════════════════════════════════════════════════

-- ─── BLOC 1 — setup : USER_A crée un match ───────────────────
begin;
create temp table qa (
  user_a uuid default 'REMPLACER-PAR-USER-A-UUID',
  user_b uuid default 'REMPLACER-PAR-USER-B-UUID',
  match_id uuid
);
insert into qa default values;

-- On se fait passer pour USER_A (authenticated)
select set_config('request.jwt.claims',
  json_build_object('sub', (select user_a from qa), 'role', 'authenticated')::text, true);
set local role authenticated;

insert into trip_matches (creator_id, title)
values ((select user_a from qa), 'QA RLS — à jeter')
returning id;
-- ✅ ATTENDU : 1 ligne créée. Copier l'id retourné :
-- update qa set match_id = '<id retourné>';  ← exécuter avec le vrai id
-- (rester dans la même session SQL editor pour garder la transaction)

-- Le trigger a inséré le creator :
select count(*) as participants_attendu_1
from match_participants where match_id = (select match_id from qa);

-- ─── BLOC 2 — USER_A voit son match ──────────────────────────
select id, status from trip_matches where id = (select match_id from qa);
-- ✅ ATTENDU : 1 ligne

-- ─── BLOC 3 — USER_B (non-participant) ne voit RIEN ──────────
select set_config('request.jwt.claims',
  json_build_object('sub', (select user_b from qa), 'role', 'authenticated')::text, true);

select * from trip_matches       where id = (select match_id from qa);
select * from match_participants where match_id = (select match_id from qa);
select * from match_responses    where match_id = (select match_id from qa);
select * from match_proposals    where match_id = (select match_id from qa);
-- ✅ ATTENDU : 0 ligne partout (pas d'erreur, juste rien)

-- ─── BLOC 4 — USER_B ne peut PAS répondre ────────────────────
insert into match_responses (match_id, user_id, answers)
values ((select match_id from qa), (select user_b from qa), '{}'::jsonb);
-- ❌ DOIT ÉCHOUER : "new row violates row-level security policy"

-- ─── BLOC 5 — USER_B ne peut PAS s'auto-inviter ──────────────
insert into match_participants (match_id, user_id)
values ((select match_id from qa), (select user_b from qa));
-- ❌ DOIT ÉCHOUER : policy INSERT réservée au creator du match

-- ─── BLOC 6 — USER_B ne peut PAS écrire de proposition ───────
insert into match_proposals (match_id, destination)
values ((select match_id from qa), 'Hackland');
-- ❌ DOIT ÉCHOUER : aucune policy INSERT (service_role uniquement)

-- ─── BLOC 7 — USER_B ne peut PAS clôturer le match ───────────
update trip_matches set status = 'completed'
where id = (select match_id from qa);
-- ✅ ATTENDU : "UPDATE 0" (la ligne est invisible pour lui)

-- ─── BLOC 8 — double réponse de USER_A (contrainte UNIQUE) ───
select set_config('request.jwt.claims',
  json_build_object('sub', (select user_a from qa), 'role', 'authenticated')::text, true);

insert into match_responses (match_id, user_id, answers)
values ((select match_id from qa), (select user_a from qa), '{"budget": 500}'::jsonb);
-- ✅ ATTENDU : 1 ligne (USER_A est participant)

insert into match_responses (match_id, user_id, answers)
values ((select match_id from qa), (select user_a from qa), '{"budget": 900}'::jsonb);
-- ❌ DOIT ÉCHOUER : duplicate key (unique match_id/user_id, code 23505)
--    → côté app, tripMatchService.submitResponse traduit en
--      "Tu as déjà répondu à ce match."

-- ─── BLOC 9 — nettoyage ──────────────────────────────────────
rollback;
-- ✅ Aucune donnée de test conservée.

-- ═════════════════════════════════════════════════════════════
-- VARIANTE MANUELLE (sans SQL) :
--   1. Créer un match avec le compte A dans l'app.
--   2. Se connecter avec un compte B jamais invité.
--   3. Ouvrir hako://match/<id>/questionnaire (deep link) :
--      l'écran doit rester vide / en erreur, et l'envoi de réponse
--      doit afficher une erreur — B ne voit aucune donnée du match.
-- ═════════════════════════════════════════════════════════════
