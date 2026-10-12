// HAKO — Hook Paramètres d'un voyage
// Charge le voyage + les membres ; chaque modification est enregistrée
// tout de suite (le nom à la fin de la saisie, le budget après une courte
// pause) puis signalée aux dashboards via tripEvents.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { getOrCreateInviteToken } from '@/services/inviteLinkService';
import { track } from '@/services/telemetryService';
import { uploadCoverImage } from '@/services/tripService';
import {
  deleteTrip, getTripSettings, removeTripMember, shiftTripDates, updateTripSettings,
} from '@/services/tripSettingsService';
import { DestinationPhoto, searchDestinationCovers, triggerUnsplashDownload } from '@/services/unsplashService';
import { TripSettings, TripSettingsPatch } from '@/types/tripSettings';
import { TripVibe } from '@/types/tripStyle';
import { tripEvents } from '@/utils/events';
import { buildTripInviteMessage } from '@/utils/shareLinks';

const BUDGET_SAVE_DELAY_MS = 600;

export function useTripSettings(tripId: string | undefined) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [settings, setSettings] = useState<TripSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [covers, setCovers] = useState<DestinationPhoto[]>([]);
  const budgetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = useCallback((result: Awaited<ReturnType<typeof getTripSettings>>) => {
    if (result.error !== null) setError(result.error);
    else { setSettings(result.data); setError(null); }
  }, []);

  const refresh = useCallback(async () => {
    if (tripId) apply(await getTripSettings(tripId));
  }, [tripId, apply]);

  // Rechargé à chaque retour sur la page (ex. après « Inviter des amis »)
  useFocusEffect(useCallback(() => {
    if (tripId) void getTripSettings(tripId).then(apply);
  }, [tripId, apply]));

  // Suggestions de couverture pour la destination (Unsplash)
  const destination = settings?.destination ?? '';
  useEffect(() => {
    if (!destination) return;
    let cancelled = false;
    void searchDestinationCovers(destination).then(photos => { if (!cancelled) setCovers(photos); });
    return () => { cancelled = true; };
  }, [destination]);

  useEffect(() => () => { if (budgetTimer.current) clearTimeout(budgetTimer.current); }, []);

  const isOwner = !!settings && settings.ownerId === userId;

  /** Enregistre un patch ; met à jour l'écran tout de suite (retour en arrière si erreur). */
  const save = useCallback(async (patch: TripSettingsPatch): Promise<string | null> => {
    if (!tripId) return 'Voyage introuvable.';
    setSaving(true);
    const { error: saveError } = await updateTripSettings(tripId, patch);
    setSaving(false);
    if (saveError !== null) { void refresh(); return saveError; }
    tripEvents.emit();
    return null;
  }, [tripId, refresh]);

  const rename = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!settings || !trimmed || trimmed === settings.name) return null;
    setSettings({ ...settings, name: trimmed });
    return save({ name: trimmed });
  }, [settings, save]);

  const toggleVibe = useCallback((vibe: TripVibe) => {
    if (!settings) return;
    const vibes = settings.vibes.includes(vibe) ? settings.vibes.filter(v => v !== vibe) : [...settings.vibes, vibe];
    setSettings({ ...settings, vibes });
    void save({ vibes });
  }, [settings, save]);

  const setBudget = useCallback((budget: number | null) => {
    if (!settings) return;
    setSettings({ ...settings, budgetPerPerson: budget });
    if (budgetTimer.current) clearTimeout(budgetTimer.current);
    budgetTimer.current = setTimeout(() => { void save({ budget_per_person: budget }); }, BUDGET_SAVE_DELAY_MS);
  }, [settings, save]);

  const chooseCover = useCallback(async (photo: DestinationPhoto) => {
    if (!settings) return null;
    setSettings({ ...settings, coverUrl: photo.url });
    triggerUnsplashDownload(photo.downloadLocation);
    return save({ cover_image_url: photo.url });
  }, [settings, save]);

  const uploadCover = useCallback(async (localUri: string): Promise<string | null> => {
    if (!settings || !userId) return 'Connecte-toi pour changer la photo.';
    setSaving(true);
    const { data, error: uploadError } = await uploadCoverImage(userId, localUri);
    setSaving(false);
    if (uploadError !== null) return uploadError;
    setSettings({ ...settings, coverUrl: data });
    return save({ cover_image_url: data });
  }, [settings, userId, save]);

  const shiftDates = useCallback(async (days: number): Promise<string | null> => {
    if (!settings || !tripId) return null;
    setSaving(true);
    const { error: shiftError } = await shiftTripDates(tripId, settings.startDate, settings.endDate, days);
    setSaving(false);
    if (shiftError !== null) return shiftError;
    await refresh();
    tripEvents.emit();
    return null;
  }, [settings, tripId, refresh]);

  const removeMember = useCallback(async (memberId: string): Promise<string | null> => {
    if (!tripId) return null;
    const { error: removeError } = await removeTripMember(tripId, memberId);
    if (removeError !== null) return removeError;
    await refresh();
    tripEvents.emit();
    return null;
  }, [tripId, refresh]);

  const leave = useCallback(async (): Promise<string | null> => {
    if (!tripId || !userId) return null;
    const { error: leaveError } = await removeTripMember(tripId, userId);
    if (leaveError !== null) return leaveError;
    tripEvents.emit();
    return null;
  }, [tripId, userId]);

  const remove = useCallback(async (): Promise<string | null> => {
    if (!tripId) return null;
    const { error: deleteError } = await deleteTrip(tripId);
    if (deleteError !== null) return deleteError;
    tripEvents.emit();
    return null;
  }, [tripId]);

  /** Message d'invitation (lien « rejoindre » du voyage) à partager. */
  const inviteMessage = useCallback(async (): Promise<{ message: string } | { error: string }> => {
    if (!settings || !userId) return { error: 'Connecte-toi pour inviter.' };
    const { data, error: tokenError } = await getOrCreateInviteToken(settings.id, userId);
    if (tokenError !== null) return { error: tokenError };
    track('invite_link_shared', { from: 'settings' }, settings.id);
    return { message: buildTripInviteMessage(data, settings.name) };
  }, [settings, userId]);

  return {
    inviteMessage,
    settings, error, saving, isOwner, userId, covers,
    rename, toggleVibe, setBudget, chooseCover, uploadCover, shiftDates,
    removeMember, leave, remove, refresh,
  };
}
