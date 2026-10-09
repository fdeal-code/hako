// HAKO — Service checklist « Prêt pour le départ ? »
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { ChecklistItemKey, ChecklistRow } from '@/types/checklist';

const TABLE = 'trip_checklist';

export async function getChecklist(tripId: string): Promise<ServiceResult<ChecklistRow[]>> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('trip_id', tripId);
  if (error) return serviceError(error.message);
  return { data: (data ?? []) as ChecklistRow[], error: null };
}

/** Coche / décoche un élément pour tout le groupe. */
export async function setChecklistItem(
  tripId: string,
  item: ChecklistItemKey,
  done: boolean,
  userId: string | null,
): Promise<ServiceResult<true>> {
  if (done) {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ trip_id: tripId, item, done_by: userId }, { onConflict: 'trip_id,item' });
    if (error) return serviceError(error.message);
  } else {
    const { error } = await supabase.from(TABLE).delete().eq('trip_id', tripId).eq('item', item);
    if (error) return serviceError(error.message);
  }
  return { data: true, error: null };
}
