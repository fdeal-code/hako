// HAKO — Service Import de réservations
// 1. parseBookings : la fonction serveur parse-booking lit la confirmation
//    (texte collé, PDF ou capture) et renvoie les réservations trouvées.
// 2. importBookings : crée, avec les droits de l'utilisateur (RLS), le
//    document (la confirmation elle-même), les créneaux du planning et la
//    dépense de chaque réservation validée.
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { FunctionsHttpError } from '@supabase/supabase-js';
import { File, Paths } from 'expo-file-system';

import { addExpense } from '@/services/budgetService';
import { uploadLocalFile } from '@/services/storageService';
import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { BookingDraft, ImportResult, ImportSource, ParsedBooking } from '@/types/bookingImport';
import { TripStop } from '@/types/tripStops';
import {
  bookingDay, docCategoryFor, expenseCategoryFor, planningSlotsFor, ticketDetailsFor,
} from '@/utils/bookingImport';
import { splitEqually } from '@/utils/expenseForm';
import { localDayIso, stopForDay } from '@/utils/tripStops';

const FN_PARSE_BOOKING = 'parse-booking';
const BUCKET = 'documents';
const TEXT_MIME = 'text/plain';
const MAX_FILE_NAME = 60;

async function functionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { message?: string; error?: string };
      return body.message ?? body.error ?? error.message;
    } catch {
      return error.message;
    }
  }
  return error instanceof Error ? error.message : 'Lecture impossible.';
}

/** Fait lire la confirmation par la fonction serveur. */
export async function parseBookings(tripId: string, source: ImportSource): Promise<ServiceResult<ParsedBooking[]>> {
  let body: Record<string, unknown>;
  if (source.type === 'text') {
    body = { trip_id: tripId, text: source.text };
  } else {
    let base64: string;
    try {
      base64 = await new File(source.uri).base64();
    } catch {
      return serviceError('Impossible de lire ce fichier.');
    }
    body = { trip_id: tripId, file: { base64, media_type: source.mimeType } };
  }
  const { data, error } = await supabase.functions.invoke<{ bookings: ParsedBooking[] }>(FN_PARSE_BOOKING, { body });
  if (error) return serviceError(await functionError(error));
  return { data: data?.bookings ?? [], error: null };
}

/** Références déjà présentes dans les documents du voyage (repérer les doublons). */
export async function getImportedReferences(tripId: string): Promise<ServiceResult<{ reference: string | null; day: string | null }[]>> {
  const { data, error } = await supabase.from('documents').select('event_date, details').eq('trip_id', tripId);
  if (error) return serviceError(error.message);
  return {
    data: ((data ?? []) as { event_date: string | null; details: { reference?: string } | null }[])
      .map(d => ({ reference: d.details?.reference ?? null, day: d.event_date?.slice(0, 10) ?? null })),
    error: null,
  };
}

/** Envoie la confirmation dans le bucket documents (une seule fois pour tout l'import). */
async function uploadConfirmation(tripId: string, source: ImportSource): Promise<ServiceResult<{ url: string; mime: string; size: number | null }>> {
  const stamp = Date.now();
  if (source.type === 'file') {
    const safeName = source.name.replace(/[^\w.-]+/g, '_').slice(-MAX_FILE_NAME);
    const { data, error } = await uploadLocalFile(BUCKET, `${tripId}/${stamp}_${safeName}`, source.uri, source.mimeType);
    if (error !== null) return serviceError(error);
    return { data: { url: data, mime: source.mimeType, size: new File(source.uri).size ?? null }, error: null };
  }
  // Texte collé : on le garde comme fichier .txt, consultable depuis Documents
  const file = new File(Paths.cache, `confirmation_${stamp}.txt`);
  try {
    file.create({ overwrite: true });
    file.write(source.text);
  } catch {
    return serviceError('Impossible de préparer la confirmation.');
  }
  const { data, error } = await uploadLocalFile(BUCKET, `${tripId}/${stamp}_confirmation.txt`, file.uri, TEXT_MIME);
  if (error !== null) return serviceError(error);
  return { data: { url: data, mime: TEXT_MIME, size: file.size ?? null }, error: null };
}

export interface ImportInput {
  tripId: string;
  userId: string;
  source: ImportSource;
  drafts: readonly BookingDraft[];
  memberIds: readonly string[];
  stops: readonly TripStop[];
}

/** Crée document + planning + dépense pour chaque réservation cochée. */
export async function importBookings(input: ImportInput): Promise<ServiceResult<ImportResult>> {
  const chosen = input.drafts.filter(d => d.include);
  if (chosen.length === 0) return serviceError('Rien à ajouter.');

  const upload = await uploadConfirmation(input.tripId, input.source);
  if (upload.error !== null) return serviceError(upload.error);

  const result: ImportResult = { documents: 0, planning: 0, expenses: 0 };
  const today = localDayIso(new Date());

  for (const b of chosen) {
    const day = bookingDay(b);
    const details = ticketDetailsFor(b);
    const notes = [b.provider, b.address, b.notes].filter(Boolean).join(' · ') || null;

    // 1. Le document (la confirmation, rangée dans la bonne catégorie)
    const { error: docError } = await supabase.from('documents').insert({
      trip_id: input.tripId,
      uploaded_by: input.userId,
      title: b.title.trim(),
      category: docCategoryFor(b.kind),
      file_url: upload.data.url,
      file_type: upload.data.mime,
      file_size: upload.data.size,
      notes,
      event_date: day,
      is_shared: true,
      ...(Object.keys(details).length > 0 ? { details } : {}),
    });
    if (docError) return serviceError(docError.message);
    result.documents += 1;

    // 2. Les créneaux du planning
    if (b.addPlanning) {
      const slots = planningSlotsFor(b);
      if (slots.length > 0) {
        const { error: planError } = await supabase.from('planning_items').insert(slots.map(s => ({
          trip_id: input.tripId,
          title: s.title,
          day_date: s.day,
          start_time: s.start,
          end_time: s.end,
          notes: s.notes,
          stop_id: stopForDay(input.stops, s.day)?.id ?? null,
          added_by: input.userId,
          sort_order: 0,
          is_locked: false,
        })));
        if (planError) return serviceError(planError.message);
        result.planning += slots.length;
      }
    }

    // 3. La dépense (payée par moi, partagée entre tous les membres)
    if (b.addExpense && b.total_price && b.total_price > 0 && input.memberIds.length > 0) {
      const date = day ?? today;
      const { error: expError } = await addExpense({
        tripId: input.tripId,
        paidBy: input.userId,
        title: b.title,
        amount: b.total_price,
        category: expenseCategoryFor(b.kind),
        date,
        stopId: stopForDay(input.stops, date)?.id ?? null,
        splits: splitEqually(b.total_price, input.memberIds),
      });
      if (expError !== null) return serviceError(expError);
      result.expenses += 1;
    }
  }
  return { data: result, error: null };
}
