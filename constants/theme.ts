// HAKO Design System — aligné sur les maquettes Figma
// Glassmorphism, photo-first, grille 8px, coins arrondis, base blanche

// ─────────────────────────────────────────────
// COULEURS
// ─────────────────────────────────────────────
export const Colors = {
  // Backgrounds
  background: '#f7f9fb',        // bg.primary — fond d'écran
  surface:    '#ffffff',        // bg.card — cartes et listes
  primary:    '#1c1c1c',        // bg.dark — filtre actif, boutons primaires
  white:      '#ffffff',
  offWhite:   '#f7f9fb',  // compat — identique à background

  // Text
  textPrimary:   '#1c1c1c',
  textSecondary: '#8e8e8e',
  textTertiary:  '#cccccc',
  textInverted:  '#ffffff',

  // UI
  border:      '#EBEBEB',
  borderLight: 'rgba(255,255,255,0.3)',
  overlay:     'rgba(0,0,0,0.2)',

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
// TYPOGRAPHIE — SF Pro (interface) + Inter (contenu)
// ─────────────────────────────────────────────
export const Typography = {
  // SF Pro — titres, nav, badges, filtres
  titlePage: { fontSize: 28, fontWeight: '900' as const },  // SF Pro Black
  titleHero: { fontSize: 98, fontWeight: '900' as const },  // nom destination sur card voyage
  section:   { fontSize: 20, fontWeight: '600' as const },  // SF Pro Semibold
  filter:    { fontSize: 14, fontWeight: '500' as const },  // pills filtres / badges
  // Inter — listes, descriptions
  body:      { fontSize: 14, fontWeight: '500' as const },
  bodySmall: { fontSize: 12, fontWeight: '500' as const },
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
  pill: 30,  // filtres, badges (pills)
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
  // heavy — navigation flottante
  lg: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius:  30,
    elevation:     8,
  },
};
