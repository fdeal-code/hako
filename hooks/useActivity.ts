// HAKO — Hook Fiche activité : chargement, billet lié, partants, horaire
// modifiable (pas de 15 min, enregistré d'un tap), retrait du planning.

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { getActivity, updateActivityTime } from '@/services/activityService';
import { deletePlanningEntry } from '@/services/planningService';
import { ActivityDetail } from '@/types/activity';
import { shiftSlot } from '@/utils/activityDetail';
import { tripEvents } from '@/utils/events';
import { ticketFor } from '@/utils/ongoingTrip';
import { entryKind } from '@/utils/planningDay';

export function useActivity(itemId: string | undefined) {
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ start: string; end: string } | null>(null); // horaire en cours de modif
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    if (!itemId) return;
    void getActivity(itemId).then(result => {
      if (result.error !== null) setError(result.error);
      else { setDetail(result.data); setError(null); }
    });
  }, [itemId]);

  useFocusEffect(refresh);

  const item = detail?.item ?? null;
  const ticket = useMemo(
    () => (item ? ticketFor(item, (detail?.dayDocs ?? []).filter(d => d.category !== 'hotel' || item.title.toLowerCase().startsWith('check')), item.day_date) : null),
    [item, detail],
  );
  const kind = item ? entryKind({ ...item, wish: item.wish ? { category: item.wish.category } : null }, ticket !== null && ticket.category !== 'hotel') : 'other';

  /** Avis du groupe : partants, pas chauds, et ceux qui n'ont pas voté. */
  const votes = useMemo(() => {
    const byUser = new Map((item?.wish?.wish_votes ?? []).map(v => [v.user_id, v.vote]));
    return (detail?.members ?? []).map(m => ({ member: m, vote: byUser.get(m.userId) ?? null }));
  }, [item, detail]);
  const partants = votes.filter(v => v.vote === 'up');

  const startEdit = useCallback(() => {
    if (item?.start_time) setDraft({ start: item.start_time.slice(0, 5), end: (item.end_time ?? item.start_time).slice(0, 5) });
  }, [item]);
  const shift = useCallback((which: 'start' | 'end', delta: number) => {
    setDraft(d => (d ? shiftSlot(d.start, d.end, which, delta) : d));
  }, []);
  const cancelEdit = useCallback(() => setDraft(null), []);

  const saveTime = useCallback(async (): Promise<string | null> => {
    if (!item || !draft) return null;
    setSaving(true);
    const { error: saveError } = await updateActivityTime(item.id, draft.start, draft.end);
    setSaving(false);
    if (saveError !== null) return saveError;
    setDetail(d => (d ? { ...d, item: { ...d.item, start_time: draft.start, end_time: draft.end } } : d));
    setDraft(null);
    tripEvents.emit();
    return null;
  }, [item, draft]);

  const remove = useCallback(async (): Promise<string | null> => {
    if (!item) return null;
    const { error: deleteError } = await deletePlanningEntry(item.id);
    if (deleteError !== null) return deleteError;
    tripEvents.emit();
    return null;
  }, [item]);

  return {
    detail, item, error, ticket, kind, votes, partants,
    draft, startEdit, shift, cancelEdit, saveTime, saving, remove, refresh,
  };
}
