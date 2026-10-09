# Supabase — Migrations HAKO

## Migration `20260707100000_trip_match.sql` — Feature "Trip Match"

Crée 5 tables (`trip_matches`, `match_participants`, `match_responses`,
`match_proposals`, `match_proposal_votes`) avec RLS activé partout.
Ne modifie **aucune** table existante.

### Comment l'appliquer

**Option A — Supabase CLI (recommandé)**

```bash
# une seule fois : lier le projet
npx supabase link --project-ref tpiwpmqijitzyyujzvqu

# pousser la migration
npx supabase db push
```

**Option B — Dashboard SQL Editor**

1. Ouvrir https://supabase.com/dashboard/project/tpiwpmqijitzyyujzvqu/sql
2. Copier-coller tout le contenu de `migrations/20260707100000_trip_match.sql`
3. Run. Le script est idempotent-friendly à une exécution près : ne pas le
   rejouer deux fois (les `create table` échoueraient).

### Choix de conception

- **Creator → participant : trigger** (`on_trip_match_created`, SECURITY
  DEFINER). Garanti au niveau DB quel que soit le client, et pas de fenêtre
  où le creator ne verrait pas son propre match via les policies « participants ».
- **`is_match_participant()` en SECURITY DEFINER** : évite la récursion
  infinie du RLS (la policy de `match_participants` ne peut pas interroger
  `match_participants` elle-même sous RLS).
- **`match_proposals` sans policy INSERT** : seules les Edge Functions en
  `service_role` (qui bypass le RLS) écrivent les propositions.
- **`trip_id` en `ON DELETE SET NULL`** : si le trip lié est supprimé, le
  match et son historique survivent.
- **Ajout des autres participants** : policy INSERT réservée au creator sur
  `match_participants` (lui-même est inséré par le trigger).

### Limites volontaires (spec)

- **Dé-vote** : ajouté a posteriori par la migration
  `20260707110000_trip_match_unvote.sql` (policy DELETE sur son propre vote),
  requis par `tripMatchService.unvoteProposal`. Appliquer les deux migrations.
- **Pas de modification de réponse** : aucune policy UPDATE sur
  `match_responses`. Utiliser un `upsert` ne fonctionnera donc que pour la
  première soumission ; ajouter une policy UPDATE `auth.uid() = user_id`
  si l'édition des réponses est prévue.

## Migration `20261008100000_trip_stops.sql` — Voyages multi-étapes

Crée `trip_stops` (une ligne par ville du voyage, avec dates) + RLS réservé
aux membres du trip via `is_trip_member()` (SECURITY DEFINER).
Ajoute `stop_id` (nullable, ON DELETE SET NULL) sur `wishes`,
`planning_items` et `expenses`, puis **backfill** une étape par trip existant
à partir de `trips.destination` / dates : aucun trip n'est cassé.

`trips.destination` est conservé comme libellé (« Rome, Florence +1 »).
Contrainte `unique (trip_id, position)` *deferrable* ; côté client le
réordonnancement passe par des positions temporaires (voir
`services/tripStopService.ts → reorderTripStops`).

Appliquer : `npx supabase db push`, ou copier le fichier dans le SQL Editor.

## Migration `20261008110000_trips_style_budget.sql` — Style & budget

Ajoute `trips.vibes text[]` (défaut `{}`) et `trips.budget_per_person integer`
(euros, nullable). Renseignés par la dernière étape (optionnelle) de la
création ; utilisés par l'écran « On t'aide » pour filtrer les suggestions.

## Migration `20261008120000_trip_checklist.sql` — Checklist de départ

Table `trip_checklist` (une ligne par élément coché : passport, tickets,
lodging, esim, insurance), unique par `(trip_id, item)`, RLS membres via
`is_trip_member()` (⚠️ appliquer **après** `trip_stops`). Realtime activé.

## Migration `20261008130000_trip_activity_notifications.sql` — Activité

Triggers SECURITY DEFINER qui écrivent dans `notifications` :
`wish_added` (tous sauf l'auteur), `wish_validated` (passage au statut
validé), `expense_added` (tous sauf le payeur), `member_joined`.
Helpers : `notify_trip_members()`, `nickname_of()`.
⚠️ Suppose les colonnes `wishes.added_by`, `expenses.paid_by` et
`profiles.nickname` (celles utilisées par le code client).

## Migration `20261008140000_trip_invite_links.sql` — Lien d'invitation

