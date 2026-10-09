# Edge Function — `fetch-trip-events`

Récupère les événements (concerts, sport, spectacles…) autour de chaque étape
d'un voyage, aux dates de l'étape, via **Ticketmaster Discovery API**, et les
met en cache dans `trip_events` (24 h). Migration requise :
`20261008160000_trip_events.sql`.

## Déploiement

```bash
npx supabase secrets set TICKETMASTER_API_KEY=xxxx   # clé gratuite : developer.ticketmaster.com
npx supabase functions deploy fetch-trip-events
```

## Appel depuis l'app

```ts
await supabase.functions.invoke('fetch-trip-events', { body: { trip_id: tripId } });
// puis lecture : services/eventsService.getTripEvents(tripId)
```

`force: true` ignore le cache (ex. après modification des dates).

## Codes d'erreur

| HTTP | `error` | Cas |
|---|---|---|
| 400 | `invalid_body` | `trip_id` manquant |
| 401 | `unauthorized` | JWT absent/invalide |
| 403 | `forbidden_or_no_stops` | pas membre, ou voyage sans étape |
| 500 | `missing_ticketmaster_key` | secret non configuré |
