# Edge Function — `generate-match-proposals`

Génère les 3 propositions de destinations d'un Trip Match via l'API Anthropic
(`claude-sonnet-4-6`), les insère dans `match_proposals` (en `service_role`,
qui bypass le RLS) et passe le match en status `voting`.

## Déploiement

```bash
# Lier le projet (une seule fois)
npx supabase link --project-ref tpiwpmqijitzyyujzvqu

# La clé API Anthropic — JAMAIS côté client, uniquement en secret serveur
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# Déployer la fonction
npx supabase functions deploy generate-match-proposals
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont
injectées automatiquement par le runtime Edge — rien à configurer.

## Appel depuis l'app

```ts
const { data, error } = await supabase.functions.invoke("generate-match-proposals", {
  body: { match_id: matchId },
});
// data = { match_id, status: "voting", proposals: [...] }
```

Le JWT de l'utilisateur est transmis automatiquement par `supabase-js`
(la vérification JWT des Edge Functions est activée par défaut).

## Codes d'erreur

| HTTP | `error` | Cas |
|---|---|---|
| 400 | `invalid_body` | `match_id` manquant ou body non-JSON |
| 401 | `unauthorized` | JWT absent/invalide |
| 403 | `not_participant` | L'appelant n'est pas participant du match |
| 404 | `match_not_found` | Match inexistant |
| 409 | `invalid_status` | Le match n'est pas en `collecting` |
| 409 | `responses_incomplete` | Des participants n'ont pas répondu (compte dans `message`) |
| 409 | `already_generating` | Génération concurrente en cours (verrou `proposing`) |
| 500 | `config_error` / `db_error` | Secret manquant ou erreur Postgres |
| 502 | `anthropic_error` / `generation_failed` | API Anthropic en erreur, ou JSON invalide après 2 tentatives |

## Cycle des statuts

```
collecting ──(verrou optimiste)──▶ proposing ──succès──▶ voting
                                       │
                                       └──échec──▶ retour à collecting
```

Le passage `collecting → proposing` est fait **avant** l'appel IA avec un
`UPDATE ... WHERE status = 'collecting'` : deux appels simultanés ne peuvent
pas générer 6 propositions.

## ⚠️ Schéma `answers` attendu

Source de vérité côté app : `types/tripMatch.ts` (`MatchAnswers`). Le jsonb
`answers` de `match_responses` (tous champs optionnels côté fonction) :

```json
{
  "dates": [
    { "start": "2026-07-10", "end": "2026-07-15" },
    { "start": "2026-08-01", "end": "2026-08-09" }
  ],
  "duration": "1 semaine",
  "budget": 600,
  "scope": "europe",
  "environments": ["mer", "montagne"],
  "moods": ["chill", "fête"]
}
```

Agrégation : **intersection des plages** de dates (créneaux communs, transmis
en ISO au prompt), budget **MIN** du groupe, scope le plus restrictif
(`region < pays < europe < monde`), et comptage des "oui" par
durée/environnement/mood.

## Validation de la réponse IA

Le modèle doit renvoyer un tableau JSON strict de 3 propositions
(`destination`, `country_code`, `argument`, `budget_estimate ≤ budget min`,
`best_dates` libellé d'affichage, `start_date`/`end_date` ISO `YYYY-MM-DD`
— validées : format strict, `start_date <= end_date`, postérieures à la date
du jour injectée dans le prompt —, `match_score` 60–100). La fonction strip les éventuels
` ```json `, parse, valide le schéma, et **retente 1 fois** en renvoyant
l'erreur de validation au modèle. Après 2 échecs → 502.
