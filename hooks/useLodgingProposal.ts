// HAKO — Hook « Proposer un logement » (app/trip/[id]/lodging-new.tsx)
// On choisit l'étape, on cherche chez Booking / Hostelworld (ville, dates,
// voyageurs et budget déjà remplis), on colle le lien de l'annonce : le
// logement devient une envie que le groupe vote (catégorie « hotel »).
// Le lien est lu (parse-listing) : nom, photos, adresse et prix s'ils sont
// publiés ; sinon une capture d'écran de l'annonce donne le prix.
// Ce que l'utilisateur a tapé n'est jamais écrasé.

import { useCallback, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/contexts/AuthContext';
import { useClipboardLink } from '@/hooks/useClipboardLink';
import { useLodgingGaps } from '@/hooks/useLodgingGaps';
import { useTripOverview } from '@/hooks/useTripOverview';
import { readListingScreenshot, readListingUrl } from '@/services/listingService';
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
  const [totalText, setTotalTextRaw] = useState('');
  const [priceTouched, setPriceTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lecture de l'annonce
  const [reading, setReading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [address, setAddress] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [priceFromScreenshot, setPriceFromScreenshot] = useState(false);
  const lastRead = useRef<string | null>(null);

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

  /** Lit l'annonce et pré-remplit ce qui n'a pas été tapé à la main. */
  const readUrl = useCallback(async (url: string) => {
    lastRead.current = url;
    setReading(true);
    setBlocked(false);
    const { data } = await readListingUrl(tripId, url);
    if (lastRead.current !== url) return; // un autre lien a été collé entre-temps
    setReading(false);
    if (!data) return;
    setBlocked(data.blocked);
    const listing = data.listing;
    if (!listing) return;
    setPhotos(listing.photos);
    setAddress(listing.address);
    if (listing.name && !nameTouched) setName(listing.name);
    if (listing.priceTotal !== null && !priceTouched) {
      setTotalTextRaw(String(listing.priceTotal).replace('.', ','));
      setCurrency(listing.currency);
    }
  }, [tripId, nameTouched, priceTouched]);

  /** Lien collé ou tapé : nom deviné depuis l'adresse, puis lecture de l'annonce. */
  const setLink = useCallback((value: string) => {
    setLinkRaw(value);
    const url = extractUrl(value);
    if (!url) { setPhotos([]); setAddress(null); setBlocked(false); lastRead.current = null; return; }
    if (!nameTouched) setName(lodgingNameFromUrl(url) ?? '');
    if (url !== lastRead.current) void readUrl(url);
  }, [nameTouched, readUrl]);

  /** Capture d'écran de l'annonce : Claude y lit le prix (et le nom). */
  const addScreenshot = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    const asset = res.canceled ? null : res.assets[0];
    if (!asset) return null;
    setReading(true);
    const { data, error } = await readListingScreenshot(tripId, asset.uri, asset.mimeType ?? 'image/jpeg', nights);
    setReading(false);
    if (error !== null) return error;
    if (!data) return 'Rien trouvé sur cette capture.';
    if (data.name && !nameTouched && !name.trim()) setName(data.name);
    if (data.priceTotal !== null) {
      setTotalTextRaw(String(data.priceTotal).replace('.', ','));
      setCurrency(data.currency);
      setPriceFromScreenshot(true);
      setPriceTouched(false);
      return null;
    }
    return 'Le prix n’apparaît pas sur cette capture.';
  }, [tripId, nights, nameTouched, name]);

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
      description: [site && site !== 'other' ? `Annonce ${LODGING_SITE_LABEL[site]}` : null, address].filter(Boolean).join(' · ') || null,
      linkUrl: url,
      imageUrl: null,
      place: null,
      category: 'hotel',
      stopId: stop.id,
      vibes: [],
      pricePerPerson: perPerson,
      durationMinutes: null,
      photos,
    });
    setSaving(false);
    if (error !== null) return error;
    tripEvents.emit();
    return null;
  }, [session?.user?.id, stop, url, tripId, name, site, address, perPerson, photos]);

  return {
    stops, gaps, stop, setStopId, travelers, nights, searches,
    clipboard, paste, link, setLink, url, site,
    name, setName: (v: string) => { setNameTouched(true); setName(v); },
    totalText, setTotalText: (v: string) => { setPriceTouched(true); setPriceFromScreenshot(false); setTotalTextRaw(v); },
    perPerson, canSave, saving, save,
    reading, photos, address, currency, blocked, priceFromScreenshot, addScreenshot,
  };
}
