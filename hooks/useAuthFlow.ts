// HAKO — Hook Connexion / inscription (écran app/(auth)/login.tsx)
// Accueil → connexion, ou inscription en 4 étapes (pseudo, photo, e-mail,
// mot de passe) → bienvenue (ou « confirme ton e-mail »).

import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

import { sendPasswordReset, signInWithEmail, signUpAccount } from '@/services/authService';
import { isValidEmail, isValidNickname, MIN_PASSWORD, passwordStrength } from '@/utils/authValidation';

export type AuthMode = 'welcome' | 'signin' | 'signup';
export type SignupStep = 1 | 2 | 3 | 4 | 'done';
export const SIGNUP_STEPS = 4;

const AVATAR_QUALITY = 0.7;

export function useAuthFlow() {
  const [mode, setMode] = useState<AuthMode>('welcome');
  const [step, setStep] = useState<SignupStep>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const go = useCallback((next: AuthMode) => { setMode(next); setStep(1); }, []);

  const canContinue =
    step === 1 ? isValidNickname(nickname)
      : step === 2 ? true
        : step === 3 ? isValidEmail(email)
          : step === 4 ? password.length >= MIN_PASSWORD
            : false;

  const back = useCallback(() => {
    if (mode !== 'signup' || step === 1 || step === 'done') { go('welcome'); return; }
    setStep(s => (s === 'done' || s === 1 ? s : ((s - 1) as SignupStep)));
  }, [mode, step, go]);

  const pickPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: AVATAR_QUALITY });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) setPhotoUri(asset.uri);
  }, []);

  /** Étape suivante (ou création du compte à la dernière). Renvoie une erreur, ou null. */
  const next = useCallback(async (): Promise<string | null> => {
    if (step === 'done' || !canContinue) return null;
    if (step < SIGNUP_STEPS) { setStep((step + 1) as SignupStep); return null; }
    setBusy(true);
    const { data, error } = await signUpAccount({ email, password, nickname, photoUri });
    setBusy(false);
    if (error !== null) return error;
    setNeedsConfirmation(data.needsConfirmation);
    setStep('done');
    return null;
  }, [step, canContinue, email, password, nickname, photoUri]);

  const signIn = useCallback(async (): Promise<string | null> => {
    if (!isValidEmail(email)) return 'Entre une adresse e-mail valide.';
    if (!password) return 'Entre ton mot de passe.';
    setBusy(true);
    const { error } = await signInWithEmail(email, password);
    setBusy(false);
    return error; // succès : AuthGate redirige vers l'accueil
  }, [email, password]);

  const resetPassword = useCallback(async (): Promise<string | null> => {
    if (!isValidEmail(email)) return 'Entre d’abord ton adresse e-mail.';
    const { error } = await sendPasswordReset(email);
    return error;
  }, [email]);

  return {
    mode, go, step, back, next, canContinue,
    email, setEmail, password, setPassword, nickname, setNickname, photoUri, pickPhoto, setPhotoUri,
    strength: password ? passwordStrength(password) : null,
    busy, needsConfirmation, signIn, resetPassword,
  };
}
