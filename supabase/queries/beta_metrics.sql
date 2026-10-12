-- HAKO — Chiffres de la bêta (mesure d'usage, tables app_events / app_errors)
--   npx supabase db query --linked -f supabase/queries/beta_metrics.sql
-- Les sessions de développement (is_dev) sont exclues. Lecture seule.

with ev as (
  select * from public.app_events where not is_dev
),
-- Utilisateurs actifs
actifs as (
  select
    count(distinct user_id) filter (where created_at > now() - interval '1 day')  as actifs_24h,
    count(distinct user_id) filter (where created_at > now() - interval '7 days') as actifs_7j,
    count(distinct user_id) filter (where created_at > now() - interval '30 days') as actifs_30j
  from ev
),
-- Rétention : parmi ceux arrivés il y a plus de 7 jours, combien reviennent après J+1 et J+7 ?
premiers as (
  select user_id, min(created_at) as premier from ev group by user_id
),
retention as (
  select
    count(*) as cohorte,
    count(*) filter (where exists (
      select 1 from ev e where e.user_id = p.user_id and e.created_at >= p.premier + interval '1 day' and e.created_at < p.premier + interval '2 days'
    )) as revenus_j1,
    count(*) filter (where exists (
      select 1 from ev e where e.user_id = p.user_id and e.created_at >= p.premier + interval '7 days' and e.created_at < p.premier + interval '14 days'
    )) as revenus_j7
  from premiers p
  where p.premier < now() - interval '14 days'
),
-- Entonnoir sur 30 jours : nombre d'utilisateurs ayant fait chaque étape
entonnoir as (
  select
    count(distinct user_id) filter (where name = 'signup_completed') as inscrits,
    count(distinct user_id) filter (where name = 'trip_created')     as ont_cree_un_voyage,
    count(distinct user_id) filter (where name in ('invite_link_shared', 'invite_email_sent')) as ont_invite,
    count(distinct user_id) filter (where name = 'trip_joined')      as ont_rejoint_via_invitation,
    count(distinct user_id) filter (where name = 'wish_added')       as ont_ajoute_une_envie,
    count(distinct user_id) filter (where name = 'wish_voted')       as ont_vote,
    count(distinct user_id) filter (where name = 'expense_added')    as ont_ajoute_une_depense
  from ev where created_at > now() - interval '30 days'
),
-- Viralité : voyages créés vs personnes arrivées par invitation
viralite as (
  select
    count(*) filter (where name = 'trip_created') as voyages_crees,
    count(*) filter (where name = 'trip_joined')  as arrivees_par_invitation,
    round(count(*) filter (where name = 'trip_joined')::numeric / nullif(count(*) filter (where name = 'trip_created'), 0), 2) as invites_par_voyage
  from ev where created_at > now() - interval '30 days'
),
erreurs as (
  select count(*) filter (where created_at > now() - interval '7 days') as erreurs_7j,
         count(*) filter (where fatal and created_at > now() - interval '7 days') as plantages_7j
  from public.app_errors where not is_dev
)
select * from actifs, retention, entonnoir, viralite, erreurs;

-- Détail : erreurs les plus fréquentes sur 7 jours
select left(message, 160) as erreur, count(*) as fois, bool_or(fatal) as plantage, max(created_at) as derniere
from public.app_errors
where not is_dev and created_at > now() - interval '7 days'
group by 1 order by fois desc limit 15;

-- Détail : écrans les plus vus sur 7 jours
select props ->> 'route' as ecran, count(*) as vues, count(distinct user_id) as personnes
from public.app_events
where not is_dev and name = 'screen_view' and created_at > now() - interval '7 days'
group by 1 order by vues desc limit 20;
