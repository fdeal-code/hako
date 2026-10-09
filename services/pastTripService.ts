// HAKO — Service Après le voyage : album, avis, données du récap
// Tables : trip_photos (album), activity_reviews (avis), bucket `photos`.
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { contentTypeFor, fileExtension, uploadLocalFile } from '@/services/storageService';
import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import {
  PastExpense, PastMember, PastTripData, ReviewableWish, ReviewRow, TripPhoto,
} from '@/types/pastTrip';

const PHOTOS_BUCKET = 'photos';
const REVIEWABLE_STATUS = 'validated';

interface PhotoRowDb {
  id: string;
  photo_url: string;
  uploaded_by: string;
  caption: string | null;
  created_at: string;
}

interface MemberRowDb {
  user_id: string;
  profile: { nickname: string | null; avatar_url: string | null } | null;
}

interface WishRowDb extends ReviewableWish {
  added_by: string | null;
  status: string;
}

function toPhoto(row: PhotoRowDb): TripPhoto {
  return { id: row.id, photoUrl: row.photo_url, uploadedBy: row.uploaded_by, caption: row.caption, createdAt: row.created_at };
}

export async function getPastTrip(tripId: string): Promise<ServiceResult<PastTripData>> {
  const [trip, members, photos, wishes, expenses] = await Promise.all([
    supabase.from('trips').select('id, name, destination, start_date, end_date, cover_image_url').eq('id', tripId).single(),
    supabase.from('trip_members').select('user_id, profile:profiles(nickname, avatar_url)').eq('trip_id', tripId),
    supabase.from('trip_photos').select('id, photo_url, uploaded_by, caption, created_at')
      .eq('trip_id', tripId).order('created_at', { ascending: false }),
    supabase.from('wishes').select('id, title, image_url, category, stop_id, address, booked_at, added_by, status')
      .eq('trip_id', tripId).or(`status.eq.${REVIEWABLE_STATUS},booked_at.not.is.null`).neq('type', 'orga'),
    supabase.from('expenses').select('amount, paid_by, expense_splits(user_id, amount)').eq('trip_id', tripId),
  ]);
  // Migration wish_booking pas encore appliquée : envies validées seulement
  let wishResult: { data: unknown[] | null; error: { message: string } | null } = wishes;
  if (wishes.error?.message.includes('booked_at')) {
    wishResult = await supabase.from('wishes')
      .select('id, title, image_url, category, stop_id, address, added_by, status')
      .eq('trip_id', tripId).eq('status', REVIEWABLE_STATUS).neq('type', 'orga');
  }
  const failed = [trip, members, photos, wishResult, expenses].find(r => r.error);
  if (failed?.error) return serviceError(failed.error.message);
  if (!trip.data) return serviceError('Voyage introuvable.');

  const wishRows = ((wishResult.data ?? []) as Partial<WishRowDb>[])
    .map(w => ({ ...w, booked_at: w.booked_at ?? null }) as WishRowDb);
  let reviews: ReviewRow[] = [];
  if (wishRows.length > 0) {
    const { data, error } = await supabase.from('activity_reviews')
      .select('wish_id, user_id, rating, comment').in('wish_id', wishRows.map(w => w.id));
    if (error) return serviceError(error.message);
    reviews = (data ?? []) as ReviewRow[];
  }

  const t = trip.data as { id: string; name: string; destination: string; start_date: string; end_date: string; cover_image_url: string | null };
  return {
    data: {
      trip: { id: t.id, name: t.name, destination: t.destination, startDate: t.start_date, endDate: t.end_date, coverUrl: t.cover_image_url },
      members: ((members.data ?? []) as unknown as MemberRowDb[]).map((m): PastMember => ({
        userId: m.user_id,
        nickname: m.profile?.nickname ?? 'Membre',
        avatarUrl: m.profile?.avatar_url ?? null,
      })),
      photos: ((photos.data ?? []) as PhotoRowDb[]).map(toPhoto),
      wishes: wishRows,
      reviews,
      expenses: (expenses.data ?? []) as PastExpense[],
      wishAuthors: Object.fromEntries(wishRows.filter(w => w.added_by).map(w => [w.id, w.added_by as string])),
    },
    error: null,
  };
}


/** Envoie des photos de la galerie dans l'album du voyage. Renvoie le nombre ajouté. */
export async function uploadTripPhotos(
  tripId: string,
  userId: string,
  files: readonly { uri: string; mimeType: string | null }[],
): Promise<ServiceResult<number>> {
  let added = 0;
  for (const [index, file] of files.entries()) {
    const ext = fileExtension(file.uri);
    const path = `${tripId}/${userId}/${Date.now()}-${index}.${ext}`;
    const { data: publicUrl, error: uploadError } = await uploadLocalFile(PHOTOS_BUCKET, path, file.uri, file.mimeType ?? contentTypeFor(file.uri));
    if (uploadError !== null) {
      console.log('[ALBUM] storage.upload', path, uploadError);
      return added > 0 ? { data: added, error: null } : serviceError(uploadError);
    }
    const { error } = await supabase.from('trip_photos').insert({ trip_id: tripId, uploaded_by: userId, photo_url: publicUrl });
    if (error) {
      console.log('[ALBUM] trip_photos.insert', error.message);
      return added > 0 ? { data: added, error: null } : serviceError(error.message);
    }
    added += 1;
  }
  return { data: added, error: null };
}

/** Retire une photo de l'album (et son fichier, au mieux). */
export async function deleteTripPhoto(photo: TripPhoto): Promise<ServiceResult<true>> {
  const { error } = await supabase.from('trip_photos').delete().eq('id', photo.id);
  if (error) return serviceError(error.message);
  const marker = `/${PHOTOS_BUCKET}/`;
  const at = photo.photoUrl.indexOf(marker);
  if (at >= 0) void supabase.storage.from(PHOTOS_BUCKET).remove([photo.photoUrl.slice(at + marker.length)]);
  return { data: true, error: null };
}

/** Crée ou met à jour mon avis sur une envie. */
export async function saveReview(
  wishId: string,
  userId: string,
  rating: number,
  comment: string | null,
): Promise<ServiceResult<true>> {
  const { data: existing, error: readError } = await supabase.from('activity_reviews')
    .select('id').eq('wish_id', wishId).eq('user_id', userId).limit(1).maybeSingle();
  if (readError) return serviceError(readError.message);
  const row = { rating, comment: comment?.trim() || null };
  const { error } = existing
    ? await supabase.from('activity_reviews').update(row).eq('id', (existing as { id: string }).id)
    : await supabase.from('activity_reviews').insert({ ...row, wish_id: wishId, user_id: userId });
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}
