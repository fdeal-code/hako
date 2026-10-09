// HAKO — Connexion / inscription : vérifications de saisie (fonctions pures)
// Testées dans tests/authValidation.test.ts.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD = 6;
export const MIN_NICKNAME = 2;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export type PasswordStrength = 'faible' | 'moyen' | 'fort';

/** Faible < 6 caractères ; fort ≥ 9 avec un chiffre ou une majuscule ; sinon moyen. */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < MIN_PASSWORD) return 'faible';
  if (password.length >= 9 && (/[0-9]/.test(password) || /[A-Z]/.test(password))) return 'fort';
  return 'moyen';
}

export function isValidNickname(nickname: string): boolean {
  return nickname.trim().length >= MIN_NICKNAME;
}

/** Message d'erreur Supabase → phrase compréhensible. */
export function authErrorMessage(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou mot de passe incorrect.';
  if (m.includes('email not confirmed')) return 'Confirme d’abord ton e-mail (regarde ta boîte de réception).';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.';
  if (m.includes('password should be at least')) return `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`;
  if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives. Réessaie dans quelques minutes.';
  if (m.includes('network')) return 'Pas de connexion internet.';
  return raw;
}
