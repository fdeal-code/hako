// HAKO — Hook « Nouvelle envie »
// Gère les 4 écrans du parcours : choix (coller un lien / autres façons),
// aperçu du lien (TikTok, Reel…), recherche d'un lieu, note d'orga.
// Détecte un lien copié dans le presse-papier (au montage et au retour
// dans l'app, ex. après avoir copié un lien dans TikTok).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useClipboardLink } from '@/hooks/useClipboardLink';
import { useTripStops } from '@/hooks/useTripStops';
import { createWish, fetchLinkPreview, findPlaceInCaption, getPlaceDetails, searchPlaces } from '@/services/wishService';
import { TripStop } from '@/types/tripStops';
import { FoundPlace, LinkPreview, PlaceSuggestion, WishKind, WishVibe } from '@/types/wishDraft';
import { nearestStop } from '@/utils/tripStops';
import { categoryFromTypes, detectLinkSource, extractUrl, suggestVibes } from '@/utils/wishLinks';
import { tripEvents } from '@/utils/events';

export type NewWishScreen = 'choose' | 'link' | 'place' | 'orga';

const SEARCH_DEBOUNCE_MS = 400;
const LINK_FALLBACK_TITLE = 'Inspiration';

export function useNewWish(tripId: string, userId: string | undefined, initialScreen: NewWishScreen = 'choose') {
  const { stops } = useTripStops(tripId);
  const [screen, setScreen] = useState<NewWishScreen>(initialScreen);

  /* ── Presse-papier ── */
  const { clipboard, readLink } = useClipboardLink();

  /* ── Lien + aperçu ── */
  const [linkInput, setLinkInput] = useState('');
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  /* ── Lieu (trouvé dans la légende, ou choisi) ── */
  const [place, setPlace] = useState<FoundPlace | null>(null);
  const [placeDetected, setPlaceDetected] = useState(false);
  const [findingPlace, setFindingPlace] = useState(false);
  const [editingPlace, setEditingPlace] = useState(false);
  const [placeQuery, setPlaceQueryState] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Ambiances + orga ── */
  const [vibes, setVibes] = useState<WishVibe[]>([]);
  const [price, setPrice] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [orgaTitle, setOrgaTitle] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const stop: TripStop | null = useMemo(
    () => (place ? nearestStop(stops, place.lat, place.lng) : null),
    [place, stops],
  );
  const bias = useMemo(() => {
    const target = stop ?? stops.find(s => s.lat !== null && s.lng !== null) ?? null;
    return target && target.lat !== null && target.lng !== null ? { lat: target.lat, lng: target.lng } : null;
  }, [stop, stops]);

  const reset = useCallback(() => {
    setLinkInput(''); setPreview(null); setLoadingPreview(false);
    setPlace(null); setPlaceDetected(false); setFindingPlace(false); setEditingPlace(false);
    setPlaceQueryState(''); setSuggestions([]);
    setVibes([]); setPrice(null); setDuration(null); setOrgaTitle(''); setNote('');
  }, []);

  const goTo = useCallback((next: NewWishScreen) => {
    if (next === 'choose') reset();
    setScreen(next);
  }, [reset]);

  /** Ouvre l'aperçu d'un lien, puis cherche le lieu dans la légende. */
  const openLink = useCallback(async (raw: string) => {
    const url = extractUrl(raw) ?? raw.trim();
    if (!url) return;
    setLinkInput(url);
    setScreen('link');
    setLoadingPreview(true);
    const data = await fetchLinkPreview(url);
    setPreview(data);
    setLoadingPreview(false);
    const isVideo = data.source !== 'other';
    setVibes(isVideo ? ['insta'] : []);
    if (!data.title) return;
    setFindingPlace(true);
    const found = await findPlaceInCaption(data.title, stops);
    setFindingPlace(false);
    if (found) {
      setPlace(found);
      setPlaceDetected(true);
      setVibes(suggestVibes(found.types, isVideo));
    }
  }, [stops]);

  const pasteFromClipboard = useCallback(async () => {
    const url = await readLink();
    if (url) await openLink(url);
  }, [readLink, openLink]);

  const setPlaceQuery = useCallback((text: string) => {
    setPlaceQueryState(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void searchPlaces(text, bias).then(setSuggestions);
    }, SEARCH_DEBOUNCE_MS);
  }, [bias]);

  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  const choosePlace = useCallback(async (suggestion: PlaceSuggestion) => {
    setSuggestions([]);
    setPlaceQueryState(suggestion.description);
    const details = await getPlaceDetails(suggestion.place_id);
    if (!details) return;
    setPlace(details);
    setPlaceDetected(false);
    setEditingPlace(false);
    setVibes(prev => (prev.length > 0 ? prev : suggestVibes(details.types, screen === 'link')));
  }, [screen]);

  const startEditingPlace = useCallback(() => {
    setEditingPlace(true);
    setPlaceQueryState('');
    setSuggestions([]);
  }, []);

  const clearPlace = useCallback(() => {
    setPlace(null);
    setPlaceDetected(false);
    setPlaceQueryState('');
  }, []);

  const toggleVibe = useCallback((vibe: WishVibe) => {
    setVibes(prev => (prev.includes(vibe) ? prev.filter(v => v !== vibe) : [...prev, vibe]));
  }, []);

  const canSave =
    !saving && !!userId && (
      (screen === 'link' && !!preview) ||
      (screen === 'place' && !!place) ||
      (screen === 'orga' && orgaTitle.trim().length > 0)
    );

  /** Enregistre l'envie. Retourne un message d'erreur, ou null si c'est bon. */
  const save = useCallback(async (): Promise<string | null> => {
    if (!userId) return 'Connecte-toi pour ajouter une envie.';
    const kind: WishKind = screen === 'orga' ? 'orga' : place ? 'place' : 'inspiration';
    const title =
      screen === 'orga' ? orgaTitle
      : screen === 'place' ? place?.name ?? ''
      : preview?.title || place?.name || LINK_FALLBACK_TITLE;
    setSaving(true);
    const { error } = await createWish({
      tripId,
      addedBy: userId,
      kind,
      title,
      description: screen === 'orga' ? note : null,
      linkUrl: screen === 'link' ? preview?.url ?? null : null,
      imageUrl: screen === 'link' ? preview?.thumbnail ?? null : null,
      place: screen === 'orga' ? null : place,
      category: place ? categoryFromTypes(place.types) : null,
      stopId: stop?.id ?? null,
      vibes: screen === 'orga' ? [] : vibes,
      pricePerPerson: screen === 'orga' ? null : price,
      durationMinutes: screen === 'orga' ? null : duration,
    });
    setSaving(false);
    if (error !== null) return error;
    tripEvents.emit();
    return null;
  }, [userId, screen, place, orgaTitle, preview, tripId, note, stop, vibes, price, duration]);

  return {
    screen, goTo,
    clipboard, pasteFromClipboard,
    linkInput, setLinkInput, openLink,
    preview, loadingPreview, isVideo: preview ? detectLinkSource(preview.url) !== 'other' : false,
    place, placeDetected, findingPlace, stop,
    editingPlace, startEditingPlace, clearPlace,
    placeQuery, setPlaceQuery, suggestions, choosePlace,
    vibes, toggleVibe,
    price, setPrice, duration, setDuration,
    orgaTitle, setOrgaTitle, note, setNote,
    canSave, saving, save,
  };
}
