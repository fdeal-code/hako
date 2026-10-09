# HAKO — Specs des nouvelles features

Référence détaillée pour chaque feature de la roadmap. Claude Code peut consulter ce fichier quand il travaille sur une feature spécifique.

---

## 🗳 Sondages rapides (Quick Polls) — P1

### Problème
Dans un groupe WhatsApp, dès qu'il faut décider quelque chose à plusieurs, c'est le chaos : 15 messages, 3 qui répondent pas, personne ne tranche.

### Types de sondages
- **Choix simple** — "On mange où ce soir ?" (1 seule réponse)
- **Choix multiple** — "Quelles activités vous tentent ?" (plusieurs réponses)
- **Date picker** — "Quel jour on fait la rando ?" (chacun coche ses dispos)
- **Wish poll** — Sélectionner des wishes de la wishlist comme options

### UX
- Création rapide depuis le trip (bouton + dans le header ou tab dédié)
- Notification push aux membres quand un poll est créé
- Résultats en temps réel avec avatars des votants
- Option "deadline" pour forcer une décision
- Le créateur peut clôturer le sondage manuellement

### Tables Supabase
```sql
polls: id, trip_id, creator_id, question, type (enum), deadline, is_closed, created_at
poll_options: id, poll_id, label, wish_id (nullable), order
poll_votes: id, poll_option_id, user_id, created_at
```

### Liens avec l'existant
- Remplace partiellement le système de votes sur les wishes (plus flexible)
- Le résultat d'un poll peut générer un `planning_item`

---

## 🗳 Envies, votes & inspirations TikTok/Reels — P1
> Fusionne l'ancien « Feed d'inspiration » dans les Envies : pas d'onglet en plus. Un TikTok/Reel = une façon de créer une envie.

### Problème
Les 18-30 ans découvrent des spots sur TikTok/Instagram, s'envoient les liens sur WhatsApp, et tout se perd. Et quand il faut décider à plusieurs, personne ne tranche.

### Cycle de vie d'une envie
`On t'aide ➕ / lien TikTok / lieu / note` → **À voter** → **Validée** (majorité) → **Réservée / Planifiée** — ou **Écartée**

