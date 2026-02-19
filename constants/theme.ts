// HAKO Design System
// Premium travel app — glassmorphism, photo-first, rounded corners, white base

export const Colors = {
  // Brand
  primary: '#1A1A2E',       // deep navy
  primaryLight: '#16213E',
  accent: '#E8A87C',        // warm sand

  // Neutrals
  white: '#FFFFFF',
  offWhite: '#F8F7F4',
  background: '#FFFFFF',
  surface: '#F5F4F1',

  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textTertiary: '#ADADAD',
  textInverted: '#FFFFFF',

  // Status / Votes
  vote: {
    love: '#FF4B6E',        // ❤️ validée
    pass: '#C0C0C0',        // 👎
    debate: '#F5A623',      // en débat — orange
    pending: '#ADADAD',     // en attente — grey
    archived: '#D0D0D0',    // archivée
  },

  // UI
  border: '#EBEBEB',
  borderLight: 'rgba(255,255,255,0.3)',
  shadow: 'rgba(0,0,0,0.08)',
  overlay: 'rgba(0,0,0,0.4)',

  // Glass (for glassmorphism cards)
  glass: {
    background: 'rgba(255,255,255,0.18)',
    border: 'rgba(255,255,255,0.35)',
    backgroundDark: 'rgba(0,0,0,0.25)',
  },

  // Tab bar
  tabBar: {
    background: '#FFFFFF',
    active: '#1A1A2E',
    inactive: '#ADADAD',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radii = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
};
