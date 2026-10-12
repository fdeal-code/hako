# Edge Function — `parse-booking`

Lit une confirmation de réservation (texte d'e-mail collé, PDF ou capture
d'écran) et renvoie les réservations trouvées en JSON strict : vols, trains,
bus, ferries, hôtels, locations de voiture, activités, restaurants.

- Modèle : `claude-opus-5-5`, sorties structurées (`output_config.format`,
  schéma JSON), effort `medium`.
- Repli automatique côté serveur (`fallbacks: "default"`, beta
  `server-side-fallback-2026-07-01`) si le modèle décline une requête.
- **N'écrit rien en base** : l'app affiche le résultat, l'utilisateur corrige,
  puis l'app crée document / planning / dépense avec ses propres droits (RLS).
- Vérifie que l'utilisateur est membre du voyage (lecture du voyage avec son JWT).

## Déploiement

```bash
npx supabase functions deploy parse-booking
```

La clé `ANTHROPIC_API_KEY` est partagée avec `generate-match-proposals`
(`npx supabase secrets set ANTHROPIC_API_KEY=...` si besoin).

## Appel depuis l'app

```ts
const { data, error } = await supabase.functions.invoke("parse-booking", {
  body: { trip_id, text },                                  // e-mail collé
  // body: { trip_id, file: { base64, media_type: "application/pdf" } },
});
// data = { bookings: ParsedBooking[] }
```

## Codes d'erreur

| HTTP | `error` | Cas |
|---|---|---|
| 400 | `invalid_body` / `empty` | trip_id manquant, rien à lire |
| 401 | `unauthorized` | JWT absent ou invalide |
| 403 | `forbidden` | pas membre du voyage |
| 413 | `too_large` | texte > 120 000 caractères ou fichier > 10 Mo |
| 415 | `unsupported_file` | autre chose que PDF / JPEG / PNG / WebP / GIF |
| 422 | `refused` / `too_long` | lecture déclinée ou réponse tronquée |
| 429 | `rate_limited` | trop de demandes |
| 502 | `llm_*` | erreur de l'API ou réponse illisible |

## Plus tard : transfert par e-mail

Pour une adresse du type `voyage@import.hako.app`, il faudra un nom de domaine
et un service de réception d'e-mails (Postmark, Mailgun, Cloudflare Email
Workers…) qui appelle une fonction serveur avec le texte du message ; la
logique d'extraction ci-dessus pourra être réutilisée telle quelle.
