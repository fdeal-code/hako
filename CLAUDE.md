# HAKO — Contexte projet

> App mobile collaborative de planification de voyage (iOS/Android)
> "La boîte où tu mets tout pour organiser un voyage entre potes"

## Stack

- React Native + Expo Router
- Supabase (Auth, Database PostgreSQL, Storage) — 21 tables, RLS activé, triggers automatiques, 4 buckets Storage
- react-native-reanimated (animations)
- APIs : Google Places, Unsplash, oEmbed (TikTok/Reels)
- Ionicons (icônes — UNIQUEMENT Ionicons, jamais d'autre lib)
- TypeScript strict (`noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`)
- Repo : `fdeal-code/hako`
- Supabase : `tpiwpmqijitzyyujzvqu.supabase.co`

## Architecture

```
Screen → Hook → Service → Supabase
```

Ordre de développement pour chaque feature :

```
Types → Service → Hook → UI Components → Screen
```

Développer **step by step**, feature par feature, jamais tout d'un coup.

## Design System — Extrait des maquettes Figma

**ZÉRO valeurs hardcodées** : tout référence les tokens du thème.

### Couleurs

- `bg.primary` : `#f7f9fb` (fond d'écran)
- `bg.card` : `#ffffff` (cartes et listes)
- `bg.dark` : `#1c1c1c` (filtre actif, boutons primaires)
- `bg.overlay` : `rgba(0,0,0,0.2)` (overlay sur images)
- `text.primary` : `#000000` / `#1c1c1c`
- `text.secondary` : `#8e8e8e`
- `text.subtle` : `#cccccc`
- `color.positive` : vert (montants positifs budget)
- `color.negative` : rouge/coral (montants négatifs budget)
- Badge Organisation : gradient `rgba(67,100,61,0.8)` → `rgba(45,78,46,0.6)`
- Badge TikTok : gradient `rgba(255,65,5,0.6)` → `rgba(255,65,5,0.4)`

### Glassmorphisme (3 niveaux)

- Composants (badges, filtres) : blur `5px`, gradient `rgba(255,255,255,0.5)` → `rgba(255,255,255,0.15)`, border white
- Navigation & boutons action : blur `10px`, gradient `rgba(255,255,255,0.7)` → `rgba(255,255,255,0.2)`, border `rgba(255,255,255,0.8)`
- Cards Organisation : blur `10px`, gradient `rgba(230,230,230,0.6)` → `rgba(128,128,128,0.4)`

### Typographie

- `SF Pro` : interface (titres, nav, badges, filtres)
- `Inter` : contenu (listes, descriptions)
- Titre page : SF Pro Black 28px (1000) — ou 32px pour "Vos envies"
- Titre hero : SF Pro Black 98px (nom de destination sur card voyage)
- Section : SF Pro Semibold 20px (590)
- Body : Inter Medium 14px / 12px pour sous-texte
- Filter/Badge : SF Pro Medium 14px (510)

### Spacing (grille 8px)

- `4px` micro-gap | `8px` entre composants | `12px` padding badges | `16px` gap sections | `20px` padding écran | `24px` padding badges | `32px` padding card voyage

### Radius

- `16px` listes/petites cartes | `20px` cartes voyage | `24px` large | `30px` pills (filtres/badges) | `99px` boutons circulaires

### Ombres

- Subtle : `0px 4px 16px rgba(0,0,0,0.06)` (listes)
- Standard : `0px 10px 30px rgba(0,0,0,0.1)` (cartes, filtres)
- Heavy : `0px 10px 30px rgba(0,0,0,0.25)` (navigation)

### Composants Figma identifiés

- **Filtre** : pill active (dark) / disable (white), 2 variants
- **Badge** : glassmorphism pill info (sur cards voyage)
- **Badge User** : avatar circulaire 42px (listes) ou 36px (wishlist cards), stack avec margin -12/-16px
- **Card Voyage** : 353×400px, image + overlay + hero text 98px + avatars
- **Card Text** : 353×56px, avatar + titre + sous-titre + chevron
- **Card Wish Orga** : glassmorphism, badge vert, texte, avatars
- **Card Wish TikTok** : image fond, badge coral/vert, bouton play 56px, footer titre + auteur
- **Menu** : nav flottante glassmorphism, tabs 64px, heavy shadow
- **Action Button** : circulaire 48-56px, glassmorphism

### Patterns par page

- **Accueil** : header (avatar + nom + settings), titre, filtres, cards voyage scrollables
- **Envie** : masonry 2 colonnes, cards wish de hauteurs variables, nav bottom (back + add + filter)
- **Planning** : tabs jour, timeline (heure gauche + ligne verticale + cards droite), séparateurs jour
- **Budget** : montant hero centré, 3 stat boxes, dettes colorées (vert/rouge), liste dépenses
- **Documents** : filtres pills, liste Card Text avec thumbnails emoji
- **Carte** : fond gradient vert, points d'intérêt, filtres, liste Card Text en bas

## État actuel du projet

### ✅ Phase 1 — Fondations (TERMINÉ)

- Expo Router avec navigation complète (auth guard, stacks, tabs du trip)
- TypeScript strict configuré
- Design system complet : 5 fichiers de tokens + 8 composants atomiques
- Supabase : client typé, migration SQL complète (21 tables, RLS sur tout, triggers auto), 4 buckets Storage
- Auth : Welcome, Login, Register 3 étapes avec `StepIndicator` animé

### ✅ Phase 2 — Core loop (TERMINÉ)

- Home avec liste des trips, FAB, état vide illustré, salutation contextuelle
- Création de trip en 5 étapes : Google Places autocomplete → nom (avec suggestions) → date picker natif → grille Unsplash → invitation d'amis
- Dashboard du trip avec hero cover, countdown, membres, raccourcis et actions rapides

### ✅ Phase 3b — Multi-étapes, aide & votes (code prêt, migrations à appliquer)

> Migrations à appliquer dans l'ordre : voir `supabase/README.md` (4 fichiers `20261008*`).

- **Voyages multi-étapes** : table `trip_stops` (`types/tripStops.ts`, `services/tripStopService.ts`, `hooks/useTripStops.ts`, calculs purs dans `utils/tripStops.ts`)
- **Création en 6 étapes** : Destinations (1+ villes) → Dates → *Une nuit, un lieu* (si plusieurs villes) → Qui embarque → Nom & couverture → Style & budget (`components/createTrip/`)
- **Itinéraire** : `app/trip/[id]/itinerary.tsx` (réordonner, ajouter, retirer une ville, répartir les nuits)
- **Cartes** : étapes + tracé sur les DEUX cartes (`ExpandedMapView` et `map.tsx`) via `components/map/StopMarkers.tsx`
- **Planning** : points de couleur par ville, bandeau « où est-on » / jour de transfert, `stop_id` sur les items
- **Dashboard** : carte coupée en deux + Vos envies (compteur « à voter »), tuile **On t'aide** + Budget
- **On t'aide** : `app/trip/[id]/help.tsx`, liens partenaires pré-filtrés (`utils/affiliateLinks.ts`)
- **Envies** : vote à la **majorité** (`utils/wishVotes.ts`), relance WhatsApp, rangement auto dans la ville la plus proche + filtre par ville
- **Documents** : checklist « Prêt pour le départ ? » partagée (`trip_checklist`) avec eSIM / assurance partenaires
- **Notifications** : activité des voyages (triggers SQL) dans la sheet de la cloche (`components/notifications/TripActivityList.tsx`)
- **Accueil** : « Prochain voyage · J-x » + « n envies à voter » sur la carte voyage
- **Lien d'invitation** : `app/join/[token].tsx` (aperçu sans compte → connexion → rejoindre), bouton WhatsApp dans `InviteSheet`
- **Budget** : répartition par ville, `stop_id` sur les nouvelles dépenses
- **Événements sur place** : Edge Function `fetch-trip-events` (Ticketmaster, cache 24 h dans `trip_events`) → onglet Activités de « On t'aide », ajout aux envies en 1 tap
- **Réglages notifications** : `app/settings/notifications.tsx` (`notification_prefs`, triggers qui respectent « off »)
- **Tests** : `npm run test:utils` (fonctions pures de `utils/`, lanceur intégré de Node ≥ 22, sans dépendance)

### ➡️ Phase 3 — En cours

- **Module Wishes** : les 3 types de cartes (Lieu, Inspi, Orga), votes +1/-1, mood tags, filtres

### 📋 Phase 4+ — À venir (voir docs/FEATURES.md pour les specs détaillées)

- 🗳 Sondages rapides (Quick Polls)
- 📱 Feed d'inspiration partagé
- 🔗 Share Sheet natif
- 📲 Deep links WhatsApp
- 📸 Stories/Moments du voyage
- 🏆 Gamification (Badges/Titres)
- 🎰 Qui paye ? (Roulette)
- 🎫 Import réservations

## Base de données Supabase

### Tables (21 au total — migration SQL complète avec RLS et triggers)

Tables principales :

- `trips`, `trip_members`, `wishes`, `wish_votes`, `planning_items`
- `documents`, `expenses`, `expense_splits`
- `invitations`, `friendships`, `profiles`

### Storage buckets (4)

- `avatars` — photos de profil
- `covers` — images de couverture des trips
- `documents` — fichiers partagés
- (4e bucket à vérifier dans la migration)

### Sécurité

- ✅ RLS activé sur toutes les tables (avec triggers automatiques)
- `.env` non tracké par git → recréer avec :
  - `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — ⚠️ pas `..._GOOGLE_PLACES_...` : c'est ce nom exact que lit le code (autocomplete + geocoding ; activer les APIs "Places" ET "Geocoding" sur la clé)
  - `EXPO_PUBLIC_UNSPLASH_ACCESS_KEY` (photos destinations/covers)
  - Optionnels — identifiants affiliés (sans eux les liens marchent, sans commission) :
    `EXPO_PUBLIC_BOOKING_AID`, `EXPO_PUBLIC_HOSTELWORLD_AFFILIATE`, `EXPO_PUBLIC_GETYOURGUIDE_PARTNER_ID`,
    `EXPO_PUBLIC_VIATOR_PID`, `EXPO_PUBLIC_AIRALO_REF`, `EXPO_PUBLIC_HEYMONDO_REF`

## ⚠️ PIÈGES CRITIQUES

### 1. Carte — un seul écran

Depuis octobre 2026, toutes les cartes ouvrent **`app/trip/[id]/map.tsx`** (plein écran, maquette « Carte »). `components/map/ExpandedMapView.tsx` n'est plus utilisé (gardé pour mémoire). Briques : `components/map/TripMapParts.tsx`, données `hooks/useTripMap.ts`, calculs `utils/tripMap.ts`.

### 1b. Deux dashboards

Ouvrir un voyage depuis l'accueil affiche `components/home/ExpandedDashboard.tsx` (overlay animé), **PAS** `app/trip/[id]/dashboard.tsx`. Les tuiles sont partagées : `components/dashboard/FutureBento.tsx` (à venir), `components/ongoing/NowCard.tsx` + `FutureBento` (en cours : carte noire « en ce moment » au-dessus des tuiles habituelles), `components/past/PastBento.tsx` (terminé) → modifier là, les deux dashboards suivent.

### 2. Debugging — première étape

Quand une feature ne marche pas → ajouter des `console.log` AVANT de changer du code :

- Données `undefined` ?
- Mauvais composant édité ?
- Requête Supabase avec erreur de relation ?

### 3. Dates : jamais `toISOString()` sur une date locale

`new Date(y, m, d).toISOString()` renvoie la veille en France (UTC+1/+2). Utiliser des chaînes `"YYYY-MM-DD"` et les helpers UTC de `utils/tripStops.ts` (`addDays`, `nightsBetween`, `tripDays`). Corrigé dans `create.tsx` et `planning.tsx` ; d'autres `toISOString().split('T')[0]` subsistent (dashboard « aujourd'hui »).

### 4. Supabase free tier

Le projet peut se pauser sans prévenir. Restaurer via le dashboard (pas de perte de données).

## Git

```bash
# Sauvegarder
git add . && git commit -m "description" && git push

# Récupérer
git pull && npm install && npx expo start --clear
```
