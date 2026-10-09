// HAKO — « J'ai réservé » : une réservation met à jour trois écrans d'un coup
//  1. l'envie est marquée réservée (qui, quand, combien) ;
//  2. un item « Check-in » est ajouté au planning, le 1er jour de l'étape ;
//  3. une dépense « Hébergement » est créée et partagée entre tous les membres.
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';

const CHECK_IN_START = '15:00';
const CHECK_IN_END = '16:00';
const EXPENSE_CATEGORY = 'accommodation';
const CENTS = 100;

export interface MarkBookedInput {
  wishId: string;
  tripId: string;
  title: string;
  userId: string;
  amount: number | null;        // total payé (€), null = inconnu → pas de dépense
  checkInDay: string;           // "YYYY-MM-DD" (début de l'étape, sinon début du voyage)
  stopId: string | null;
  memberIds: readonly string[]; // partage de la dépense
  today: string;                // "YYYY-MM-DD" (date locale de la dépense)
}

export interface BookingResult {
  expenseCreated: boolean;
  planned: boolean;
}

export async function markWishBooked(input: MarkBookedInput): Promise<ServiceResult<BookingResult>> {
  const { error: wishError } = await supabase
    .from('wishes')
    .update({ booked_at: new Date().toISOString(), booked_by: input.userId, booked_amount: input.amount })
    .eq('id', input.wishId);
  if (wishError) return serviceError(wishError.message);

  // 2. Planning — sauf si l'envie y est déjà
  let planned = false;
  const { data: existing } = await supabase
    .from('planning_items').select('id').eq('wish_id', input.wishId).limit(1);
  if (!existing || existing.length === 0) {
    const { error } = await supabase.from('planning_items').insert({
      trip_id: input.tripId,
      wish_id: input.wishId,
      title: `Check-in · ${input.title}`,
      day_date: input.checkInDay,
      start_time: CHECK_IN_START,
      end_time: CHECK_IN_END,
      sort_order: 0,
      added_by: input.userId,
      ...(input.stopId ? { stop_id: input.stopId } : {}),
    });
    planned = !error;
  }

  // 3. Dépense partagée à parts égales
  let expenseCreated = false;
  if (input.amount !== null && input.amount > 0 && input.memberIds.length > 0) {
    const { data: expense, error } = await supabase
      .from('expenses')
      .insert({
        trip_id: input.tripId,
        paid_by: input.userId,
        title: input.title,
        amount: input.amount,
        category: EXPENSE_CATEGORY,
        date: input.today,
        split_type: 'equal',
        ...(input.stopId ? { stop_id: input.stopId } : {}),
      })
      .select('id')
      .single();
    if (!error && expense) {
      const share = Math.round((input.amount / input.memberIds.length) * CENTS) / CENTS;
      const { error: splitError } = await supabase.from('expense_splits').insert(
        input.memberIds.map(userId => ({ expense_id: (expense as { id: string }).id, user_id: userId, amount: share })),
      );
      expenseCreated = !splitError;
    }
  }

  return { data: { expenseCreated, planned }, error: null };
}

/** Annule « J'ai réservé » (le planning et la dépense restent, modifiables dans leurs écrans). */
export async function unmarkWishBooked(wishId: string): Promise<ServiceResult<true>> {
  const { error } = await supabase
    .from('wishes')
    .update({ booked_at: null, booked_by: null, booked_amount: null })
    .eq('id', wishId);
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}
