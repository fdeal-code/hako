// HAKO — Service documents : ajout, lecture, suppression, hors-connexion
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { Directory, File, Paths } from 'expo-file-system';

import { supabase } from '@/services/supabase';
import { uploadLocalFile } from '@/services/storageService';
import { serviceError, ServiceResult } from '@/services/tripService';
import { DocCategory, TicketDetails, TripDocumentRow } from '@/types/documents';

const BUCKET = 'documents';
const OFFLINE_DIR = 'hako-documents';

export interface LocalFile {
  uri: string;
  name: string;
  type: string;
  size?: number | null;
}

export interface NewDocumentInput {
  tripId: string;
  userId: string | null;
  file: LocalFile;
  title: string;
  category: DocCategory;
  eventDate: string | null;    // "YYYY-MM-DD"
  isShared: boolean;
  notes: string | null;
  details: TicketDetails | null;
}

/** Envoie le fichier dans le bucket `documents` puis crée la ligne. */
export async function uploadDocument(input: NewDocumentInput): Promise<ServiceResult<TripDocumentRow>> {
  const filePath = `${input.tripId}/${Date.now()}_${input.file.name}`;
  const { data: publicUrl, error: uploadError } = await uploadLocalFile(BUCKET, filePath, input.file.uri, input.file.type);
  if (uploadError !== null) return serviceError(uploadError);
  const hasDetails = input.details && Object.values(input.details).some(v => typeof v === 'string' && v.trim().length > 0);
  const { data, error } = await supabase
    .from('documents')
    .insert({
      trip_id: input.tripId,
      uploaded_by: input.userId,
      title: input.title.trim(),
      category: input.category,
      file_url: publicUrl,
      file_type: input.file.type,
      file_size: input.file.size ?? null,
      notes: input.notes,
      event_date: input.eventDate,
      is_shared: input.isShared,
      ...(hasDetails ? { details: input.details } : {}),
    })
    .select()
    .single();
  if (error || !data) return serviceError(error?.message ?? 'Ajout du document impossible.');
  return { data: data as TripDocumentRow, error: null };
}

export async function getDocument(documentId: string): Promise<ServiceResult<TripDocumentRow>> {
  const { data, error } = await supabase.from('documents').select('*').eq('id', documentId).single();
  if (error || !data) return serviceError(error?.message ?? 'Document introuvable.');
  return { data: data as TripDocumentRow, error: null };
}

export async function deleteDocument(documentId: string, fileUrl: string): Promise<ServiceResult<true>> {
  const { error } = await supabase.from('documents').delete().eq('id', documentId);
  if (error) return serviceError(error.message);
  removeOfflineCopy(documentId, fileUrl);
  return { data: true, error: null };
}

// ─── Hors connexion : copie locale dans le dossier documents de l'app ─────────
function offlineFile(documentId: string, fileUrl: string): File {
  const ext = (fileUrl.split('?')[0]?.split('.').pop() ?? 'bin').slice(0, 5);
  return new File(Paths.document, OFFLINE_DIR, `${documentId}.${ext}`);
}

/** URI locale si le document est déjà dispo hors connexion, sinon null. */
export function offlineUri(documentId: string, fileUrl: string): string | null {
  try {
    const file = offlineFile(documentId, fileUrl);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

/** Télécharge le fichier pour le consulter sans réseau (billet à l'aéroport…). */
export async function makeAvailableOffline(documentId: string, fileUrl: string): Promise<ServiceResult<string>> {
  try {
    new Directory(Paths.document, OFFLINE_DIR).create({ idempotent: true, intermediates: true });
    const file = await File.downloadFileAsync(fileUrl, offlineFile(documentId, fileUrl), { idempotent: true });
    return { data: file.uri, error: null };
  } catch (e) {
    return serviceError(e instanceof Error ? e.message : 'Téléchargement impossible.');
  }
}

export function removeOfflineCopy(documentId: string, fileUrl?: string): void {
  try {
    if (!fileUrl) return;
    const file = offlineFile(documentId, fileUrl);
    if (file.exists) file.delete();
  } catch {
    // copie absente ou déjà supprimée
  }
}
