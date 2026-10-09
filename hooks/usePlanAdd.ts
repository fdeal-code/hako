// HAKO — Hook Ajout au planning (page app/trip/[id]/plan-add.tsx)
// 1. Quoi : une envie validée pas encore planifiée, ou un créneau libre.
// 2. Quand : jour (limité à la ville de l'envie), début au quart d'heure,
//    durée (celle de l'envie par défaut), premier créneau libre, et les
//    créneaux déjà prévus ce jour-là pour éviter les chevauchements.

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useTripStops } from '@/hooks/useTripStops';
import { createPlanningEntry, getPlanAddData, PlanAddData, PlanCandidate } from '@/services/planAddService';
import { tripEvents } from '@/utils/events';
import { endFor, firstFreeStart, overlapping, toMin } from '@/utils/planSlot';
import { localDayIso, stopForDay, tripDays } from '@/utils/tripStops';

const DEFAULT_DURATION = 60;
const DEFAULT_START = '09:00';

export type PlanAddStep = 'choose' | 'schedule';

export function usePlanAdd(tripId: string | undefined, opts: { wishId?: string; day?: string; manual?: boolean }) {
  const { session } = useAuth();
  const { stops } = useTripStops(tripId);
  const [data, setData] = useState<PlanAddData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<PlanAddStep>(opts.wishId || opts.manual ? 'schedule' : 'choose');
  const [wish, setWish] = useState<PlanCandidate | null>(null);
  const [manual, setManual] = useState(!!opts.manual);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [day, setDay] = useState<string | null>(opts.day ?? null);
  const [start, setStart] = useState(DEFAULT_START);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    void getPlanAddData(tripId).then(result => {
      if (result.error !== null) { setError(result.error); return; }
      setData(result.data);
      const preset = opts.wishId ? result.data.allWishes.find(c => c.id === opts.wishId) ?? null : null;
      if (preset) { setWish(preset); setDuration(preset.duration_minutes ?? DEFAULT_DURATION); }
      else if (opts.wishId) setStep('choose'); // envie introuvable (non validée) : on laisse choisir
    });
    // Options lues une seule fois à l'ouverture de la page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const days = useMemo(() => (data ? tripDays(data.startDate, data.endDate) : []), [data]);
  const wishStop = wish?.stop_id ? stops.find(s => s.id === wish.stop_id) ?? null : null;
  /** Jours possibles : ceux de la ville de l'envie (sinon tout le voyage) */
  const allowedDays = useMemo(
    () => (wishStop ? days.filter(d => d >= wishStop.start_date.slice(0, 10) && d <= wishStop.end_date.slice(0, 10)) : days),
    [days, wishStop],
  );
  const today = localDayIso(new Date());
  const selectedDay = day && allowedDays.includes(day)
    ? day
    : allowedDays.includes(today) ? today : allowedDays[0] ?? null;

  const daySlots = useMemo(
    () => (data?.slots ?? []).filter(s => s.day_date === selectedDay)
      .sort((a, b) => (toMin(a.start_time) ?? 0) - (toMin(b.start_time) ?? 0)),
    [data, selectedDay],
  );
  const end = endFor(start, duration);
  const conflicts = useMemo(() => overlapping(daySlots, start, end), [daySlots, start, end]);
  const freeStart = useMemo(() => firstFreeStart(daySlots, duration), [daySlots, duration]);

  /** Candidats : ceux de la ville du jour choisi d'abord */
  const candidates = useMemo(() => {
    const dayStop = selectedDay ? stopForDay(stops, selectedDay) : null;
    return [...(data?.candidates ?? [])].sort((a, b) =>
      Number(b.stop_id === dayStop?.id) - Number(a.stop_id === dayStop?.id) || a.title.localeCompare(b.title));
  }, [data, stops, selectedDay]);

  const chooseWish = useCallback((candidate: PlanCandidate) => {
    setWish(candidate);
    setManual(false);
    setDuration(candidate.duration_minutes ?? DEFAULT_DURATION);
    setStep('schedule');
  }, []);
  const chooseManual = useCallback(() => {
    setWish(null);
    setManual(true);
    setDuration(DEFAULT_DURATION);
    setStep('schedule');
  }, []);
  const backToChoose = useCallback(() => setStep('choose'), []);

  const canSave = !!selectedDay && !saving && (manual ? title.trim().length > 0 : !!wish);

  /** Enregistre ; renvoie { id, day } ou une erreur. */
  const save = useCallback(async (): Promise<{ id: string; day: string } | { error: string }> => {
    if (!tripId || !selectedDay) return { error: 'Choisis un jour.' };
    const label = manual ? title : wish?.title ?? '';
    if (!label.trim()) return { error: 'Donne un titre à ce créneau.' };
    setSaving(true);
    const { data: created, error: saveError } = await createPlanningEntry({
      tripId,
      wishId: manual ? null : wish?.id ?? null,
      title: label,
      day: selectedDay,
      start,
      end,
      notes: manual ? notes : null,
      stopId: wishStop?.id ?? stopForDay(stops, selectedDay)?.id ?? null,
      userId: session?.user?.id ?? null,
    });
    setSaving(false);
    if (saveError !== null) return { error: saveError };
    tripEvents.emit();
    return { id: created.id, day: selectedDay };
  }, [tripId, selectedDay, manual, title, wish, start, end, notes, wishStop, stops, session]);

  return {
    loaded: !!data, error, step, backToChoose,
    candidates, wish, manual, chooseWish, chooseManual,
    title, setTitle, notes, setNotes,
    days, allowedDays, selectedDay, setDay, wishStop, stops,
    start, setStart, duration, setDuration, end, daySlots, conflicts, freeStart,
    canSave, saving, save,
  };
}
