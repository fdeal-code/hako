// HAKO — Hook « Modifier le profil » (app/account/edit.tsx)

import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/contexts/AuthContext';
import { updateProfile } from '@/services/profileService';
import { isValidNickname } from '@/utils/authValidation';

const AVATAR_QUALITY = 0.8;

export function useEditProfile() {
  const { session } = useAuth();
  const user = session?.user;
  const meta = (user?.user_metadata ?? {}) as { nickname?: string; avatar_url?: string };
  const [nickname, setNickname] = useState(meta.nickname ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currentAvatar = meta.avatar_url ?? null;
  const dirty = !!photoUri || nickname.trim() !== (meta.nickname ?? '');

  const pickPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: AVATAR_QUALITY });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) setPhotoUri(asset.uri);
  }, []);

  /** Enregistre ; renvoie une erreur ou null. */
  const save = useCallback(async (): Promise<string | null> => {
    if (!user) return 'Session expirée, reconnecte-toi.';
    if (!isValidNickname(nickname)) return 'Ton pseudo doit faire au moins 2 caractères.';
    setSaving(true);
    const { error } = await updateProfile({ userId: user.id, email: user.email ?? '', nickname, photoUri, currentAvatar });
    setSaving(false);
    return error;
  }, [user, nickname, photoUri, currentAvatar]);

  return {
    nickname, setNickname, photoUri, pickPhoto, saving, dirty, save,
    email: user?.email ?? '',
    previewUri: photoUri ?? currentAvatar,
    canSave: dirty && isValidNickname(nickname),
  };
}
