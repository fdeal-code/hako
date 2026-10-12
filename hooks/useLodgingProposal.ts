// HAKO — Hook « Proposer un logement » (app/trip/[id]/lodging-new.tsx)
// On choisit l'étape, on cherche chez Booking / Hostelworld (ville, dates,
// voyageurs et budget déjà remplis), on colle le lien de l'annonce : le
// logement devient une envie que le groupe vote (catégorie « hotel »).

import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useClipboardLink } from '@/hooks/useClipboardLink';
import { useLodgingGaps } from '@/hooks/useLodgingGaps';
import { useTripOverview } from '@/hooks/useTripOverview';
import { createWish } from '@/services/wishService';
import { partnerLinks } from '@/utils/affiliateLinks';
import { parseAmount } from '@/utils/expenseForm';
import { LODGING_SITE_LABEL, lodgingNameFromUrl, lodgingSite } from '@/utils/lodgingLinks';
import { lodgingPerNight } from '@/utils/tripBudget';
import { nightsBetween } from '@/utils/tripStops';
import { extractUrl } from '@/utils/wishLinks';
import { tripEvents } from '@/utils/events';

export function useLodgingProposal(tripId: string, initialStopId: string | null) {
  const { session } = useAuth();
  const { overview } = useTripOverview(tripId);
  const { stops, gaps } = useLodgingGaps(tripId);
  const { clipboard, readLink } = useClipboardLink();

  const [stopId, setStopId] = useState<string | null>(initialStopId);
  const [link, setLinkRaw] = useState('');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [totalText, setTotalText] = useState('');
  const [saving, setSaving] = useState(false);

  // Étape : celle demandée, sinon la première sans logement, sinon la première
  const stop = stops.find(s => s.id === stopId) ?? gaps[0] ?? stops[0] ?? null;
  const travelers = Math.max(1, overview?.member_count ?? 1);
  const nights = stop ? nightsBetween(stop.start_date, stop.end_date) : 0;

  const searches = useMemo(() => {
    if (!stop) return [];
    const tripNights = overview?.start_date && overview.end_date ? nightsBetween(overview.start_date, overview.end_date) : 0;
    return partnerLinks('lodging', {
      city: stop.place_name,
      checkin: stop.start_date,
      checkout: stop.end_date,
      travelers,
      maxPerNightPerPerson: overview?.budget_per_person ? lodgingPerNight(overview.budget_per_person, tripNights) : null,
    });
  }, [stop, travelers, overview]);

  /** Lien collé ou tapé : on devine le nom du logement tant qu'on ne l'a pas modifié. */
  const setLink = useCallback((value: string) => {
    setLinkRaw(value);
    const url = extractUrl(value);
    if (url && !nameTouched) setName(lodgingNameFromUrl(url) ?? '');
  }, [nameTouched]);

  const paste = useCallback(async () => {
    const url = await readLink();
    if (url) setLink(url);
  }, [readLink, setLink]);

  const url = extractUrl(link);
  const site = url ? lodgingSite(url) : null;
  const total = parseAmount(totalText);
  const perPerson = total !== null ? Math.round((total / travelers) * 100) / 100 : null;
  const canSave = !!stop && !!url && name.trim().length > 1 && !saving;

  /** Enregistre l'envie logement. Renvoie une erreur, ou null. */
  const save = useCallback(async (): Promise<string | null> => {
    const userId = session?.user?.id;
    if (!userId || !stop || !url) return 'Choisis une étape et colle le lien de l’annonce.';
    setSaving(true);
    const { error } = await createWish({
      tripId,
      addedBy: userId,
      kind: 'place',
      title: name,
      description: site && site !== 'other' ? `Annonce ${LODGING_SITE_LABEL[site]}` : null,
      linkUrl: url,
      imageUrl: null,
      place: null,
      category: 'hotel',
      stopId: stop.id,
      vibes: [],
      pricePerPerson: perPerson,
      durationMinutes: null,
    });
    setSaving(false);
    if (error !== null) return error;
    tripEvents.emit();
    return null;
  }, [session?.user?.id, stop, url, tripId, name, site, perPerson]);

  return {
    stops, gaps, stop, setStopId, travelers, nights, searches,
    clipboard, paste, link, setLink, url, site,
    name, setName: (v: string) => { setNameTouched(true); setName(v); },
    totalText, setTotalText, perPerson, canSave, saving, save,
  };
}
