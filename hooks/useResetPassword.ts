// HAKO — Hook « Nouveau mot de passe » (app/reset-password.tsx)
// Le lien de l'e-mail ouvre l'app avec des jetons : on ouvre la session de
// récupération, puis on enregistre le nouveau mot de passe.

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';

import { startRecoverySession, updatePassword } from '@/services/authService';
import { MIN_PASSWORD, passwordStrength } from '@/utils/authValidation';

export type ResetStep = 'opening' | 'form' | 'saving' | 'done' | 'invalid';

export function useResetPassword() {
  const url = Linking.useURL();
  const started = useRef(false);
  const [step, setStep] = useState<ResetStep>('opening');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url || started.current) return;
    started.current = true;
    void startRecoverySession(url).then(({ error: err }) => {
      if (err !== null) { setError(err); setStep('invalid'); } else setStep('form');
    });
  }, [url]);

  const mismatch = confirm.length > 0 && confirm !== password;
  const canSave = password.length >= MIN_PASSWORD && confirm === password;

  const save = useCallback(async () => {
    if (!canSave) return;
    setError(null);
    setStep('saving');
    const { error: err } = await updatePassword(password);
    if (err !== null) { setError(err); setStep('form'); return; }
    setStep('done');
  }, [canSave, password]);

  return {
    step, password, setPassword, confirm, setConfirm, mismatch, canSave, save, error,
    strength: password ? passwordStrength(password) : null,
  };
}
