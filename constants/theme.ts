// HAKO Design System — DA V2 (maquettes Figma "accueilV2" / "dashboardV2")
// Base crème, accent orange, cards opaques à bordure fine (fin du glassmorphism),
// photo-first, grille 8px, coins arrondis

// ─────────────────────────────────────────────
// COULEURS
// ─────────────────────────────────────────────
export const Colors = {
  // Backgrounds
  background: '#FBF8F2',        // bg.primary — fond d'écran (crème)
  surface:    '#ffffff',        // bg.card — cartes et listes
  surfaceAlt: '#F4EFE7',        // nappe crème du dashboard (sheet)
  primary:    '#1A1815',        // bg.dark — filtre actif, boutons primaires
  accent:     '#E4572E',        // orange V2 — FAB, badges, accents
  white:      '#ffffff',
  offWhite:   '#FBF8F2',  // compat — identique à background

  // Text
  textPrimary:   '#1A1815',
  textSecondary: '#8A8883',
  textTertiary:  '#cccccc',
  textInverted:  '#ffffff',
  textMuted:     '#6B6155',  // gris chaud des maquettes V2 (sous-titres, libellés)
  textInk:       '#1C1C1C',  // texte des cartes blanches (maquettes V2)

  // UI
  border:      '#EBEBEB',
  borderDark:  'rgba(26,24,21,0.15)', // bordure fine des cards opaques V2
  borderLight: 'rgba(255,255,255,0.3)',
  line:        '#EDE7DD',   // segments inactifs, plage de dates (maquettes V2)
  textOnDark:  '#B8AD9F',   // sous-texte sur fond noir (bandeau « Lien copié »)
  overlay:     'rgba(0,0,0,0.2)',
  scrimClear:  'rgba(0,0,0,0)',    // dégradé photo/vidéo : haut transparent…
  scrimStrong: 'rgba(0,0,0,0.7)',  // …bas sombre pour lire la légende
  glassLight:  'rgba(255,255,255,0.9)', // bouton lecture sur vidéo

  // Budget
  positive: '#22C55E',   // montants positifs
  negative: '#DC503C',   // montants négatifs

  // Votes / Status
  vote: {
    love:     '#FF4B6E',
    pass:     '#C0C0C0',
    debate:   '#F5A623',
    pending:  '#ADADAD',
    archived: '#D0D0D0',
  },

  // Badge gradients (glassmorphism pills sur cards)
  badge: {
    orga:   { start: 'rgba(67,100,61,0.8)',  end: 'rgba(45,78,46,0.6)' },
    tiktok: { start: 'rgba(255,65,5,0.6)',   end: 'rgba(255,65,5,0.4)' },
  },

  // Étapes d'un voyage multi-villes (1re ville, 2e, 3e…) — repris en boucle
  stopPalette: ['#1A1815', '#E4572E', '#8A8883', '#C9A227', '#3B7A57'] as const,
  // Repères de la carte, par type de lieu
  // Dégradés Trip Match (cartes de swipe, propositions, carte d'entrée)
  matchGradients: {
    ocean:    ['#4A9FD8', '#1F5E8C'],
    mountain: ['#7BA05B', '#3E5B2E'],
    city:     ['#8B7BB8', '#4A3E6B'],
    country:  ['#D8A855', '#8C6A1F'],
    chill:    ['#6BBFA3', '#2E7D5F'],
    party:    ['#E86A8A', '#9C2E4E'],
    culture:  ['#C4924F', '#7A5220'],
    food:     ['#E88A4A', '#A34E1F'],
    entry:    ['#2E2C4A', '#1C1C1C'],
  } as const,

  placeColors: {
    hotel:      '#1A1815',
    restaurant: '#E4572E',
    cafe:       '#B5651D',
    bar:        '#8E44AD',
    monument:   '#C9A227',
    activity:   '#3B7A57',
    photo_spot: '#2E86C1',
    other:      '#6B6155',
  } as const,

  // Tab bar
  tabBar: {
    background: '#ffffff',
    active:     '#1c1c1c',
    inactive:   '#ADADAD',
  },
};