### Sources d'une envie
- **Lien TikTok / Reel / YouTube** : détection du presse-papier (« Lien TikTok copié → Coller »), oEmbed (miniature, légende, auteur)
- **Lieu** (Google Places), **Idée Hako** (On t'aide), **Note d'orga**
- **Share Sheet natif** depuis TikTok/Insta (voir section suivante)

### Lieu détecté (inspirations)
oEmbed ne donne **pas** la localisation → extraire un nom de lieu de la légende/titre puis le valider via Google Places. Rangement auto dans l'étape correspondante (`stop_id`). Toujours un bouton « Modifier ».

### UX (maquettes « 5 · Envies & votes »)
- **À voter** : filtres statut (À voter / Validées / Toutes / Écartées) + ville ; carte = photo/vidéo, type, prix/pers, avatars avec vote, barre de progression, boutons **Bof / Partant !** directement sur la carte
- **Détail vote** : vote + petit commentaire de chacun, bouton **Relancer** (rappel aux retardataires)
- **Validée à réserver** : lien partenaire → « J'ai réservé » → ajout auto au Planning + dépense dans le Budget
- **Validées** : groupées par ville, statut Réservé / Planifié (date) / + Planifier / Réserver ↗
- **Nouvelle envie** (bouton ➕) et **Aperçu TikTok** (vidéo + lieu trouvé + ambiances)

### Règles (à confirmer)
- Validation auto à la **majorité** des membres
- « Bof » compte contre ; option future « Non, vraiment pas » = veto
- Fermeture auto des votes (ex. 48 h ou J-7)

### Tables Supabase
```sql
wishes: + status (to_vote|validated|rejected|booked|planned), source (place|tiktok|instagram|youtube|hako|note),
          url, oembed_data (jsonb), stop_id, event_id, tags text[], price_per_person
wish_votes: id, wish_id, user_id, vote (yes|no|veto), comment, created_at   -- table existante enrichie
```
`inspirations` / `inspiration_reactions` ne sont plus nécessaires.

### Différenciation
Le pont entre découverte (réseaux sociaux) et décision de groupe : la vidéo devient un lieu, sur la carte, votée, puis réservée.

---

## 🔗 Share Sheet natif — P1

### Problème
Pour ajouter une inspi TikTok : ouvrir TikTok → copier le lien → ouvrir HAKO → aller dans le trip → coller. Trop de friction.

### Flow
1. L'utilisateur voit un TikTok qui lui plaît
2. Appuie sur "Partager" → choisit HAKO dans la liste
3. Mini-écran HAKO : choix du trip + bouton "Ajouter"
4. L'inspi devient une envie « À voter » dans le trip (lieu détecté → bonne étape)
5. Les autres reçoivent une notification

### Technique
- **iOS** : Share Extension (app group pour partager le token d'auth)
- **Android** : Intent Filter / Share Target API
- **Expo** : nécessite module natif custom ou `expo-share-intent` (community)
- Doit fonctionner même si l'app n'est pas ouverte

### Liens
- Crée une `wish` avec `source = tiktok|instagram`
- Réutilise le système oEmbed existant

---

## 📲 Deep links WhatsApp — P1

### Points de partage
- **Nouveau sondage** → "Votez les gars !" + lien vers le sondage
- **Nouvelle inspi** → "Regardez ce que j'ai trouvé" + preview + lien
- **Invitation au trip** → "Rejoins notre voyage !" + lien d'invitation
- **Résultat roulette** → "C'est Pierre qui régale ce soir 🎉"
- **Planning du jour** → "Voilà le programme d'aujourd'hui"

### Technique
- API `Linking.openURL('whatsapp://send?text=...')` de React Native
- Universal Links (iOS) + App Links (Android)
- Fallback web si app pas installée → page d'invitation + bouton "Télécharger HAKO"
- Nécessite un domaine web (ex: `app.hako.travel`)

### Stratégie
Chaque lien partagé sur WhatsApp = pub gratuite. WhatsApp est le canal d'acquisition, pas le concurrent.

---

## 📸 Stories/Moments du voyage — P2

### Problème
Pendant le voyage, les photos sont éparpillées entre les galeries de chacun. Après le trip, "envoie-moi tes photos" → personne ne le fait.

### Fonctionnalités
- **Post de photos** depuis la galerie ou l'appareil photo
- **Timeline chronologique** des moments du groupe
- **Géolocalisation automatique** (optionnelle) → moments sur la carte
- **Réactions et commentaires** courts
- **Téléchargement groupé** → "Télécharger toutes les photos du trip"
- **Lien avec le planning** → moments sous le jour correspondant

### Tables Supabase
```sql
moments: id, trip_id, user_id, image_url, caption, latitude, longitude, planning_day_id (nullable), created_at
moment_reactions: id, moment_id, user_id, emoji, created_at
moment_comments: id, moment_id, user_id, text, created_at
```

### Technique
- Storage : bucket Supabase `moments` (compression images côté client)
- Attention volume stockage free tier
- Upload en arrière-plan avec barre de progression

### Différenciation
Wanderlog a un "Trip Journal" mais post-voyage et solo. HAKO fait du live collaboratif.

### Suite
Les moments alimentent l'**Album souvenir imprimé** (voir plus bas) → garder une version HD des photos.

---

## 🏷 Tags d'ambiance — P2

### Tags disponibles
- 🧘 **Chill** — plage, spa, balade tranquille
- ⚡ **Aventure** — rando, sport, exploration
- 🍜 **Foodie** — restaurants, street food, marchés
- 🏛 **Culture** — musées, monuments, histoire
- 🌟 **Nightlife** — bars, clubs, rooftops
- 🛍 **Shopping** — marchés, boutiques, souvenirs
- 📸 **Insta spot** — lieux photogéniques

### Fonctionnalités
- **Multi-tag** → un restaurant rooftop peut être Foodie + Nightlife
- **Filtre rapide** sur wishlist et planning
- **Mood du jour** → "Aujourd'hui on est mode chill" → wishes correspondantes
- **Tag auto (V2)** → suggérer un tag via le type de lieu Google Places

### Modèle de données
Option simple : colonne `tags text[]` sur la table `wishes`

### Intégration
- S'intègre aux `FilterButton` existants
- Tags visibles sur les `AnimatedCard` de la wishlist

---

## 🏆 Gamification (Badges/Titres) — P2

### Badges
| Badge | Condition | Emoji |
|---|---|---|
| Le Planificateur | Le plus de wishes ajoutées | 📋 |
| Le Retardataire | Vote en dernier aux sondages | 🐢 |
| Le Foodie | Le plus de restos ajoutés | 🍜 |
| Le Photographe | Le plus de stories postées | 📸 |
| L'Indécis | Change le plus souvent ses votes | 🤷 |
| Le Généreux | A le plus payé | 💸 |
| Le Radin | A le moins payé | 🧐 |
| L'Influenceur | Le plus d'inspi partagées | ✨ |

### UX
- Badges sur le profil de chaque membre dans le trip
- Récap fun en fin de trip : "Les awards du voyage" + confettis
- Partageable en story Instagram

### Technique
- **Aucune table supplémentaire** : calculé côté client
- Hook `useTripBadges(tripId)` qui agrège les stats depuis wishes, votes, expenses, moments
- Recalculé à chaque ouverture du trip

---

## 🎰 Qui paye ? (Roulette) — P3

### Fonctionnalités
- **Roulette animée** avec avatars des membres du trip
- **Historique** → "Pierre a payé 3 fois, Marc 1 fois"
- **Pondération intelligente** → celui qui a le moins payé a plus de chances
- **Lien budget** → crée automatiquement une dépense
- **Mode fun** → sons, vibrations, suspense, confettis

### UX
- Bouton 🎰 dans le header du module budget
- Animation react-native-reanimated (rotation + rebond)
- Bouton "Ajouter la dépense" qui pré-remplit le formulaire

### Technique
- Pas de table supplémentaire
- Pondération côté client à partir des `expenses`
- Animation pure avec react-native-reanimated

---

## 🎫 Import réservations (V2) — P3

### Options par ordre de complexité

**Option A : Forward d'email (recommandé pour commencer)**
- Adresse type `trip-abc123@import.hako.app`
- Parser serveur extrait date, lieu, numéro de réservation
- Crée un document + un planning_item

**Option B : OAuth Gmail**
- Scan automatique des emails de réservation
- Parser les formats Booking, Airbnb, Airlines

**Option C : OCR mobile**
- Scanner un billet avec l'appareil photo
- Plus aligné avec l'usage mobile-first

---

## 🗺 Voyages multi-étapes — P1 (fondation)

### Problème
Un trip = une seule `destination: string` (cf. `constants/types.ts`). Impossible de gérer un road trip, plusieurs villes ou plusieurs hôtels. Bloque aussi les Événements et les Logements (il faut savoir **où** on est **quel jour**).

### Concept
Un voyage = une suite d'**étapes** (ville + dates + logement optionnel). Un voyage simple = 1 seule étape, jamais affichée comme telle → l'UI ne change qu'à partir de 2 étapes.

### UX (maquettes Figma « Maquette VF » : Créer 1b, Créer 3b, Itinéraire)
- **Création** : « + Ajouter une autre ville » sous la recherche, étapes numérotées et réordonnables (drag)
- **Répartition des nuits** : barre colorée + steppers −/+ par ville (« 7 / 7 nuits réparties »)
- **Itinéraire** : timeline des étapes avec statut du logement (✓ ou « Trouver ») + trajets entre étapes
- Transformer un voyage simple en multi-étapes après coup (« + Ajouter une étape »)

### Impact sur l'existant
| Module | Changement |
|---|---|
| Dashboard | Frise des étapes, étape en cours mise en avant |
| Planning | Séparateurs d'étape + trajets comme items `transport` |
| Carte | Tracé entre étapes + filtre (⚠️ `ExpandedMapView` **et** `map.tsx`) |
| Envies / Budget | Rattachement + filtre par étape |
| Événements / Logements | Recherche **par étape** |

### Tables Supabase
```sql
trip_stops: id, trip_id, position, place_name, place_id, lat, lng, country_code,
            start_date, end_date, created_at

-- colonnes nullable
wishes.stop_id, planning_items.stop_id, expenses.stop_id → trip_stops.id
```
Les logements restent des `planning_items` (type logement) rattachés via `stop_id`.

### Migration
1. Créer `trip_stops` → 2. une étape par trip existant (depuis `destination`/dates) → 3. garder `trips.destination` comme libellé auto (« Rome, Florence +1 ») → 4. migrer écran par écran.

### Cas limites
- Jour de transfert = appartient aux 2 étapes
- Même ville 2 fois (Rome → Florence → Rome) = 2 lignes distinctes
- 2 hôtels dans la même ville = pas d'étape, juste 2 logements
- Suppression d'étape → demander quoi faire des envies/dépenses rattachées

---

## 🎟 Événements sur place — P1

### Problème
On découvre le festival ou le match en rentrant. Personne ne fouille 5 sites en préparant le voyage.

### Concept
Hako connaît destination + dates → affiche automatiquement concerts, expos, matchs, fêtes locales **pendant le séjour**, ajoutables aux envies en 1 tap (→ votes → planning avec l'heure pré-remplie).

### UX (maquettes : Envies · Événements, Détail événement, Créer 6 · C'est parti)
- **Fin de création** : écran « C'est parti ! » avec les événements du séjour
- **Dashboard** : carte « Pendant ton séjour » + badge Nouveau
- **Envies** : filtre « Événements », groupés par jour, bouton ➕ → ✓

### Sources
| API | Usage |
|---|---|
| Ticketmaster Discovery (gratuit, 5 000 appels/jour) | Source principale |
| OpenAgenda (gratuit) | Culture en France |
| PredictHQ (payant) | Plus tard |
| ~~Eventbrite~~ | API de recherche publique fermée |

Les **activités** (surf, kayak…) ne sont pas des événements datés → voir Logements & activités.

### Architecture
`useTripEvents → eventsService → Edge Function fetch-events → API` + cache 24 h dans `trip_events`. Clé API jamais dans l'app. Fetch lancé en arrière-plan à la création du trip.

### Tables Supabase
```sql
trip_events: id, trip_id, stop_id, source, external_id, title, category,
             starts_at, ends_at, venue_name, lat, lng, price_min, price_max,
             currency, image_url, ticket_url, fetched_at
             UNIQUE(trip_id, source, external_id)
wishes.event_id → trip_events.id (nullable)
```

### Cas limites
Aucun résultat (état vide sympa), voyage lointain (refetch plus tard), dates modifiées (vider le cache), destination large (rayon ~30 km), prix inconnu (« Prix sur le site »).

---

## 🏨 Logements & activités (affiliation) — P1

### Concept
Pour chaque étape, Hako suggère des logements et activités dispo aux dates du groupe. Le groupe **vote d'abord** (➕ = ajouter aux envies), puis quelqu'un réserve via un **lien affilié** → commission pour Hako, 0 € de plus pour l'utilisateur.

### UX (maquettes : Créer 6 · C'est parti, Itinéraire, Logements · Florence)
- « Où dormir ? » par étape : nb de logements dispo + prix de départ
- Liste : photo, note, prix total + prix/pers, bouton partenaire (↗) + ➕ vote
- Filtres : Tout / Apparts / Hôtels / Auberges
- Mention obligatoire : « Liens partenaires : Hako touche une petite commission, sans frais en plus pour toi. »

### Partenaires (taux indicatifs, à vérifier à l'inscription)
| Partenaire | Type | Commission ≈ |
|---|---|---|
| Booking.com | Logements | 25-40 % de la com Booking (~4-6 % du séjour) |
| Expedia Group (Vrbo, Hotels.com) | Logements / apparts | ~3-6 % |
| Hostelworld | Auberges | ~5-7 % |
| GetYourGuide / Viator | Activités | ~8 % |
| ~~Airbnb~~ | — | Programme fermé depuis 2021 |

👉 Démarrer via un agrégateur (**Stay22**, **Travelpayouts**) : une inscription, plusieurs marques.

### Technique
- V1 : deep links vers une recherche pré-filtrée (ville, dates, voyageurs) + « dès X € »
- V2 : vraies dispos/prix via API partenaire (accès sur validation, souvent avec volume)
- Liens générés côté Edge Function (identifiant affilié jamais en dur dans l'app)
- Ouverture dans le navigateur / in-app browser (OK App Store)

### Filtres : style & budget (dernière étape de la création, optionnelle)
- **Type de voyage** (multi) : Chill, Aventure, Foodie, Culture, Fête, Nature (mêmes valeurs que les Tags d'ambiance)
- **Budget par personne, hors transport** : slider 200 € → 1 500 €+ (« Serré / Tranquille / Confort »)
- Hako traduit le budget : ≈ X €/nuit/pers pour les logements, ≈ Y €/jour/pers pour les activités
- Sur « On t'aide » : pastille « Vos filtres » modifiable à tout moment
```sql
trips.vibes text[]               -- ['foodie','culture']
trips.budget_per_person integer  -- en centimes, nullable
```

### Règle d'or
Ne **jamais** trier par commission. Tri par note / prix / distance, sinon perte de confiance.

---

## 📖 Album souvenir imprimé — P2

### Problème
Après le voyage, les photos dorment dans les galeries. Personne ne fait l'album. Pourtant tout le monde en voudrait un.

### Concept
En fin de voyage : « Votre album est prêt 📖 ». Hako génère automatiquement un album photo à partir des **Moments** du groupe. Chacun peut commander son exemplaire, imprimé et livré par un service d'impression à la demande. Marge ≈ **10-20 € par album**.

### Génération automatique
- **Couverture** : cover du trip + nom + dates
- **Une section par étape / par jour** (lien multi-étapes + planning)
- **Photos les plus likées en grand**, légendes des moments
- **Page carte** de l'itinéraire (étapes reliées)
- **Page stats** : « 7 nuits · 3 villes · 14 envies · 1 248 € dépensés »
- **Page awards** : badges de la Gamification (Le Retardataire, Le Foodie…)
- **Page signatures** : un petit mot de chaque membre (optionnel)

### UX
- Notification J+2 après la fin du trip : « Votre album est prêt »
- Aperçu feuilletable (swipe des pages, animation reanimated)
- Édition légère : retirer / remplacer une photo, changer la cover
- Commande : quantité, format (souple / rigide), adresse
- **Commande groupée** : 1 personne commande pour tous → dépense auto dans le Budget, répartie entre les membres
- Partage de l'aperçu en story Instagram (pub gratuite pour Hako)

### Tables Supabase
```sql
photobooks: id, trip_id, status (draft|ready|ordered), cover_moment_id,
            layout (jsonb), page_count, created_at
photobook_orders: id, photobook_id, user_id, quantity, format, price_cents,
                  currency, provider, provider_order_id, status,
                  shipping_address (jsonb), created_at
```

### Technique
- Impression à la demande via API (comparer **Gelato**, **Prodigi**, **Peecho** : prix, délais, livraison UE)
- Paiement **Stripe** : bien physique → pas d'achat in-app Apple/Google obligatoire (pas de 30 %)
- ⚠️ **Photos HD nécessaires** : Moments compresse côté client → garder l'original (ou upload HD en différé) pour l'impression
- Génération du PDF côté serveur (Edge Function) à partir de `layout`
- Attention stockage free tier Supabase

### Prix indicatif
Album 24 pages ≈ 12-18 € de coût (impression + livraison) → vendu 29-39 € → marge 10-20 €.

---

## 💰 Monétisation (sans pub)

Principe : **aucune pub / popup**. On gagne de l'argent en rendant service.

| Ordre | Source | Comment |
|---|---|---|
| 1 | **Affiliation logements + activités** | Voir section dédiée (~50-70 € par voyage tout réservé via Hako) |
| 2 | **eSIM + location de voiture** | Airalo/Holafly (~10-15 %), DiscoverCars ; proposés dans Documents et sur les trajets « voiture à prévoir » |
| 3 | **Pass voyage** (~4,99 €/voyage, partagé par le groupe) | Débloque : > 2 étapes, budget multi-devises, docs hors-ligne, album illimité. La base reste gratuite. Pas d'abonnement. |
| 4 | **Album souvenir imprimé** | Marge 10-20 € / album |
| 5 | Plus tard : offre groupes (asso étudiantes, EVJF/EVG) | — |

Hypothèse : 1 voyage sur 3 réserve via Hako → ~15-20 € d'affiliation par voyage créé, hors pass et album.

---

## 📅 Planning multi-étapes — P1
> Complète « Voyages multi-étapes ». Maquettes « 6 · Planning ».

### UX
- **Bandeau des jours** (remplace Jour 1 / Jour 2…) : MAR 02 → MAR 09, un point de couleur par ville ; jour de transfert = 2 points
- **Séparateur d'étape** dans la timeline : « Arrivée à Florence · Étape 2 · 05 → 07 juin »
- **Trajets** = items `transport` (carte noire, « 1 h 30 · billets ✓ »)
- **Planifier une envie** (depuis Envies validées) : seuls les jours de l'étape sont proposés, créneau conseillé (partenaire), aperçu de la journée + détection de conflit
- Un voyage à 1 ville = même écran, une seule couleur

### Données
`planning_items` : + `stop_id`, `type` (activity|lodging|transport|note), `wish_id`, `ends_at` (pour détecter les conflits).

---

## 🔔 Notifications — P1
> Maquettes « 7 · Notifications ». C'est ce qui fait revenir les utilisateurs.

### Centre de notifications
- **À faire** (non lu = point orange) avec **action directe** : Voter, Je m'en occupe (réserver), Régler (dette)
- **Activité** : nouvelle envie / TikTok, nouveau membre, dépense ajoutée
- Chaque notif mène à l'écran concerné (deep link interne)

### Push (ton)
Courts, complices, jamais génériques :
- « Hugo te relance : le kayak n'attend plus que ton vote »
- « C'est validé ! L'Auberge Trastevere a gagné 3 votes sur 4. Qui réserve ? »
- « J-7 avant l'Italie : passeport, eSIM, assurance, on vérifie ensemble ? »

### Règles anti-spam (réglages)
| Catégorie | Envoi | Défaut |
|---|---|---|
| Votes & décisions | Direct | ON |
| Dépenses | Direct | ON |
| Le groupe | Direct | ON |
| Nouvelles envies | Résumé du soir (1×/jour) | ON |
| Idées Hako (affiliation) | **Max 1×/semaine** | ON, désactivable |
| Silence de nuit | 23:00 → 08:00 | ON |

« Hako ne t'enverra jamais de pub. »

### Technique
- `expo-notifications` + token stocké sur `profiles.push_token`
- Envoi depuis Edge Functions (triggers sur `wish_votes`, `expenses`, `trip_members`…)
- Regroupement des résumés via tâche planifiée (cron Supabase)
```sql
notifications: id, user_id, trip_id, type, payload (jsonb), action (vote|book|settle|open),
               read_at, created_at
notification_prefs: user_id, category, mode (instant|digest|off), quiet_start, quiet_end
```

---

## 📄 Documents — P1
> Maquettes « 8 · Documents ».

### UX
- **Checklist « Prêt pour le départ ? · J-7 »** : passeport, billets, logements, **eSIM**, **assurance** → les manquants proposent un lien partenaire (affiliation au bon moment)
- Documents **groupés par étape**, filtres Tout / Billets / Logements / Perso
- ☁︎ dispo hors connexion ; 🔒 **Perso** (passeport) visible uniquement par son propriétaire
- **Billet** : un onglet par voyageur (un PDF de 4 billets découpé par personne), QR code, « Ajouter à Wallet »
- **Ajouter** : Scanner, Importer (PDF / capture), **transfert d'e-mail** vers une adresse propre au trip → reconnaissance auto (« Train → Florence · ajouté au planning »)

### Technique
- Bucket `documents` existant ; cache local (`expo-file-system`) pour le hors-ligne
- V1 : upload + choix manuel du voyageur / de l'étape ; V2 : parsing auto (voir « Import réservations »)
- Wallet : génération `.pkpass` côté serveur (V2)
```sql
documents: + stop_id, owner_id, visibility (group|private), traveler_id (nullable),
             kind (flight|train|lodging|ticket|id|other), parsed (jsonb), planning_item_id
trip_checklist: id, trip_id, item (passport|tickets|lodging|esim|insurance|custom), done_by, done_at
```

---

## 🏠 Accueil & invitation — P1
> Maquettes « 9 · Accueil ».

### Accueil (utilisateur actif)
- **Invitation en attente** en haut (Rejoindre / ✕)
- **Carte du prochain voyage** : photo, **compte à rebours J-x**, avatars, itinéraire, et **la prochaine action** (« 3 envies attendent ton vote → »), même logique que la carte « Prochaine étape » du dashboard
- **Autres voyages** : en préparation / passés, badge **« Album prêt »** (porte d'entrée vers l'album imprimé)

### Premier lancement
« Ton premier voyage commence ici » → **Créer un voyage** / **J'ai un lien d'invitation** + « Comment ça marche » en 3 étapes.

### Invitation reçue (lien WhatsApp) — écran d'acquisition clé
- Visible **avant** création de compte : cover, « Hugo t'invite », dates, budget/pers, membres déjà dedans, nb d'envies
- **Rejoindre le voyage** → inscription 30 s (Apple / Google) → arrivée directe dans le trip
- Lien = Universal Link / App Link (voir « Deep links WhatsApp »), fallback page web avec le même aperçu + liens stores