Table `trip_invite_links (token, trip_id, created_by, revoked)` + deux
fonctions SECURITY DEFINER :
- `get_invite_preview(token)` → aperçu JSON du voyage, **exécutable par
  `anon`** (l'invité voit le voyage avant de créer son compte) ;
- `join_trip_with_token(token)` → ajoute l'utilisateur connecté à
  `trip_members` (rôle `member`) et renvoie l'id du voyage.
Le deep link est `hako://join/<token>` (scheme `hako`). Pour un lien
cliquable partout (https), il faudra des Universal Links / App Links.

## Ordre d'application (Voyages multi-étapes & co)

1. `20261008100000_trip_stops.sql`
2. `20261008110000_trips_style_budget.sql`
3. `20261008120000_trip_checklist.sql`
4. `20261008130000_trip_activity_notifications.sql`
5. `20261008140000_trip_invite_links.sql`
6. `20261008150000_notification_prefs.sql`
7. `20261008160000_trip_events.sql` (+ déployer l'Edge Function `fetch-trip-events`, voir son README)
8. `20261008170000_wish_booking.sql`
9. `20261008180000_document_details.sql`
10. `20261008190000_wish_vibes.sql`
11. `20261008200000_dashboard_realtime.sql`
12. `20261009100000_photos_storage.sql`
13. `20261009110000_photos_reviews_policies.sql`
14. `20261009120000_print_album_requests.sql`
15. `20261009130000_documents_storage.sql`

## Migration `20261008150000_notification_prefs.sql` — Préférences

Table `notification_prefs (user_id, category, mode)` (RLS : chacun les
siennes) + `notification_category(type)`. Remplace `notify_trip_members()`
pour ne plus créer les notifications des catégories coupées (« off »).
Écran : `app/settings/notifications.tsx` (Profil → Notifications).

## Migration `20261008160000_trip_events.sql` — Événements sur place

Table de cache `trip_events` (lecture membres uniquement, écriture par
l'Edge Function `fetch-trip-events` en service_role) + `wishes.event_id`.
Secret requis : `TICKETMASTER_API_KEY` (clé gratuite Ticketmaster Discovery).

## Migration `20261008170000_wish_booking.sql` — « J'ai réservé »

Ajoute `wishes.booked_at`, `booked_by`, `booked_amount`. Le bouton de la fiche
détail (envie validée : logement ou lien de réservation) appelle
`services/bookingService.markWishBooked` : envie marquée réservée, check-in
ajouté au planning (1er jour de l'étape, 15:00) et dépense « Hébergement »
partagée à parts égales entre les membres.

## Migration `20261008180000_document_details.sql` — Infos du billet

Ajoute `documents.details jsonb` (trajet, horaires, passager, siège, porte,
embarquement, référence), saisi à l'ajout pour les vols / trains / activités
et affiché en carte d'embarquement sur l'écran « Billet »
(`app/trip/[id]/document/[docId].tsx`).

## Migration `20261008190000_wish_vibes.sql` — Ambiances des envies

`wishes.vibes text[]` (défaut `{}`) : mêmes valeurs que `trips.vibes` + `insta`. Remplies par l'écran « Nouvelle envie » (`app/trip/[id]/wish/new.tsx`), pré-cochées selon le lieu trouvé.

## Migration `20261008200000_dashboard_realtime.sql` — Dashboard en direct

Ajoute `documents`, `wishes`, `expenses`, `planning_items` à la publication `supabase_realtime` (idempotent) : les tuiles du dashboard se mettent à jour quand un membre ajoute quelque chose.

## Migration `20261009100000_photos_storage.sql` — Album photo

Le bucket `photos` n'avait aucune règle d'accès : tout envoi était refusé. Lecture publique, envoi pour les membres connectés, suppression de ses propres fichiers. Ajoute aussi `trip_photos` et `activity_reviews` au temps réel.

## Données de démo

`supabase/seed/colombia_road_trip.sql` (généré par `node scripts/seed-colombia-trip.mjs`) : road trip terminé en Colombie. À exécuter dans le SQL Editor ou avec `npx supabase db query --linked -f supabase/seed/colombia_road_trip.sql`. Relançable.

## Envoi de fichiers (app)

Tous les envois passent par `services/storageService.ts` (`uploadLocalFile`) : le fichier est lu en binaire avec expo-file-system. Le FormData « façon React Native » (`{ uri, name, type }`) n'est plus accepté par le fetch d'Expo (« Unsupported FormDataPart implementation »).

## Migration `20261009160000_rls_core_tables.sql` — Sécurité des tables principales

RLS activé sur `trips`, `trip_members`, `wishes`, `wish_votes`, `planning_items`, `documents`, `expenses`, `expense_splits`, `invitations`, `friendships`, `profiles` (elles étaient ouvertes à la clé publique). Règle générale : réservé aux membres du voyage. Ajoute un trigger qui crée le profil à l'inscription, et limite l'écriture des buckets `covers` / `avatars` au dossier de l'utilisateur. Test : `supabase/tests/rls_core_test.sql`.

## Migration `20261009170000_wish_comments.sql` — Commentaires sur les envies

La table `wish_comments` n'existait pas : la fiche d'une envie écrivait dans le vide. Réservée aux membres du voyage, on n'écrit et ne supprime que ses propres commentaires ; nom et avatar via `author:profiles(...)`. En temps réel.
