// HAKO — Service Préparatifs : tâches d'orga (wishes type 'orga') + membres
// Pattern service : ServiceResult<T> (voir tripService.ts).

import { supabase } from '@/services/supabase';
import { serviceError, ServiceResult } from '@/services/tripService';
import { CHECKLIST_ITEMS } from '@/types/checklist';
import { PrepMember, PrepSummary, PrepTask } from '@/types/preparation';
import { track } from '@/services/telemetryService';

const TASK_TYPE = 'orga';
const TASK_COLUMNS = 'id, title, description, done, assigned_to, added_by, created_at, is_private';

interface TaskRowDb {
  id: string;
  title: string;
  description: string | null;
  done: boolean | null;
  assigned_to: string | null;
  added_by: string;
  created_at: string;
  is_private: boolean | null;
}

interface MemberRowDb {
  user_id: string;
  profile: { nickname: string | null; avatar_url: string | null } | null;
}

function toTask(r: TaskRowDb): PrepTask {
  return {
    id: r.id, title: r.title, note: r.description, done: !!r.done,
    assignedTo: r.assigned_to, addedBy: r.added_by, createdAt: r.created_at, isPrivate: !!r.is_private,
  };
}

export async function getPreparation(tripId: string): Promise<ServiceResult<{ tasks: PrepTask[]; members: PrepMember[] }>> {
  const [tasks, members] = await Promise.all([
    // La RLS ne renvoie les tâches privées qu'à leur auteur
    supabase.from('wishes').select(TASK_COLUMNS)
      .eq('trip_id', tripId).eq('type', TASK_TYPE).neq('status', 'archived'),
    supabase.from('trip_members').select('user_id, profile:profiles(nickname, avatar_url)').eq('trip_id', tripId),
  ]);
  if (tasks.error) return serviceError(tasks.error.message);
  if (members.error) return serviceError(members.error.message);
  return {
    data: {
      tasks: ((tasks.data ?? []) as TaskRowDb[]).map(toTask),
      members: ((members.data ?? []) as unknown as MemberRowDb[]).map(m => ({
        id: m.user_id,
        nickname: m.profile?.nickname ?? 'Voyageur',
        avatarUrl: m.profile?.avatar_url ?? null,
      })),
    },
    error: null,
  };
}

export async function addPrepTask(tripId: string, userId: string, title: string, isPrivate: boolean): Promise<ServiceResult<PrepTask>> {
  const { data, error } = await supabase
    .from('wishes')
    .insert({
      trip_id: tripId, added_by: userId, title: title.trim(), type: TASK_TYPE, status: 'pending', done: false,
      is_private: isPrivate, assigned_to: isPrivate ? userId : null,
    })
    .select(TASK_COLUMNS)
    .single();
  if (error) return serviceError(error.message);
  track('prep_task_added', { private: isPrivate }, tripId);
  return { data: toTask(data as TaskRowDb), error: null };
}

export async function updatePrepTask(
  taskId: string,
  patch: { done?: boolean; assigned_to?: string | null; title?: string; is_private?: boolean },
): Promise<ServiceResult<true>> {
  const { error } = await supabase.from('wishes').update(patch).eq('id', taskId);
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}

export async function deletePrepTask(taskId: string): Promise<ServiceResult<true>> {
  const { error } = await supabase.from('wishes').delete().eq('id', taskId);
  if (error) return serviceError(error.message);
  return { data: true, error: null };
}

/** Compteurs de la bande « Préparatifs » (dashboard, documents). */
export async function getPrepSummary(tripId: string, userId: string): Promise<ServiceResult<PrepSummary>> {
  const [checklist, open] = await Promise.all([
    supabase.from('trip_checklist').select('item').eq('trip_id', tripId),
    supabase.from('wishes').select('assigned_to, added_by, is_private').eq('trip_id', tripId).eq('type', TASK_TYPE)
      .neq('status', 'archived').or('done.is.null,done.eq.false'),
  ]);
  if (checklist.error) return serviceError(checklist.error.message);
  if (open.error) return serviceError(open.error.message);
  const openRows = (open.data ?? []) as { assigned_to: string | null; added_by: string; is_private: boolean | null }[];
  return {
    data: {
      essentialsDone: new Set(((checklist.data ?? []) as { item: string }[]).map(r => r.item)).size,
      essentialsTotal: CHECKLIST_ITEMS.length,
      openTasks: openRows.length,
      myOpenTasks: openRows.filter(r => r.assigned_to === userId || (r.is_private && r.added_by === userId)).length,
    },
    error: null,
  };
}
