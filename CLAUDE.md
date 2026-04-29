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
- `.env` non tracké par git → recréer avec `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## ⚠️ PIÈGES CRITIQUES

### 1. Bug Map — mauvais fichier

La carte du Dashboard ouvre `ExpandedMapView` (`components/map/ExpandedMapView.tsx`), **PAS** `app/trip/[id]/map.tsx`. TOUJOURS vérifier le chemin exact avant d'éditer.

### 2. Debugging — première étape

Quand une feature ne marche pas → ajouter des `console.log` AVANT de changer du code :

- Données `undefined` ?
- Mauvais composant édité ?
- Requête Supabase avec erreur de relation ?

### 3. Supabase free tier

Le projet peut se pauser sans prévenir. Restaurer via le dashboard (pas de perte de données).

## Git

```bash
# Sauvegarder
git add . && git commit -m "description" && git push

# Récupérer
git pull && npm install && npx expo start --clear
```
