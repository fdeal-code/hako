// HAKO — Hook formulaire de création de voyage (6 étapes, maquettes « Parcours V2 »)
// Toute la logique vit ici ; l'écran app/trip/create.tsx ne fait qu'assembler
// les étapes. Les dates sont des chaînes "YYYY-MM-DD" (jamais de toISOString
// sur une date locale : ça décalait d'un jour en France).

import { useCallback, useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/contexts/AuthContext';
import { Friend, getAcceptedFriends } from '@/services/friendService';
import { CitySuggestion, searchCities } from '@/services/placesService';
import { createTrip, inviteByEmails, uploadCoverImage } from '@/services/tripService';
import { buildStopsFromDrafts, createTripStops } from '@/services/tripStopService';
import {
  DestinationPhoto,
  searchDestinationCovers,
  triggerUnsplashDownload,
} from '@/services/unsplashService';
import { StopDraft } from '@/types/tripStops';
import { TripVibe } from '@/types/tripStyle';
import { tripEvents } from '@/utils/events';
import {
  adjustNights as adjustNightsPure,
  buildDestinationLabel,
  distributeNights,
  isNightSplitValid,
  nightsBetween,
} from '@/utils/tripStops';

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const NAME_MAX_LENGTH = 50;

export interface CoverSuggestion {
  id: number;
  uri: string;
  /** Photo Unsplash source — null pour les placeholders de secours. */
  photo: DestinationPhoto | null;
}

const FALLBACK_COVERS: CoverSuggestion[] = Array.from({ length: 5 }, (_, i) => ({
  id: i + 1,
  uri: `https://picsum.photos/seed/hako${i + 1}/600/400`,
  photo: null,
}));

export type TravelMode = 'solo' | 'friends';

export function useCreateTripForm() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  /* ── Étape 1 : destinations ── */
  const [stops, setStops] = useState<StopDraft[]>([]);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      void searchCities(text).then(results => {
        setSuggestions(results);
        setSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const addStop = useCallback((draft: StopDraft) => {
    setStops(prev => [...prev, draft]);
    setQuery('');
    setSuggestions([]);
  }, []);

  const addStopFromSuggestion = useCallback((city: CitySuggestion) => {
    addStop({
      place_name: city.structured_formatting.main_text,
      description: city.description,
      secondary_text: city.structured_formatting.secondary_text,
      place_id: city.place_id,
      country_code: null,
      nights: 0,
    });
  }, [addStop]);

  const addStopFromPopular = useCallback((name: string, country: string) => {
    addStop({
      place_name: name,
      description: `${name}, ${country}`,
      secondary_text: country,
      place_id: null,
      country_code: null,
      nights: 0,
    });
  }, [addStop]);

  const removeStop = useCallback((index: number) => {
    setStops(prev => prev.filter((_, i) => i !== index));
  }, []);

  const moveStop = useCallback((index: number, direction: -1 | 1) => {
    setStops(prev => {
      const target = index + direction;
      const a = prev[index];
      const b = prev[target];
      if (!a || !b) return prev;
      const next = [...prev];
      next[index] = b;
      next[target] = a;
      return next;
    });
  }, []);

  const isMultiStop = stops.length > 1;
  const destinationLabel = buildDestinationLabel(stops.map(s => s.place_name));

  /* ── Étape 2 : dates ── */
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const selectDay = useCallback((day: string) => {
    if (!startDate || endDate) {
      setStartDate(day);
      setEndDate(null);
    } else if (day > startDate) {
      setEndDate(day);
    } else {
      setStartDate(day);
    }
  }, [startDate, endDate]);

  const totalNights = startDate && endDate ? nightsBetween(startDate, endDate) : 0;
  const enoughNights = totalNights >= Math.max(stops.length, 1);
  const datesValid = startDate !== null && endDate !== null && enoughNights;

  /* ── Étape 3 : nuits par ville ── */
  const ensureNightSplit = useCallback(() => {
    setStops(prev => {
      if (isNightSplitValid(prev, totalNights)) return prev;
      const split = distributeNights(totalNights, prev.length);
      return prev.map((s, i) => ({ ...s, nights: split[i] ?? 0 }));
    });
  }, [totalNights]);

  const adjustNights = useCallback((index: number, delta: 1 | -1) => {
    setStops(prev => {
      const next = adjustNightsPure(prev.map(s => s.nights), index, delta);
      return prev.map((s, i) => ({ ...s, nights: next[i] ?? s.nights }));
    });
  }, []);

  const nightSplitValid = isNightSplitValid(stops, totalNights);

  /* ── Étape 4 : voyageurs ── */
  const [travelMode, setTravelMode] = useState<TravelMode>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [selectedFriendIds, setSelectedFriendIds] = useState<ReadonlySet<string>>(new Set());
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void getAcceptedFriends(userId).then(({ data }) => {
      if (cancelled) return;
      setFriends(data ?? []);
      setLoadingFriends(false);
    });
    return () => { cancelled = true; };
  }, [userId]);

  const toggleFriend = useCallback((friendId: string) => {
    setSelectedFriendIds(prev => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId); else next.add(friendId);
      return next;
    });
  }, []);

  /** Ajoute un e-mail ; renvoie false s'il est invalide ou déjà présent. */
  const addEmail = useCallback((raw: string): boolean => {
    const email = raw.trim().toLowerCase();
    if (!email.includes('@') || inviteEmails.includes(email)) return false;
    setInviteEmails(prev => [...prev, email]);
    return true;
  }, [inviteEmails]);

  const removeEmail = useCallback((email: string) => {
    setInviteEmails(prev => prev.filter(e => e !== email));
  }, []);

  const guestCount = travelMode === 'friends' ? selectedFriendIds.size + inviteEmails.length : 0;

  /* ── Étape 5 : nom & couverture ── */
  const [tripName, setTripNameState] = useState('');
  const setTripName = useCallback((name: string) => setTripNameState(name.slice(0, NAME_MAX_LENGTH)), []);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [selectedCoverId, setSelectedCoverId] = useState<number | null>(null);
  const [destinationPhotos, setDestinationPhotos] = useState<DestinationPhoto[]>([]);
  const coverQuery = stops[0]?.description ?? '';

  useEffect(() => {
    if (!coverQuery) return;
    let cancelled = false;
    void searchDestinationCovers(coverQuery).then(photos => {
      if (cancelled) return;
      setDestinationPhotos(photos);
      setSelectedCoverId(null); // la liste change → sélection obsolète
    });
    return () => { cancelled = true; };
  }, [coverQuery]);

  const coverSuggestions: CoverSuggestion[] = destinationPhotos.length > 0
    ? destinationPhotos.map((photo, i) => ({ id: i + 1, uri: photo.url, photo }))
    : FALLBACK_COVERS;
  const selectedCover = coverUri === null && selectedCoverId !== null
    ? coverSuggestions.find(c => c.id === selectedCoverId) ?? null
    : null;

  /** Ouvre la galerie ; renvoie un message si la permission est refusée. */
  const pickCoverFromGallery = useCallback(async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return 'Autorise l’accès à ta galerie pour choisir une photo.';
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset) {
      setCoverUri(asset.uri);
      setSelectedCoverId(null);
    }
    return null;
  }, []);

  const selectCover = useCallback((id: number) => {
    setSelectedCoverId(id);
    setCoverUri(null);
  }, []);

  /* ── Étape 6 : style & budget ── */
  const [vibes, setVibes] = useState<TripVibe[]>([]);
  const [budget, setBudget] = useState<number | null>(null);
  const toggleVibe = useCallback((vibe: TripVibe) => {
    setVibes(prev => (prev.includes(vibe) ? prev.filter(v => v !== vibe) : [...prev, vibe]));
  }, []);

  /* ── Création ── */
  const [creating, setCreating] = useState(false);

  /** Crée le voyage ; renvoie un message d'erreur affichable, ou null si OK. */
  const create = useCallback(async (skipStyle: boolean): Promise<string | null> => {
    if (creating) return null;
    if (!userId) return 'Connecte-toi pour créer un voyage.';
    if (!startDate || !endDate) return 'Choisis tes dates.';
    setCreating(true);
    try {
      let coverImageUrl: string | null = null;
      if (coverUri) {
        const upload = await uploadCoverImage(userId, coverUri);
        if (upload.error !== null) return upload.error;
        coverImageUrl = upload.data;
      } else if (selectedCover) {
        coverImageUrl = selectedCover.uri;
        // Guideline Unsplash : ping du download endpoint quand la photo est utilisée
        if (selectedCover.photo) triggerUnsplashDownload(selectedCover.photo.downloadLocation);
      }

      const drafts = isMultiStop ? stops : stops.map(s => ({ ...s, nights: totalNights }));
      const newStops = await buildStopsFromDrafts(startDate, drafts);
      const firstStop = newStops[0];

      const { data: trip, error } = await createTrip({
        name: tripName.trim(),
        destination: destinationLabel,
        start_date: startDate,
        end_date: endDate,
        cover_image_url: coverImageUrl,
        owner_id: userId,
        destination_lat: firstStop?.lat ?? null,
        destination_lng: firstStop?.lng ?? null,
        destination_place_id: firstStop?.place_id ?? null,
        vibes: skipStyle ? [] : vibes,
        budget_per_person: skipStyle ? null : budget,
      });
      if (error !== null) return error;

      // Non bloquant : le voyage existe, les étapes se gèrent ensuite dans l'itinéraire
      const stopsResult = await createTripStops(trip.id, newStops);
      if (stopsResult.error !== null) console.log('[create] étapes non enregistrées :', stopsResult.error);

      if (travelMode === 'friends') {
        const friendEmails = friends
          .filter(f => selectedFriendIds.has(f.id) && f.email)
          .map(f => (f.email ?? '').trim().toLowerCase());
        const emails = [...new Set([...friendEmails, ...inviteEmails])];
        const invites = await inviteByEmails(trip.id, emails, userId);
        if (invites.error !== null) console.log('[create] invitations non envoyées :', invites.error);
      }

      tripEvents.emit();
      return null;
    } finally {
      setCreating(false);
    }
  }, [
    creating, userId, startDate, endDate, coverUri, selectedCover, isMultiStop, stops, totalNights,
    tripName, destinationLabel, vibes, budget, travelMode, friends, selectedFriendIds, inviteEmails,
  ]);

  return {
    // destinations
    stops, query, suggestions, searching, isMultiStop, destinationLabel,
    handleQueryChange, addStopFromSuggestion, addStopFromPopular, removeStop, moveStop,
    // dates
    startDate, endDate, selectDay, totalNights, enoughNights, datesValid,
    // nuits
    ensureNightSplit, adjustNights, nightSplitValid,
    // voyageurs
    travelMode, setTravelMode, friends, loadingFriends, selectedFriendIds, toggleFriend,
    inviteEmails, addEmail, removeEmail, guestCount,
    // nom & couverture
    tripName, setTripName, nameMaxLength: NAME_MAX_LENGTH,
    coverSuggestions, selectedCoverId, coverUri, selectedCover, pickCoverFromGallery, selectCover,
    // style
    vibes, toggleVibe, budget, setBudget,
    // création
    creating, create,
  };
}

export type CreateTripForm = ReturnType<typeof useCreateTripForm>;
