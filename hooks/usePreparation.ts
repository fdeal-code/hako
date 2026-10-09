// HAKO — Hook Préparatifs (app/trip/[id]/preparation.tsx)
// Essentiels (checklist partagée) + tâches d'orga du groupe, en temps réel.
// Les modifications sont optimistes : la liste réagit tout de suite.

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useTripChecklist } from '@/hooks/useTripChecklist';
import { addPrepTask, deletePrepTask, getPreparation, updatePrepTask } from '@/services/preparationService';
import { supabase } from '@/services/supabase';
import { CHECKLIST_ITEMS } from '@/types/checklist';
import { PrepMember, PrepTask } from '@/types/preparation';
import { tripEvents } from '@/utils/events';
import { prepProgress, sortTasks } from '@/utils/preparation';

const CHANNEL_PREFIX = 'trip-prep';

export function usePreparation(tripId: string) {
  const { session } = useAuth();
  const me = session?.user?.id ?? '';
  const checklist = useTripChecklist(tripId);
  const [tasks, setTasks] = useState<PrepTask[] | null>(null);
  const [members, setMembers] = useState<PrepMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(({ data, error: err }: Awaited<ReturnType<typeof getPreparation>>) => {
    if (data) { setTasks(data.tasks); setMembers(data.members); } else setTasks(prev => prev ?? []);
    setError(err);
  }, []);

  const refresh = useCallback(async () => {
    if (tripId) apply(await getPreparation(tripId));
  }, [tripId, apply]);

  useEffect(() => {
    if (tripId) void getPreparation(tripId).then(apply);
  }, [tripId, apply]);

  // Un ami coche une tâche → la liste se met à jour
  useEffect(() => {
    if (!tripId) return;
    const channel = supabase
      .channel(`${CHANNEL_PREFIX}-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wishes', filter: `trip_id=eq.${tripId}` }, () => { void refresh(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [tripId, refresh]);

  const patchLocal = (id: string, patch: Partial<PrepTask>) =>
    setTasks(prev => (prev ?? []).map(t => (t.id === id ? { ...t, ...patch } : t)));

  const run = useCallback(async (action: Promise<{ error: string | null }>) => {
    const { error: err } = await action;
    if (err) { setError(err); void refresh(); }
    else tripEvents.emit(); // dashboard et accueil se rafraîchissent
  }, [refresh]);

  const addTask = useCallback(async (title: string, assignedTo: string | null): Promise<boolean> => {
    if (!title.trim() || !me) return false;
    const { data, error: err } = await addPrepTask(tripId, me, title, assignedTo);
    if (err !== null) { setError(err); return false; }
    setTasks(prev => [...(prev ?? []), data]);
    tripEvents.emit();
    return true;
  }, [tripId, me]);

  const toggleTask = useCallback((t: PrepTask) => {
    patchLocal(t.id, { done: !t.done });
    void run(updatePrepTask(t.id, { done: !t.done }));
  }, [run]);

  const assignTask = useCallback((t: PrepTask, userId: string | null) => {
    patchLocal(t.id, { assignedTo: userId });
    void run(updatePrepTask(t.id, { assigned_to: userId }));
  }, [run]);

  const removeTask = useCallback((t: PrepTask) => {
    setTasks(prev => (prev ?? []).filter(x => x.id !== t.id));
    void run(deletePrepTask(t.id));
  }, [run]);

  const sorted = useMemo(() => sortTasks(tasks ?? [], me), [tasks, me]);
  const essentialsDone = CHECKLIST_ITEMS.filter(i => checklist.done.has(i.key)).length;
  const progress = prepProgress(essentialsDone, CHECKLIST_ITEMS.length, tasks ?? []);

  return {
    me, members, loading: tasks === null, error,
    open: sorted.open, done: sorted.done,
    essentialsDone: checklist.done, toggleEssential: checklist.toggle,
    progress, addTask, toggleTask, assignTask, removeTask,
  };
}
