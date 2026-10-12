// HAKO — Envoi d'un fichier local vers Supabase Storage
// Le fetch d'Expo (SDK 52+) refuse les parts FormData « façon React Native »
// ({ uri, name, type }) : « Unsupported FormDataPart implementation ».
// On lit donc le fichier en binaire (expo-file-system) et on envoie
// l'ArrayBuffer. Source unique pour tous les envois (album, couverture,
// documents, avatars).
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { File } from 'expo-file-system';

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', webp: 'image/webp',
  gif: 'image/gif', pdf: 'application/pdf',
};

/** Extension en minuscules d'une URI locale (sans paramètres). */
export function fileExtension(uri: string, fallback = 'jpg'): string {
  const ext = uri.split('?')[0]?.split('.').pop()?.toLowerCase();
  return ext && ext.length <= 5 ? ext : fallback;
}

/** Type MIME d'après l'extension (image/jpeg par défaut). */
export function contentTypeFor(uri: string, fallback = 'image/jpeg'): string {
  return MIME_BY_EXT[fileExtension(uri, '')] ?? fallback;
}

/** Envoie un fichier local et renvoie son chemin dans le bucket (buckets privés). */
export async function uploadPrivateFile(
  bucket: string,
  path: string,
  localUri: string,
  contentType: string = contentTypeFor(localUri),
): Promise<ServiceResult<string>> {
  let bytes: ArrayBuffer;
  try {
    bytes = await new File(localUri).arrayBuffer();
  } catch (e) {
    console.log('[STORAGE] lecture impossible', localUri, e);
    return serviceError('Impossible de lire le fichier sur le téléphone.');
  }
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { upsert: true, contentType });
  if (error) {
    console.log('[STORAGE] upload', bucket, path, error.message);
    return serviceError(error.message);
  }
  return { data: path, error: null };
}

/** Envoie un fichier local et renvoie son URL publique (buckets publics : avatars, couvertures, album). */
export async function uploadLocalFile(
  bucket: string,
  path: string,
  localUri: string,
  contentType: string = contentTypeFor(localUri),
): Promise<ServiceResult<string>> {
  const { error } = await uploadPrivateFile(bucket, path, localUri, contentType);
  if (error !== null) return serviceError(error);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { data: data.publicUrl, error: null };
}