// ─────────────────────────────────────────────
// GLASSMORPHISME — 3 niveaux
// ─────────────────────────────────────────────
export const Glass = {
  // Niveau 1 — badges, filtres
  sm: {
    blur:       5,
    background: ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.15)'] as const,
    border:     'rgba(255,255,255,1)',
  },
  // Niveau 2 — navigation flottante, boutons action
  md: {
    blur:       10,
    background: ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)'] as const,
    border:     'rgba(255,255,255,0.8)',
  },
  // Niveau 3 — cards Organisation
  lg: {
    blur:       10,
    background: ['rgba(230,230,230,0.6)', 'rgba(128,128,128,0.4)'] as const,
    border:     'rgba(255,255,255,0.3)',
  },
};

// ─────────────────────────────────────────────
// POLICES — Bricolage Grotesque (titres des maquettes V2), chargée dans
// app/_layout.tsx via @expo-google-fonts/bricolage-grotesque. Tant qu'elle
// n'est pas chargée, React Native retombe sur la police système.
// ─────────────────────────────────────────────
export const Fonts = {
  display:     'BricolageGrotesque_600SemiBold',
  displayBold: 'BricolageGrotesque_700Bold',
} as const;

// ─────────────────────────────────────────────
// TYPOGRAPHIE — SF Pro (interface) + Inter (contenu)
// ─────────────────────────────────────────────
export const Typography = {
  // Bricolage Grotesque — titres des maquettes V2
  displayTitle: { fontFamily: Fonts.display, fontSize: 32 },      // « Où part-on ? »
  displayValue: { fontFamily: Fonts.display, fontSize: 24 },      // « 02 juin »
  displayLabel: { fontFamily: Fonts.displayBold, fontSize: 14 },  // « DÉPART », « TES AMIS »
  displayAmount: { fontFamily: Fonts.displayBold, fontSize: 56 }, // montant saisi (« 42 € »)
  displayHero:  { fontFamily: Fonts.displayBold, fontSize: 26 },  // destination sur une photo
  emoji:        { fontSize: 72 },                                // grand emoji (cartes de swipe, fête)
  // SF Pro — maquettes V2
  headerSmall: { fontSize: 20, fontWeight: '600' as const },     // « Nouveau voyage »
  cardTitle:   { fontSize: 16, fontWeight: '600' as const },     // titres des cartes blanches
  button:      { fontSize: 16, fontWeight: '500' as const },     // « Continuer »
  // SF Pro — titres, nav, badges, filtres
  titlePage: { fontSize: 28, fontWeight: '900' as const },  // SF Pro Black
  titleHero: { fontSize: 98, fontWeight: '900' as const },  // nom destination sur card voyage
  section:   { fontSize: 20, fontWeight: '600' as const },  // SF Pro Semibold
  filter:    { fontSize: 14, fontWeight: '500' as const },  // pills filtres / badges
  // Inter — listes, descriptions
  body:      { fontSize: 14, fontWeight: '500' as const },
  bodySmall: { fontSize: 12, fontWeight: '500' as const },
  rowTitle:  { fontSize: 15, fontWeight: '600' as const },  // lignes des cartes blanches (maquettes V2)
  chip:      { fontSize: 13, fontWeight: '600' as const },  // pastilles compactes (ambiances, « Coller »)
};

// ─────────────────────────────────────────────
// SPACING — grille 8px
// ─────────────────────────────────────────────
export const Spacing = {
  xs:  4,   // micro-gap
  sm:  8,   // entre composants
  sm2: 12,  // padding badges
  md:  16,  // gap sections
  md2: 20,  // padding écran
  lg:  24,  // padding badges larges
  xl:  32,  // padding card voyage
  xxl: 48,  // grands espaces verticaux
};

// ─────────────────────────────────────────────
// RADIUS
// ─────────────────────────────────────────────
export const Radii = {
  sm:   16,  // listes, petites cartes
  md:   20,  // cartes voyage
  lg:   24,  // large
  xl:   28,  // bottom sheets (compat)
  pill: 30,  // filtres, badges (pills), tuiles du dashboard V2
  sheet: 32, // nappe crème du dashboard V2
  full: 99,  // boutons circulaires
};

// ─────────────────────────────────────────────
// OMBRES — 3 niveaux
// ─────────────────────────────────────────────
export const Shadows = {
  // subtle — listes
  sm: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius:  16,
    elevation:     2,
  },
  // standard — cartes, filtres
  md: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 10 },
    shadowOpacity: 0.10,
    shadowRadius:  30,
    elevation:     4,
  },
  // carte blanche des maquettes V2 (champs, listes)
  card: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius:  30,
    elevation:     5,
  },
  // heavy — navigation flottante
  lg: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius:  30,
    elevation:     8,
  },
};
