// HAKO — Import de photos dans l'album du voyage (sélection multiple)
// Partagé par le voyage en cours et l'après-voyage.

import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/contexts/AuthContext';
import { uploadTripPhotos } from '@/services/pastTripService';

const PHOTO_QUALITY = 0.8;
const MAX_PHOTOS_PER_IMPORT = 30;

export function usePhotoImport(tripId: string | undefined, onDone: () => void) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [uploading, setUploading] = useState(false);

  /** Ouvre la galerie puis envoie les photos. Renvoie un message d'erreur, ou null. */
  const importPhotos = useCallback(async (): Promise<string | null> => {
    if (!tripId || !userId) return 'Connecte-toi pour ajouter des photos.';
    // Le sélecteur de photos système n'a pas besoin de la permission galerie
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS_PER_IMPORT,
      quality: PHOTO_QUALITY,
      // iPhone : les HEIC sont convertis en JPEG (lisibles partout)
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (picked.canceled || picked.assets.length === 0) return null;
    console.log('[ALBUM] import', picked.assets.length, 'photo(s)', picked.assets.map(a => a.mimeType ?? a.uri.split('.').pop()));
    setUploading(true);
    const { data: added, error } = await uploadTripPhotos(
      tripId, userId, picked.assets.map(a => ({ uri: a.uri, mimeType: a.mimeType ?? null })),
    );
    setUploading(false);
    if (error !== null) console.log('[ALBUM] échec envoi :', error);
    onDone();
    if (error !== null) return `Envoi impossible : ${error}`;
    if (added !== null && added < picked.assets.length) return `${added} photo(s) sur ${picked.assets.length} envoyée(s).`;
    return null;
  }, [tripId, userId, onDone]);

  return { importPhotos, uploading };
}
