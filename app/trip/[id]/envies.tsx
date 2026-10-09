import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { Colors, Fonts, Spacing, Radii, Shadows, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { NavButton } from '@/components/ui/NavButton';
import { FilterButton } from '@/components/ui/FilterButton';
import { computeWishStatus, majorityThreshold } from '@/utils/wishVotes';
import { VoteCard, VoteCardMember } from '@/components/envies/VoteCard';
import { ValidatedRow, ValidatedStatusKind } from '@/components/envies/ValidatedRow';
import { HelpShortcut } from '@/components/ui/HelpShortcut';
import { markWishBooked, unmarkWishBooked } from '@/services/bookingService';
import { localDayIso } from '@/utils/tripStops';
import { durationMinutes, formatMinutes, priceLabel } from '@/utils/wishPriceDuration';
import { PriceDurationFields } from '@/components/envies/PriceDurationFields';
import { useWishComments } from '@/hooks/useWishComments';
import { tripEvents } from '@/utils/events';
import { buildWishVoteReminderUrl } from '@/utils/shareLinks';
import { useTripStops } from '@/hooks/useTripStops';
import { useWishFilters } from '@/hooks/useWishFilters';
import { PrepPill } from '@/components/preparation/PrepParts';
import { activeFilterCount, compareWishes, matchesWishFilters } from '@/utils/wishFilters';


/* ─── Types ──────────────────────────────────────────────────── */
type WishType     = 'place' | 'inspiration' | 'orga';
type Category     = 'restaurant' | 'monument' | 'cafe' | 'hotel' | 'activity' | 'photo' | 'photo_spot' | 'bar' | 'other';
type WishStatus   = 'pending' | 'validated' | 'debate' | 'archived';
type VoteType     = 'up' | 'down';
type StatusFilter = 'all' | 'pending' | 'validated' | 'archived';
type BudgetLevel  = 'free' | '€' | '€€' | '€€€';
type DurationKey  = '30min' | '1h' | '2h' | 'half-day' | 'day';

interface WishVote {
  id:      string;
  wish_id: string;
  user_id: string;
  vote:    VoteType;
}

interface Wish {
  id:             string;
  trip_id:        string;
  added_by:       string;
  added_by_name?: string;
  stop_id?:       string | null;  // ville du voyage (multi-étapes)
  title:          string;
  description?:   string;
  category?:      Category;
  cover_url?:     string;
  image_url?:     string;
  link_url?:      string;
  address?:       string;
  budget?:        BudgetLevel;      // ancien niveau (lu en secours)
  duration?:      DurationKey;      // ancienne durée (lue en secours)
  price_per_person?: number | null; // € par personne
  duration_minutes?: number | null;
  status:         WishStatus;
  wish_votes:     WishVote[];
  created_at:     string;
  latitude?:      number;
  longitude?:     number;
  type?:          WishType;
  done?:          boolean;
  google_rating?: number;
  links?:         WishLink[];
  booked_at?:     string | null;   // « J'ai réservé » (migration wish_booking)
  booked_by?:     string | null;
  booked_amount?: number | null;
  vibes?:         string[] | null; // tags d'ambiance (chill, foodie…)
}

interface WishLink {
  url:        string;
  thumbnail?: string;
  title?:     string;
}


interface LinkPreviewData { title: string; thumbnail: string | null; author: string | null; }
interface PlaceSuggestion  { place_id: string; description: string; }
interface PlaceDetails {
  address:      string;
  lat:          number;
  lng:          number;
  name?:        string;
  rating?:      number;
  photoUrl?:    string;
  googleTypes?: string[];
}

/* ─── Config ─────────────────────────────────────────────────── */






/* ─── Helpers ────────────────────────────────────────────────── */
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

/* ─── Liste V2 (maquettes « Envies · À voter / Validées ») ───── */
const CATEGORY_LABEL: Record<Category, string> = {
  restaurant: 'Resto', monument: 'Monument', cafe: 'Café', hotel: 'Logement', activity: 'Activité',
  photo: 'Spot photo', photo_spot: 'Spot photo', bar: 'Bar', other: 'Lieu',
};
const INSPIRATION_WIDTH_RATIO = 0.72; // la carte suivante dépasse : on comprend qu'on peut glisser
const DETAIL_ACTIONS_SPACE = 120; // barre d'actions fixe de la fiche détail
const WEEKDAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

interface PlannedSlot { day_date: string; start_time: string | null }

function isVideoLink(url?: string): boolean {
  return !!url && (url.includes('tiktok.com') || url.includes('instagram.com'));
}

function wishTag(w: { type?: WishType; category?: Category; link_url?: string }, city: string | null): string {
  const kind = isVideoLink(w.link_url)
    ? (w.link_url?.includes('tiktok.com') ? 'TikTok' : 'Reel')
    : CATEGORY_LABEL[w.category ?? 'other'];
  return city ? `${kind} · ${city}` : kind;
}

function plannedLabel(slot: PlannedSlot): string {
  const [y, m, d] = slot.day_date.split('-').map(Number);
  const weekday = WEEKDAY_SHORT[new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()] ?? '';
  const time = slot.start_time ? ` · ${slot.start_time.slice(0, 5)}` : '';
  return `${weekday} ${String(d ?? '').padStart(2, '0')}${time}`;
}

/** Statut d'une envie selon les votes et la taille du groupe (règle majoritaire). */
function computeStatus(votes: WishVote[], memberCount: number): WishStatus {
  return computeWishStatus(votes, memberCount);
}

async function fetchLinkData(url: string): Promise<LinkPreviewData | null> {
  if (!url.includes('tiktok.com')) return null;
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return { title: data.title ?? '', thumbnail: data.thumbnail_url ?? null, author: data.author_name ?? null };
  } catch { return null; }
}

async function fetchPlaces(query: string): Promise<PlaceSuggestion[]> {
  if (!GOOGLE_API_KEY || query.length < 3) return [];
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&language=fr&key=${GOOGLE_API_KEY}`
    );
    const json = await res.json();
    if (json.status === 'OK') return json.predictions ?? [];
  } catch {}
  return [];
}

async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!GOOGLE_API_KEY) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address,name,rating,photos,types&key=${GOOGLE_API_KEY}`
    );
    const json = await res.json();
    if (json.status === 'OK' && json.result?.geometry?.location) {
      const loc         = json.result.geometry.location;
      const lat         = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
      const lng         = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
      const address     = json.result.formatted_address ?? '';
      const name        = json.result.name ?? undefined;
      const rating      = json.result.rating ?? undefined;
      const googleTypes = json.result.types ?? undefined;
      const photoRef    = json.result.photos?.[0]?.photo_reference;
      const photoUrl    = photoRef
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photo_reference=${photoRef}&key=${GOOGLE_API_KEY}`
        : undefined;
      return { address, lat, lng, name, rating, photoUrl, googleTypes };
    }
  } catch (e) {
    console.warn('[PLACE DETAILS] ERROR:', e);
  }
  return null;
}


/* ─── DetailSheet ────────────────────────────────────────────── */
function DetailSheet({
  wish, currentUserId, isAuthor, members: tripMembers, cityName, checkInDay, stopId, onBooked,
  onVote, onUpdate, onArchive, onDelete, onClose, onAddToPlanning,
}: {
  wish:            Wish | null;
  members:         VoteCardMember[];
  cityName:        string | null;
  /** Jour du check-in si « J'ai réservé » (début de l'étape de l'envie). */
  checkInDay:      string;
  stopId:          string | null;
  /** Rafraîchit la liste après une réservation. */
  onBooked:        () => void;
  currentUserId:   string;
  isAuthor:        boolean;
  onVote:          (wishId: string, vote: VoteType) => void;
  onUpdate:        (wishId: string, patch: Partial<Wish>) => void;
  onArchive:       (wishId: string) => void;
  onDelete:        (wishId: string) => void;
  onClose:         () => void;
  onAddToPlanning: (w: { id: string; title: string }) => void;
}) {
  const insets = useSafeAreaInsets();

  const [editingAddr,   setEditingAddr]   = useState(false);
  const [addrInput,     setAddrInput]     = useState('');
  const [addrSugs,      setAddrSugs]      = useState<PlaceSuggestion[]>([]);
  const [editingDesc,   setEditingDesc]   = useState(false);
  const [descInput,     setDescInput]     = useState('');
  const [commentText,   setCommentText]   = useState('');
  const { comments, sending: isSending, send: sendCommentText, remove: removeComment } = useWishComments(wish?.id ?? null, currentUserId || null);

  /* ── Associate a place (for inspirations) ── */
  const [showAssociate,  setShowAssociate]  = useState(false);
  const [associateQuery, setAssociateQuery] = useState('');
  const [associateSugs,  setAssociateSugs]  = useState<PlaceSuggestion[]>([]);
  const associateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Add video (for places) ── */
  const [addingVideo,    setAddingVideo]    = useState(false);
  const [videoInput,     setVideoInput]     = useState('');
  const [isFetchingVid,  setIsFetchingVid]  = useState(false);


  const addrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── « J'ai réservé » ── */
  const [bookingOpen,  setBookingOpen]  = useState(false);
  const [amountInput,  setAmountInput]  = useState('');
  const [booking,      setBooking]      = useState(false);

  useEffect(() => {
    if (wish) {
      setEditingAddr(false); setAddrInput(wish.address ?? ''); setAddrSugs([]);
      setEditingDesc(false); setDescInput(wish.description ?? '');
      setCommentText('');
      setShowAssociate(false); setAssociateQuery(''); setAssociateSugs([]);
      setAddingVideo(false); setVideoInput('');
      setBookingOpen(false); setAmountInput('');
    }
  }, [wish?.id]);

  if (!wish) return null;

  const myVote      = wish.wish_votes.find(v => v.user_id === currentUserId)?.vote ?? null;
  const isVideo     = isVideoLink(wish.link_url);
  const imageUri    = wish.image_url ?? wish.cover_url;

  const handleAddrInput = (text: string) => {
    setAddrInput(text);
    if (addrTimer.current) clearTimeout(addrTimer.current);
    addrTimer.current = setTimeout(async () => {
      const results = await fetchPlaces(text);
      setAddrSugs(results);
    }, 400);
  };

  const selectAddr = async (place: PlaceSuggestion) => {
    setAddrSugs([]);
    setEditingAddr(false);
    const details = await fetchPlaceDetails(place.place_id);
    const address = details?.address || place.description;
    setAddrInput(address);
    const patch: Partial<Wish> = { address };
    if (details) { patch.latitude = details.lat; patch.longitude = details.lng; }
    onUpdate(wish.id, patch);
  };

  const handleAssociateSearch = (text: string) => {
    setAssociateQuery(text);
    if (associateTimer.current) clearTimeout(associateTimer.current);
    associateTimer.current = setTimeout(async () => {
      const results = await fetchPlaces(text);
      setAssociateSugs(results);
    }, 400);
  };

  const selectAssociatePlace = async (sug: PlaceSuggestion) => {
    setAssociateSugs([]);
    const details = await fetchPlaceDetails(sug.place_id);
    if (details) {
      const patch: Partial<Wish> = {
        type:          'place',
        address:       details.address,
        latitude:      details.lat,
        longitude:     details.lng,
        google_rating: details.rating,
        image_url:     details.photoUrl ?? wish.image_url,
      };
      onUpdate(wish.id, patch);
      setShowAssociate(false);
    }
  };

  const handleAddVideoToWish = async () => {
    const url = videoInput.trim();
    if (!url) return;
    setIsFetchingVid(true);
    const data = await fetchLinkData(url);
    setIsFetchingVid(false);
    const newLink: WishLink = {
      url,
      thumbnail: data?.thumbnail ?? undefined,
      title:     data?.title     ?? undefined,
    };
    const updatedLinks = [...(wish.links ?? []), newLink];
    onUpdate(wish.id, { links: updatedLinks });
    setVideoInput('');
    setAddingVideo(false);
  };

  const handleRemoveVideoFromWish = (index: number) => {
    const updatedLinks = (wish.links ?? []).filter((_, i) => i !== index);
    onUpdate(wish.id, { links: updatedLinks.length > 0 ? updatedLinks : undefined });
  };

  const saveDesc = () => {
    onUpdate(wish.id, { description: descInput.trim() || undefined });
    setEditingDesc(false);
  };
  const sendComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setCommentText('');
    const error = await sendCommentText(text);
    if (error) { setCommentText(text); Alert.alert('Oups', error); }
  };
  const confirmDeleteComment = (commentId: string) => Alert.alert('Supprimer ce commentaire ?', undefined, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: () => { void removeComment(commentId).then(err => { if (err) Alert.alert('Oups', err); }); } },
  ]);

  const confirmArchive = () => Alert.alert(
    'Archiver', 'Archiver cette envie ?',
    [{ text: 'Annuler', style: 'cancel' }, { text: 'Archiver', onPress: () => { onArchive(wish.id); onClose(); } }]
  );
  const confirmDelete = () => Alert.alert(
    'Supprimer', 'Supprimer définitivement cette envie ?',
    [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => { onDelete(wish.id); onClose(); } }]
  );

  const isOrga = wish.type === 'orga';
  const yesCount = wish.wish_votes.filter(v => v.vote === 'up').length;
  const threshold = majorityThreshold(Math.max(1, tripMembers.length));
  const isValidated = wish.status === 'validated';
  const isRejected = wish.status === 'archived';
  const isLodging = wish.category === 'hotel';
  const heroWord = (wish.title.split(/\s+/)[0] ?? '').toUpperCase();
  const tag = wishTag(wish, cityName);
  const minutes = durationMinutes(wish.duration_minutes, wish.duration);
  const durationLabel = minutes !== null ? formatMinutes(minutes) : null;
  const budgetLabel = priceLabel(wish.price_per_person, wish.budget);
  const pendingMembers = tripMembers.filter(m => !wish.wish_votes.some(v => v.user_id === m.user_id));
  const sourceHost = (() => {
    if (!wish.link_url) return null;
    try { return new URL(wish.link_url).hostname.replace(/^www\./, ''); } catch { return null; }
  })();

  const openLink = async (url: string) => {
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else await WebBrowser.openBrowserAsync(url);
    } catch {
      await WebBrowser.openBrowserAsync(url);
    }
  };

  const remind = () => {
    void Linking.openURL(buildWishVoteReminderUrl(wish.title, pendingMembers.map(m => m.nickname ?? 'Membre')));
  };

  const isBooked = !!wish.booked_at;
  const canBook = isValidated && !isOrga && (isLodging || !!wish.link_url);
  const bookedByName = wish.booked_by === currentUserId
    ? 'toi'
    : tripMembers.find(m => m.user_id === wish.booked_by)?.nickname ?? 'un membre';
  const shortCheckIn = `${checkInDay.slice(8, 10)}/${checkInDay.slice(5, 7)}`;

  const confirmBooking = async (withAmount: boolean) => {
    const parsed = Number(amountInput.replace(',', '.'));
    const amount = withAmount && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    if (withAmount && amount === null) {
      Alert.alert('Montant', 'Entre le montant total payé, ou passe cette étape.');
      return;
    }
    setBooking(true);
    const { data, error } = await markWishBooked({
      wishId: wish.id,
      tripId: wish.trip_id,
      title: wish.title,
      userId: currentUserId,
      amount,
      checkInDay,
      stopId,
      memberIds: tripMembers.map(m => m.user_id),
      today: localDayIso(new Date()),
    });
    setBooking(false);
    if (error !== null) { Alert.alert('Oups', error); return; }
    setBookingOpen(false);
    onBooked(); // la liste (et donc la fiche ouverte) se rafraîchit
    Alert.alert(
      'C’est réservé !',
      [
        data.planned ? `Check-in ajouté au planning le ${shortCheckIn}.` : null,
        data.expenseCreated ? `${amount} € partagés dans le budget.` : null,
      ].filter(Boolean).join('\n') || 'Le groupe voit que c’est réservé.',
    );
  };

  const cancelBooking = () => Alert.alert(
    'Annuler la réservation ?',
    'Le planning et la dépense restent : tu peux les modifier dans leurs écrans.',
    [
      { text: 'Non', style: 'cancel' },
      { text: 'Annuler', style: 'destructive', onPress: () => { void unmarkWishBooked(wish.id).then(() => onBooked()); } },
    ],
  );

  return (
    <Modal visible={!!wish} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={dv.root}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: DETAIL_ACTIONS_SPACE + insets.bottom }}
        >
          {/* ── Hero (maquette « Envie · Détail vote ») ── */}
          <View style={dv.hero}>
            {imageUri
              ? <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              : <View style={[StyleSheet.absoluteFill, dv.heroEmpty]} />}
            <View style={dv.heroDim} />
            <View style={[dv.heroContent, { paddingTop: insets.top + Spacing.sm }]}>
              <TouchableOpacity style={dv.closeBtn} onPress={onClose} activeOpacity={0.85} accessibilityLabel="Fermer">
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
              <View>
                <Text style={dv.heroWord} adjustsFontSizeToFit numberOfLines={1}>{heroWord}</Text>
                <View style={dv.heroMeta}>
                  <View style={dv.badge}>
                    {isVideo && <Ionicons name="logo-tiktok" size={14} color={Colors.textPrimary} />}
                    <Text style={dv.badgeText} numberOfLines={1}>{tag}</Text>
                  </View>
                  <View style={dv.avatars}>
                    {tripMembers.slice(0, 3).map((m, i) => (
                      <View key={m.user_id} style={[dv.avatar, i > 0 && dv.avatarOverlap]}>
                        {m.avatar_url
                          ? <Image source={{ uri: m.avatar_url }} style={dv.avatarImg} />
                          : <Text style={dv.avatarInitial}>{(m.nickname ?? '?')[0]?.toUpperCase()}</Text>}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ── Nappe ── */}
          <View style={dv.sheet}>
            <View style={dv.titleBlock}>
              <Text style={dv.title}>{wish.title}</Text>
              <Text style={dv.subtitle} numberOfLines={2}>
                {[wish.address, sourceHost && `via ${sourceHost}`, wish.google_rating ? `★ ${wish.google_rating}` : null]
                  .filter(Boolean).join(' · ') || tag}
              </Text>
            </View>

            {/* Bandeau validée / écartée */}
            {isValidated && !isOrga && (
              <View style={dv.validated}>
                <View style={dv.validatedCheck}>
                  <Ionicons name="checkmark" size={16} color={Colors.textInverted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={dv.validatedTitle}>Validée par le groupe</Text>
                  <Text style={dv.validatedSub}>{yesCount} partant{yesCount > 1 ? 's' : ''} sur {tripMembers.length}</Text>
                </View>
              </View>
            )}
            {isBooked && (
              <View style={dv.booked}>
                <Ionicons name="checkmark-done" size={18} color={Colors.textInverted} />
                <Text style={dv.bookedText}>
                  Réservé par {bookedByName}{wish.booked_amount ? ` · ${Math.round(wish.booked_amount)} €` : ''}
                </Text>
                <TouchableOpacity onPress={cancelBooking} hitSlop={8}>
                  <Text style={dv.bookedCancel}>Annuler</Text>
                </TouchableOpacity>
              </View>
            )}
            {canBook && !isBooked && (
              <View style={dv.section}>
                <Text style={dv.sectionLabel}>UNE FOIS RÉSERVÉ, HAKO S’OCCUPE DU RESTE</Text>
                <View style={dv.afterRow}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.accent} />
                  <Text style={dv.afterText}>Ajouté au planning{cityName ? ` · ${cityName}` : ''}, le {shortCheckIn}</Text>
                </View>
                <View style={dv.afterRow}>
                  <Ionicons name="wallet-outline" size={16} color={Colors.accent} />
                  <Text style={dv.afterText}>Dépense partagée entre {tripMembers.length} personne{tripMembers.length > 1 ? 's' : ''}</Text>
                </View>
              </View>
            )}
            {isRejected && (
              <View style={dv.rejected}>
                <Ionicons name="close-circle-outline" size={18} color={Colors.textMuted} />
                <Text style={dv.rejectedText}>Écartée : la majorité n’était pas partante.</Text>
              </View>
            )}

            {/* QUAND / PRIX */}
            {!isOrga && (
              <View style={dv.boxes}>
                <View style={[dv.box, dv.boxLight]}>
                  <Text style={dv.boxLabel}>DURÉE</Text>
                  <Text style={dv.boxValue} numberOfLines={1}>{durationLabel ?? '—'}</Text>
                  <Text style={dv.boxSub}>{durationLabel ? 'estimée' : 'à préciser'}</Text>
                </View>
                <View style={[dv.box, dv.boxDark]}>
                  <Text style={[dv.boxLabel, dv.onDark]}>PRIX</Text>
                  <Text style={[dv.boxValue, dv.onDark]} numberOfLines={1}>{budgetLabel ?? '—'}</Text>
                  <Text style={dv.boxSubAccent}>par personne</Text>
                </View>
              </View>
            )}

            {/* Réserver (logement validé avec lien partenaire) */}
            {isValidated && isLodging && wish.link_url && (
              <TouchableOpacity style={dv.linkRow} onPress={() => { void openLink(wish.link_url!); }} activeOpacity={0.85}>
                <Ionicons name="bed-outline" size={20} color={Colors.textInk} />
                <Text style={dv.linkTitle}>Réserver le logement</Text>
                {sourceHost && <Text style={dv.linkSource}>{sourceHost}</Text>}
                <Ionicons name="open-outline" size={16} color={Colors.textInk} />
              </TouchableOpacity>
            )}

            {/* Votes du groupe */}
            {!isOrga && (
              <View style={dv.section}>
                <View style={dv.sectionRow}>
                  <Text style={dv.sectionLabel}>VOTES DU GROUPE</Text>
                  <Text style={dv.sectionRight}>{yesCount} / {tripMembers.length} partants</Text>
                </View>
                <View style={dv.card}>
                  {tripMembers.map((member, i) => {
                    const vote = wish.wish_votes.find(v => v.user_id === member.user_id)?.vote ?? null;
                    const isMe = member.user_id === currentUserId;
                    const status = vote === 'up' ? 'Partant'
                      : vote === 'down' ? 'Bof'
                      : isMe ? 'À toi de voter' : 'Pas encore voté';
                    return (
                      <View key={member.user_id} style={[dv.voteRow, i > 0 && dv.voteRowDivider]}>
                        <View style={[dv.voteAvatar, vote === null && dv.voteAvatarPending]}>
                          {vote !== null && member.avatar_url
                            ? <Image source={{ uri: member.avatar_url }} style={dv.avatarImg} />
                            : <Text style={dv.avatarInitial}>{vote === null ? '?' : (member.nickname ?? '?')[0]?.toUpperCase()}</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={dv.voteName}>{isMe ? 'Toi' : (member.nickname ?? 'Membre')}</Text>
                          <Text style={[dv.voteStatus, isMe && vote === null && dv.voteStatusAccent]}>{status}</Text>
                        </View>
                        {vote !== null ? (
                          <View style={[dv.voteIcon, { backgroundColor: vote === 'up' ? Colors.accent : Colors.primary }]}>
                            <Ionicons name={vote === 'up' ? 'thumbs-up' : 'thumbs-down'} size={13} color={Colors.textInverted} />
                          </View>
                        ) : !isMe ? (
                          <TouchableOpacity style={dv.remindPill} onPress={remind} activeOpacity={0.85}>
                            <Ionicons name="paper-plane-outline" size={13} color={Colors.textPrimary} />
                            <Text style={dv.remindText}>Relancer</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
                {tripMembers.length > 1 && (
                  <Text style={dv.rule}>Validée automatiquement dès {threshold} partants sur {tripMembers.length}.</Text>
                )}
              </View>
            )}

            {/* ── Détails (édition, vidéos, commentaires…) ── */}
            {wish.type === 'place' && (
              <View style={ds.videoSection}>
                <View style={ds.videoSectionHeader}>
                  <Text style={dv.sectionLabel}>VIDÉOS</Text>
                  {!addingVideo && (
                    <TouchableOpacity style={ds.videoAddPill} onPress={() => setAddingVideo(true)} activeOpacity={0.75}>
                      <Ionicons name="add" size={15} color={Colors.primary} />
                      <Text style={ds.videoAddPillText}>Ajouter</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {addingVideo && (
                  <View style={ds.videoInputWrap}>
                    <TextInput
                      style={ds.videoInput}
                      placeholder="Colle un lien TikTok ou Reel..."
                      placeholderTextColor={Colors.textTertiary}
                      value={videoInput}
                      onChangeText={setVideoInput}
                      autoFocus
                      autoCorrect={false}
                      autoCapitalize="none"
                      onSubmitEditing={handleAddVideoToWish}
                    />
                    <View style={ds.videoInputActions}>
                      <TouchableOpacity style={ds.videoCancelBtn} onPress={() => { setAddingVideo(false); setVideoInput(''); }} activeOpacity={0.7}>
                        <Text style={ds.videoCancelText}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[ds.videoConfirmBtn, (!videoInput.trim() || isFetchingVid) && { opacity: 0.4 }]}
                        onPress={handleAddVideoToWish}
                        disabled={!videoInput.trim() || isFetchingVid}
                        activeOpacity={0.8}
                      >
                        {isFetchingVid ? <ActivityIndicator size="small" color="white" /> : <Text style={ds.videoConfirmText}>Ajouter</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {wish.links && wish.links.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ds.videoScroll}>
                    {wish.links.map((vl, i) => (
                      <View key={i} style={ds.videoCard}>
                        <TouchableOpacity onPress={() => { void openLink(vl.url); }} activeOpacity={0.85}>
                          <View style={ds.videoThumbWrap}>
                            {vl.thumbnail ? (
                              <Image source={{ uri: vl.thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            ) : (
                              <View style={[StyleSheet.absoluteFill, dv.videoEmptyThumb]}>
                                <Ionicons name="logo-tiktok" size={28} color={Colors.textTertiary} />
                              </View>
                            )}
                            <View style={ds.videoPlayOverlay}>
                              <View style={ds.videoPlayBtn}><Ionicons name="play" size={14} color="white" /></View>
                            </View>
                            <TouchableOpacity style={ds.videoDeleteBtn} onPress={() => handleRemoveVideoFromWish(i)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                              <Ionicons name="close-circle" size={18} color="white" />
                            </TouchableOpacity>
                          </View>
                          {vl.title && <Text style={ds.videoCardTitle} numberOfLines={2}>{vl.title}</Text>}
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                ) : (!addingVideo && <Text style={ds.videoEmpty}>Aucune vidéo pour l’instant</Text>)}
              </View>
            )}

            {isVideo && wish.link_url && (
              <TouchableOpacity style={dv.linkRow} onPress={() => { void openLink(wish.link_url!); }} activeOpacity={0.85}>
                <Ionicons name="logo-tiktok" size={18} color={Colors.textInk} />
                <Text style={dv.linkTitle}>Voir la vidéo</Text>
                {sourceHost && <Text style={dv.linkSource}>{sourceHost}</Text>}
                <Ionicons name="open-outline" size={16} color={Colors.textInk} />
              </TouchableOpacity>
            )}

            {!isOrga && (
              <View style={dv.section}>
                <Text style={dv.sectionLabel}>ADRESSE</Text>
                {!editingAddr && wish.address ? (
                  <TouchableOpacity onPress={() => isAuthor && setEditingAddr(true)} activeOpacity={0.75}>
                    <Text style={dv.infoValue}>{wish.address}</Text>
                  </TouchableOpacity>
                ) : !editingAddr ? (
                  isAuthor ? (
                    <TouchableOpacity style={ds.addBtn} onPress={() => setEditingAddr(true)} activeOpacity={0.75}>
                      <Ionicons name="add-circle-outline" size={15} color={Colors.primary} />
                      <Text style={ds.addBtnText}>Ajouter une adresse</Text>
                    </TouchableOpacity>
                  ) : <Text style={dv.infoEmpty}>—</Text>
                ) : null}
                {editingAddr && (
                  <View>
                    <View style={ds.inputRow}>
                      <TextInput
                        style={[ds.input, { flex: 1 }]}
                        placeholder="Rechercher un lieu..."
                        placeholderTextColor={Colors.textTertiary}
                        value={addrInput}
                        onChangeText={handleAddrInput}
                        autoFocus
                        autoCorrect={false}
                      />
                      <TouchableOpacity onPress={() => setEditingAddr(false)} style={{ padding: 8 }}>
                        <Ionicons name="close" size={18} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    {addrSugs.length > 0 && (
                      <View style={ds.suggestBox}>
                        {addrSugs.slice(0, 4).map((s, i) => (
                          <TouchableOpacity
                            key={s.place_id}
                            style={[ds.suggestItem, i < addrSugs.length - 1 && ds.suggestBorder]}
                            onPress={() => selectAddr(s)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
                            <Text style={ds.suggestText} numberOfLines={1}>{s.description}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {wish.type === 'inspiration' && (
              <View style={dv.section}>
                {!showAssociate ? (
                  <TouchableOpacity style={dv.linkRow} onPress={() => setShowAssociate(true)} activeOpacity={0.85}>
                    <Ionicons name="location-outline" size={20} color={Colors.textInk} />
                    <View style={{ flex: 1 }}>
                      <Text style={dv.linkTitle}>Associer un lieu Google</Text>
                      <Text style={dv.infoEmpty}>L’inspiration apparaîtra sur la carte</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textInk} />
                  </TouchableOpacity>
                ) : (
                  <>
                    <Text style={dv.sectionLabel}>ASSOCIER UN LIEU</Text>
                    <View style={ds.inputRow}>
                      <TextInput
                        style={[ds.input, { flex: 1 }]}
                        placeholder="Rechercher un lieu..."
                        placeholderTextColor={Colors.textTertiary}
                        value={associateQuery}
                        onChangeText={handleAssociateSearch}
                        autoFocus
                        autoCorrect={false}
                      />
                      <TouchableOpacity onPress={() => setShowAssociate(false)} style={{ padding: 8 }}>
                        <Ionicons name="close" size={18} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    {associateSugs.length > 0 && (
                      <View style={ds.suggestBox}>
                        {associateSugs.slice(0, 4).map((s, i) => (
                          <TouchableOpacity
                            key={s.place_id}
                            style={[ds.suggestItem, i < associateSugs.length - 1 && ds.suggestBorder]}
                            onPress={() => selectAssociatePlace(s)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
                            <Text style={ds.suggestText} numberOfLines={1}>{s.description}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>
            )}

            <View style={dv.section}>
              <Text style={dv.sectionLabel}>DESCRIPTION</Text>
              {!editingDesc && wish.description ? (
                <TouchableOpacity onPress={() => isAuthor && setEditingDesc(true)} activeOpacity={0.75}>
                  <Text style={dv.infoValue}>{wish.description}</Text>
                </TouchableOpacity>
              ) : !editingDesc ? (
                isAuthor ? (
                  <TouchableOpacity style={ds.addBtn} onPress={() => setEditingDesc(true)} activeOpacity={0.75}>
                    <Ionicons name="add-circle-outline" size={15} color={Colors.primary} />
                    <Text style={ds.addBtnText}>Ajouter une description</Text>
                  </TouchableOpacity>
                ) : <Text style={dv.infoEmpty}>—</Text>
              ) : null}
              {editingDesc && (
                <View>
                  <TextInput
                    style={[ds.input, { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                    placeholder="Décris cette envie..."
                    placeholderTextColor={Colors.textTertiary}
                    value={descInput} onChangeText={setDescInput}
                    multiline autoFocus
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity style={[ds.miniBtn, { flex: 1 }]} onPress={() => setEditingDesc(false)} activeOpacity={0.75}>
                      <Text style={ds.miniBtnText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[ds.miniBtn, ds.miniBtnPrimary, { flex: 1 }]} onPress={saveDesc} activeOpacity={0.85}>
                      <Text style={[ds.miniBtnText, { color: Colors.white }]}>Enregistrer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {!isOrga && (
              <PriceDurationFields
                price={wish.price_per_person ?? null}
                duration={wish.duration_minutes ?? null}
                onPriceChange={value => onUpdate(wish.id, { price_per_person: value })}
                onDurationChange={value => onUpdate(wish.id, { duration_minutes: value })}
              />
            )}

            <View style={dv.section}>
              <Text style={dv.sectionLabel}>COMMENTAIRES</Text>
              {comments.length === 0 && <Text style={dv.infoEmpty}>Aucun commentaire. Lance la discussion !</Text>}
              {comments.map(c => {
                const name = c.user_id === currentUserId ? 'Toi' : c.author?.nickname ?? 'Membre';
                const date = new Date(c.created_at);
                const sameDay = date.toDateString() === new Date().toDateString();
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={ds.commentRow}
                    activeOpacity={c.user_id === currentUserId ? 0.7 : 1}
                    onLongPress={c.user_id === currentUserId ? () => confirmDeleteComment(c.id) : undefined}
                  >
                    <View style={[ds.commentAvatar, dv.commentAvatarBg]}>
                      {c.author?.avatar_url
                        ? <Image source={{ uri: c.author.avatar_url }} style={ds.commentAvatarImg} />
                        : <Text style={dv.avatarInitial}>{name[0]?.toUpperCase() ?? '?'}</Text>}
                    </View>
                    <View style={ds.commentBody}>
                      <View style={ds.commentMeta}>
                        <Text style={ds.commentName}>{name}</Text>
                        <Text style={ds.commentDate}>
                          {sameDay
                            ? date.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })
                            : date.toLocaleDateString('fr', { day: 'numeric', month: 'short' })}
                        </Text>
                      </View>
                      <Text style={ds.commentText}>{c.content}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              <View style={ds.commentInputRow}>
                <TextInput
                  style={[ds.input, { flex: 1 }]}
                  placeholder="Ajouter un commentaire..."
                  placeholderTextColor={Colors.textTertiary}
                  value={commentText} onChangeText={setCommentText}
                  returnKeyType="send" onSubmitEditing={sendComment}
                />
                <TouchableOpacity
                  style={[ds.sendBtn, !commentText.trim() && { opacity: 0.4 }]}
                  onPress={sendComment} disabled={!commentText.trim() || isSending}
                  activeOpacity={0.8}
                >
                  <Ionicons name="send" size={16} color={Colors.white} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={dv.dangerRow}>
              {wish.status !== 'archived' && (
                <TouchableOpacity onPress={confirmArchive} activeOpacity={0.7} style={dv.dangerBtn}>
                  <Ionicons name="archive-outline" size={16} color={Colors.textMuted} />
                  <Text style={dv.dangerText}>Archiver</Text>
                </TouchableOpacity>
              )}
              {isAuthor && (
                <TouchableOpacity onPress={confirmDelete} activeOpacity={0.7} style={dv.dangerBtn}>
                  <Ionicons name="trash-outline" size={16} color={Colors.negative} />
                  <Text style={[dv.dangerText, { color: Colors.negative }]}>Supprimer</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>

        {/* ── Actions (⟵ · Bof · Partant ! / Ajouter au planning / Fait) ── */}
        <View style={[dv.actions, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
          <TouchableOpacity style={dv.roundBtn} onPress={onClose} activeOpacity={0.85} accessibilityLabel="Retour">
            <Ionicons name="caret-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          {canBook && !isBooked && bookingOpen ? (
            <View style={dv.amountRow}>
              <TextInput
                style={dv.amountInput}
                placeholder="Total payé (€)"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                value={amountInput}
                onChangeText={setAmountInput}
                autoFocus
              />
              <TouchableOpacity style={dv.amountSkip} onPress={() => { void confirmBooking(false); }} disabled={booking}>
                <Text style={dv.amountSkipText}>Passer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dv.amountOk} onPress={() => { void confirmBooking(true); }} disabled={booking}>
                {booking
                  ? <ActivityIndicator color={Colors.textInverted} />
                  : <Ionicons name="checkmark" size={22} color={Colors.textInverted} />}
              </TouchableOpacity>
            </View>
          ) : canBook && !isBooked ? (
            <TouchableOpacity
              style={[dv.cta, dv.ctaAccent]}
              onPress={() => {
                // Montant proposé : prix par personne × voyageurs (modifiable)
                if (wish.price_per_person && tripMembers.length > 0) {
                  setAmountInput(String(Math.round(wish.price_per_person * tripMembers.length * 100) / 100).replace('.', ','));
                }
                setBookingOpen(true);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark" size={22} color={Colors.textInverted} />
              <Text style={dv.ctaText}>J’ai réservé</Text>
            </TouchableOpacity>
          ) : isValidated ? (
            <TouchableOpacity
              style={[dv.cta, isBooked ? dv.ctaDark : dv.ctaAccent]}
              onPress={() => onAddToPlanning({ id: wish.id, title: wish.title })}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar-outline" size={22} color={Colors.textInverted} />
              <Text style={dv.ctaText}>{isBooked ? 'Replanifier' : 'Ajouter au planning'}</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[dv.roundBtn, myVote === 'down' && dv.roundBtnOn]}
                onPress={() => onVote(wish.id, 'down')}
                activeOpacity={0.85}
                accessibilityLabel="Bof"
                accessibilityState={{ selected: myVote === 'down' }}
              >
                <Ionicons name="thumbs-down-outline" size={22} color={myVote === 'down' ? Colors.textInverted : Colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[dv.cta, dv.ctaAccent, myVote === 'up' && dv.ctaOutlined]}
                onPress={() => onVote(wish.id, 'up')}
                activeOpacity={0.85}
                accessibilityState={{ selected: myVote === 'up' }}
              >
                <Ionicons name={myVote === 'up' ? 'thumbs-up' : 'thumbs-up-outline'} size={22} color={Colors.textInverted} />
                <Text style={dv.ctaText}>{myVote === 'up' ? 'Tu es partant' : 'Partant !'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─── Écran principal ────────────────────────────────────────── */
export default function EnviesScreen() {
  // wish : ouvre directement la fiche d'une envie (ex. depuis le dashboard « en cours »)
  const { id: tripId, wish: wishParam } = useLocalSearchParams<{ id: string; wish?: string }>();
  const insets         = useSafeAreaInsets();
  const { session }    = useAuth();
  const currentUserId  = session?.user?.id ?? '';
  const { width }      = useWindowDimensions();

  const [wishes,         setWishes]         = useState<Wish[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>('all');
  const userChangedFilter = useRef(false);
  const { filters, reset: resetFilters } = useWishFilters(tripId ?? '');
  const filterCount = activeFilterCount(filters);
  const [detailId,       setDetailId]       = useState<string | null>(wishParam ?? null);
  /* Planifier une envie → page « Au planning » (choix du jour et de l'heure) */
  const planWish = useCallback((wishId: string) => {
    router.push({ pathname: '/trip/[id]/plan-add', params: { id: tripId ?? '', wishId } });
  }, [tripId]);
  /* Villes du voyage : filtre par étape (multi-étapes) */
  const { stops, isMultiStop } = useTripStops(tripId);
  const [stopFilter,     setStopFilter]     = useState<string | null>(null);
  /* Membres du groupe : avatars des cartes de vote + base de la règle majoritaire */
  const [members,        setMembers]        = useState<VoteCardMember[]>([]);
  const memberCount = Math.max(1, members.length);
  /* Envies déjà planifiées (statut « Mar 02 · 10:00 » des validées) */
  const [plannedSlots,   setPlannedSlots]   = useState<Record<string, PlannedSlot>>({});

  const detailWish = useMemo(
    () => detailId ? (wishes.find(w => w.id === detailId) ?? null) : null,
    [wishes, detailId]
  );

  /* ── Fetch Supabase ── */
  const fetchWishes = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('wishes').select('*, wish_votes(*)')
        .eq('trip_id', tripId)
        .or('type.is.null,type.neq.orga') // les tâches d'orga vivent dans les Préparatifs
        .order('created_at', { ascending: false });
      if (!error && data) setWishes(data as Wish[]);
      const { data: memberRows } = await supabase
        .from('trip_members').select('user_id, profile:profiles(nickname, avatar_url)')
        .eq('trip_id', tripId);
      setMembers(((memberRows ?? []) as unknown as { user_id: string; profile: { nickname: string | null; avatar_url: string | null } | null }[])
        .map(m => ({ user_id: m.user_id, nickname: m.profile?.nickname ?? null, avatar_url: m.profile?.avatar_url ?? null })));
      const { data: planned } = await supabase
        .from('planning_items').select('wish_id, day_date, start_time')
        .eq('trip_id', tripId).not('wish_id', 'is', null);
      const slots: Record<string, PlannedSlot> = {};
      for (const p of (planned ?? []) as { wish_id: string; day_date: string; start_time: string | null }[]) {
        slots[p.wish_id] = { day_date: p.day_date, start_time: p.start_time };
      }
      setPlannedSlots(slots);
    } catch {}
    setLoading(false);
  }, [tripId]);

  useEffect(() => { fetchWishes(); }, [fetchWishes]);
  useEffect(() => tripEvents.subscribe(() => { void fetchWishes(); }), [fetchWishes]);

  /* ── Filtre par défaut ── */
  useEffect(() => {
    if (wishes.length > 0 && !userChangedFilter.current) {
      const hasPending = wishes.some(w => w.status === 'pending' || w.status === 'debate');
      setStatusFilter(hasPending ? 'pending' : 'all');
    }
  }, [wishes]);

  /* ── Status chip counts ── */
  const pendingCount   = useMemo(() => wishes.filter(w => w.status === 'pending' || w.status === 'debate').length, [wishes]);
  const validatedCount = useMemo(() => wishes.filter(w => w.status === 'validated').length, [wishes]);
  const archivedCount  = useMemo(() => wishes.filter(w => w.status === 'archived').length,  [wishes]);
  const allActiveCount = useMemo(() => wishes.filter(w => w.status !== 'archived').length,  [wishes]);

  const statusChips = useMemo(() => {
    const chips: { key: StatusFilter; label: string }[] = [];
    if (pendingCount > 0)
      chips.push({ key: 'pending',   label: `À voter · ${pendingCount}` });
    chips.push({ key: 'validated',   label: `Validées · ${validatedCount}` });
    chips.push({ key: 'all',         label: `Toutes · ${allActiveCount}` });
    chips.push({ key: 'archived',    label: `Écartées · ${archivedCount}` });
    return chips;
  }, [pendingCount, validatedCount, archivedCount, allActiveCount]);

  /* ── Filtered + sorted ── */
  const filtered = useMemo(() => {
    let result = statusFilter === 'all'
      ? wishes.filter(w => w.status !== 'archived')
      : statusFilter === 'pending'
        ? wishes.filter(w => w.status === 'pending' || w.status === 'debate')
        : wishes.filter(w => w.status === statusFilter);
    if (stopFilter !== null)
      result = result.filter(w => w.stop_id === stopFilter);
    // Type, catégorie, ambiance et tri : page « Filtres » (envies-filters.tsx)
    const facet = (w: Wish) => ({ ...w, upVotes: w.wish_votes.filter(v => v.vote === 'up').length });
    return result
      .map(facet)
      .filter(w => matchesWishFilters(w, filters))
      .sort((a, b) => compareWishes(a, b, filters.sort));
  }, [wishes, statusFilter, stopFilter, filters]);


  /* ── Unvoted count (excluding orga) ── */
  const unvotedCount = useMemo(() =>
    wishes.filter(w =>
      w.status !== 'archived' &&
      w.type !== 'orga' &&
      !w.wish_votes.some(v => v.user_id === currentUserId)
    ).length,
    [wishes, currentUserId]
  );

  /* ── Vote ── */
  const handleVote = useCallback((wishId: string, vote: VoteType) => {
    setWishes(prev => prev.map(w => {
      if (w.id !== wishId) return w;
      const existing     = w.wish_votes.find(v => v.user_id === currentUserId);
      const shouldRemove = existing?.vote === vote;

      if (shouldRemove && existing) {
        supabase.from('wish_votes').delete().eq('id', existing.id).then(() => {});
      } else if (existing) {
        supabase.from('wish_votes').update({ vote }).eq('id', existing.id).then(() => {});
      } else {
        supabase.from('wish_votes').insert({ wish_id: wishId, user_id: currentUserId, vote }).then(() => {});
      }

      const newVotes = shouldRemove
        ? w.wish_votes.filter(v => v.user_id !== currentUserId)
        : [...w.wish_votes.filter(v => v.user_id !== currentUserId),
           { id: existing?.id ?? `${wishId}-${currentUserId}`, wish_id: wishId, user_id: currentUserId, vote }];

      const newStatus = computeStatus(newVotes, memberCount);
      if (newStatus !== w.status)
        supabase.from('wishes').update({ status: newStatus }).eq('id', wishId).then(() => {});

      return { ...w, wish_votes: newVotes, status: newStatus };
    }));
  }, [currentUserId, memberCount]);

  /* ── Update wish fields ── */
  const handleUpdate = useCallback((wishId: string, patch: Partial<Wish>) => {
    setWishes(prev => prev.map(w => w.id === wishId ? { ...w, ...patch } : w));
    const { wish_votes: _wv, ...dbPatch } = patch as Wish;
    supabase.from('wishes').update(dbPatch).eq('id', wishId).then(({ error }) => {
      if (error) console.warn('[handleUpdate] ERROR:', JSON.stringify(error));
    });
  }, []);

  /* ── Archive / Delete ── */
  const handleArchive = useCallback((wishId: string) => {
    handleUpdate(wishId, { status: 'archived' });
  }, [handleUpdate]);

  const handleDelete = useCallback((wishId: string) => {
    setWishes(prev => prev.filter(w => w.id !== wishId));
    supabase.from('wishes').delete().eq('id', wishId).then(() => {});
  }, []);

  /* ── Validées : groupes par ville + statut de chaque ligne ── */
  const validatedGroups = useMemo(() => {
    const byStop = new Map<string, Wish[]>();
    for (const w of filtered) {
      const key = w.stop_id ?? 'none';
      byStop.set(key, [...(byStop.get(key) ?? []), w]);
    }
    const shortDay = (iso: string) => { const [, mo, d] = iso.split('-'); return `${d}/${mo}`; };
    const groups = stops
      .filter(st => byStop.has(st.id))
      .map(st => ({
        key: st.id,
        title: `${st.place_name.toUpperCase()} · ${shortDay(st.start_date)} → ${shortDay(st.end_date)}`,
        items: byStop.get(st.id) ?? [],
      }));
    const rest = byStop.get('none') ?? [];
    if (rest.length > 0) groups.push({ key: 'none', title: stops.length > 1 ? 'AUTRES' : 'TOUT LE VOYAGE', items: rest });
    return groups;
  }, [filtered, stops]);

  const rowStatus = useCallback((w: Wish): { kind: ValidatedStatusKind; label: string } => {
    if (w.status === 'archived') return { kind: 'rejected', label: 'Écartée' };
    if (w.booked_at) return { kind: 'booked', label: 'Réservé' };
    const slot = plannedSlots[w.id];
    if (slot) return { kind: 'planned', label: plannedLabel(slot) };
    if (w.category === 'hotel' && w.link_url) return { kind: 'book', label: 'Réserver' };
    return { kind: 'plan', label: 'Planifier' };
  }, [plannedSlots]);

  const handleRowStatus = useCallback((w: Wish, kind: ValidatedStatusKind) => {
    if (kind === 'book' && w.link_url) { void Linking.openURL(w.link_url); return; }
    if (kind === 'plan') { planWish(w.id); return; }
    setDetailId(w.id);
  }, [planWish]);


  /* ── À voter / Toutes : inspirations (vidéos, liens) et lieux ── */
  const inspirations = useMemo(() => filtered.filter(w => w.type !== 'place'), [filtered]);
  const places = useMemo(() => filtered.filter(w => w.type === 'place'), [filtered]);
  const inspirationWidth = Math.round(width * INSPIRATION_WIDTH_RATIO);

  const renderVoteCard = (w: Wish, style?: { width: number }) => (
    <VoteCard
      key={w.id}
      style={style}
      title={w.title}
      imageUri={w.image_url ?? w.cover_url ?? null}
      tag={wishTag(w, stops.find(st => st.id === w.stop_id)?.place_name ?? null)}
      isVideo={isVideoLink(w.link_url)}
      priceLabel={priceLabel(w.price_per_person, w.budget)}
      votes={w.wish_votes}
      members={members}
      currentUserId={currentUserId}
      onVote={vote => handleVote(w.id, vote)}
      onPress={() => setDetailId(w.id)}
    />
  );

  return (
    <View style={[sc.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={sc.header}>
        <Text style={sc.title} numberOfLines={1} adjustsFontSizeToFit>Vos envies</Text>
        {tripId ? (
          <View style={sc.headerActions}>
            <PrepPill tripId={tripId} compact />
            <HelpShortcut tripId={tripId} tab="activities" />
          </View>
        ) : null}
      </View>

      {/* ── Status chips ── */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={sc.filterRow} contentContainerStyle={sc.filterContent}
      >
        {statusChips.map(c => (
          <FilterButton
            key={c.key}
            label={c.label}
            active={statusFilter === c.key}
            onPress={() => { userChangedFilter.current = true; setStatusFilter(c.key); }}
          />
        ))}
      </ScrollView>

      {/* ── Filtre par ville (multi-étapes) ── */}
      {isMultiStop && (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={sc.filterRow} contentContainerStyle={sc.filterContent}
        >
          <FilterButton label="Toutes les villes" active={stopFilter === null} onPress={() => setStopFilter(null)} />
          {stops.map(stop => (
            <FilterButton
              key={stop.id}
              label={stop.place_name}
              active={stopFilter === stop.id}
              onPress={() => setStopFilter(stop.id)}
              count={wishes.filter(w => w.stop_id === stop.id && w.status !== 'archived').length || undefined}
            />
          ))}
        </ScrollView>
      )}

      {/* ── Vote banner ── */}
      {unvotedCount > 0 && statusFilter !== 'validated' && (
        <TouchableOpacity
          style={sc.contextRow}
          onPress={() => { userChangedFilter.current = true; setStatusFilter('pending'); resetFilters(); }}
          activeOpacity={0.8}
        >
          <Text style={sc.contextText}>
            C’est à toi de voter sur {unvotedCount} envie{unvotedCount > 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Masonry grid ── */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={sc.empty}>
          <Text style={sc.emptyIcon}>✨</Text>
          <Text style={sc.emptyText}>{filterCount > 0 ? 'Aucune envie avec ces filtres' : 'Aucune envie dans cette catégorie'}</Text>
          {filterCount > 0 && (
            <TouchableOpacity onPress={resetFilters} hitSlop={10}>
              <Text style={sc.emptyLink}>Effacer les filtres</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[sc.listContent, { paddingBottom: Math.max(insets.bottom, 16) + 110 }]}
        >
          {statusFilter === 'validated' || statusFilter === 'archived' ? (
            /* Validées (ou écartées), groupées par ville */
            validatedGroups.map(group => (
              <View key={group.key} style={sc.group}>
                <View style={sc.groupHeader}>
                  <Text style={sc.groupTitle}>{group.title}</Text>
                  <Text style={sc.groupCount}>{group.items.length}</Text>
                </View>
                {group.items.map(w => {
                  const status = rowStatus(w);
                  return (
                    <ValidatedRow
                      key={w.id}
                      title={w.title}
                      subtitle={wishTag(w, null)}
                      imageUri={w.image_url ?? w.cover_url ?? null}
                      status={status}
                      onPress={() => setDetailId(w.id)}
                      onStatusPress={() => handleRowStatus(w, status.kind)}
                    />
                  );
                })}
              </View>
            ))
          ) : (
            /* À voter / Toutes : deux sections — les inspirations (vidéos) en
               slider horizontal, puis les lieux en cartes de vote */
            <>
              {inspirations.length > 0 && (
                <View style={sc.group}>
                  <View style={sc.groupHeader}>
                    <Text style={sc.groupTitle}>INSPIRATIONS</Text>
                    <Text style={sc.groupCount}>{inspirations.length}</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={sc.slider}
                    contentContainerStyle={sc.sliderContent}
                    snapToInterval={inspirationWidth + Spacing.sm2}
                    decelerationRate="fast"
                  >
                    {inspirations.map(w => renderVoteCard(w, { width: inspirationWidth }))}
                  </ScrollView>
                </View>
              )}
              {places.length > 0 && (
                <View style={sc.group}>
                  <View style={sc.groupHeader}>
                    <Text style={sc.groupTitle}>LIEUX</Text>
                    <Text style={sc.groupCount}>{places.length}</Text>
                  </View>
                  {places.map(w => renderVoteCard(w))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ── Bottom nav ── */}
      <View
        style={[sc.bottomNav, { bottom: Math.max(insets.bottom, 10) + 16 }]}
        pointerEvents="box-none"
      >
        <NavButton icon="arrow-back-outline" onPress={() => router.back()} />
        <NavButton icon="add" iconSize={28} variant="accent" onPress={() => router.push({ pathname: '/trip/[id]/wish/new', params: { id: tripId ?? '' } })} />
        <NavButton
          icon="options-outline"
          label={filterCount > 0 ? String(filterCount) : undefined}
          variant={filterCount > 0 ? 'dark' : 'light'}
          onPress={() => router.push({ pathname: '/trip/[id]/envies-filters', params: { id: tripId ?? '' } })}
        />
      </View>

      {/* ── Modals ── */}
      <DetailSheet
        wish={detailWish} currentUserId={currentUserId}
        isAuthor={detailWish?.added_by === currentUserId}
        onVote={handleVote} onUpdate={handleUpdate}
        onArchive={handleArchive} onDelete={handleDelete}
        onClose={() => setDetailId(null)}
        onAddToPlanning={(w) => { setDetailId(null); planWish(w.id); }}
        members={members}
        cityName={stops.find(st => st.id === detailWish?.stop_id)?.place_name ?? null}
        stopId={detailWish?.stop_id ?? null}
        checkInDay={
          stops.find(st => st.id === detailWish?.stop_id)?.start_date
          ?? stops[0]?.start_date
          ?? localDayIso(new Date())
        }
        onBooked={() => { void fetchWishes(); }}
      />


    </View>
  );
}

/* ─── Screen styles ──────────────────────────────────────────── */
const sc = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md2, paddingTop: Spacing.md, paddingBottom: Spacing.md,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title:   { flexShrink: 1, ...Typography.displayTitle, color: Colors.textPrimary },

  filterRow:     { maxHeight: 64, flexGrow: 0 },
  filterContent: { paddingHorizontal: Spacing.md2, paddingVertical: Spacing.sm2, gap: Spacing.sm, alignItems: 'center' },
  contextRow:    { paddingHorizontal: Spacing.md2, paddingVertical: Spacing.xs },
  contextText:   { ...Typography.bodySmall, color: Colors.accent },
  listContent:   { paddingHorizontal: Spacing.md2, paddingTop: Spacing.sm2, gap: Spacing.sm2 },
  group:         { gap: Spacing.sm2 - 2, marginBottom: Spacing.sm },
  // Slider des inspirations : déborde jusqu'aux bords de l'écran
  slider:        { marginHorizontal: -Spacing.md2 },
  sliderContent: { paddingHorizontal: Spacing.md2, gap: Spacing.sm2 },
  groupHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupTitle:    { ...Typography.displayLabel, color: Colors.textPrimary },
  groupCount:    { ...Typography.bodySmall, color: Colors.textMuted },
  chip:          { paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radii.full, backgroundColor: '#F0F0F0' },
  chipActive:    { backgroundColor: Colors.primary },
  chipText:      { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  chipTextActive: { color: Colors.white },



  empty:     { flex: 1, alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
  emptyLink: { ...Typography.chip, color: Colors.accent, marginTop: Spacing.sm },

  bottomNav: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 14 },
});

/* ─── Detail sheet styles ────────────────────────────────────── */
const ds = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 12, marginBottom: 8 },

  /* Close button */
  closeFab: { position: 'absolute', top: 12, right: 16, zIndex: 20, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },

  imgWrap: { marginHorizontal: 16, marginTop: 4, marginBottom: 4, height: 240, borderRadius: 20, overflow: 'hidden' },
  img:     { width: '100%', height: '100%' },

  /* Video section */
  videoSection:        { paddingTop: 14, paddingBottom: 6 },
  videoSectionHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  videoSectionTitle:   { fontSize: 13, fontWeight: '700', color: '#555' },
  videoAddPill:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F5F5', borderRadius: Radii.full, paddingHorizontal: 10, paddingVertical: 5 },
  videoAddPillText:    { fontSize: 12, fontWeight: '700', color: '#1A1A1A' },
  videoInputWrap:      { marginHorizontal: 16, marginBottom: 12, gap: 8 },
  videoInput:          { backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1A1A1A' },
  videoInputActions:   { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  videoCancelBtn:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radii.full, backgroundColor: '#F5F5F5' },
  videoCancelText:     { fontSize: 13, color: '#888', fontWeight: '600' },
  videoConfirmBtn:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radii.full, backgroundColor: '#1A1A1A' },
  videoConfirmText:    { fontSize: 13, color: 'white', fontWeight: '700' },
  videoScroll:         { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  videoCard:           { width: 130, gap: 6 },
  videoThumbWrap:      { width: 130, height: 92, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1C1C1E' },
  videoPlayOverlay:    { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  videoPlayBtn:        { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.28)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  videoDeleteBtn:      { position: 'absolute', top: 5, right: 5 },
  videoCardTitle:      { fontSize: 11, color: '#888', lineHeight: 14 },
  videoEmpty:          { paddingHorizontal: 16, fontSize: 12, color: '#aaa', fontStyle: 'italic', marginBottom: 4 },
  openTikTok:    { position: 'absolute', bottom: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: Radii.full, paddingHorizontal: 14, paddingVertical: 8 },
  openTikTokText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  body:      { paddingHorizontal: 20, paddingTop: 8, paddingBottom: Spacing.md, gap: 6 },
  titleRow:  { flexDirection: 'row', alignItems: 'flex-start' },
  title:     { fontSize: 28, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5, lineHeight: 34 },
  badgeRow:  { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10, marginBottom: 6, flexWrap: 'wrap' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radii.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot:   { width: 7, height: 7, borderRadius: 4 },
  statusText:  { fontSize: 12, fontWeight: '700' },
  catBadge:    { backgroundColor: '#F5F5F5', borderRadius: Radii.full, paddingHorizontal: 10, paddingVertical: 4 },
  catBadgeText: { fontSize: 12, fontWeight: '600', color: '#555' },


  /* Associate place button */
  associateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: '#93C5FD', backgroundColor: '#EFF6FF',
  },
  associateBtnIcon:  { fontSize: 20 },
  associateBtnTitle: { fontSize: 14, fontWeight: '700', color: '#1D4ED8' },
  associateBtnSub:   { fontSize: 12, color: '#60A5FA', marginTop: 1 },

  section:      { marginTop: 20, gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 1 },
  infoValue:    { fontSize: 14, color: '#1A1A1A', lineHeight: 20 },
  infoEmpty:    { fontSize: 13, color: '#aaa', fontStyle: 'italic' },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addBtnText:   { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  inputRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { backgroundColor: '#F5F5F5', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#1A1A1A' },
  miniBtn: { paddingVertical: 10, borderRadius: 12, backgroundColor: '#F5F5F5', alignItems: 'center' },
  miniBtnPrimary: { backgroundColor: '#1A1A1A' },
  miniBtnText: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  suggestBox:  { marginTop: 4, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden', ...Shadows.sm },
  suggestItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: 12, paddingVertical: 10 },
  suggestBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  suggestText: { flex: 1, fontSize: 13, color: '#1A1A1A' },
  pillRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radii.full, backgroundColor: '#F5F5F5' },
  pillActive: { backgroundColor: '#1A1A1A' },
  pillText:   { fontSize: 13, fontWeight: '600', color: '#555' },
  pillTextActive: { color: '#fff' },

  memberVoteList:  { gap: 14 },
  memberVoteRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberAvatar:    { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  memberAvatarImg: { width: '100%', height: '100%' },
  memberAvatarTxt: { fontSize: 15, fontWeight: '700', color: '#555' },
  memberName:      { flex: 1, fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  memberVoteBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberVoteEmoji: { fontSize: 16 },
  memberVoteLabel: { fontSize: 12, color: '#888', fontWeight: '500' },
  voteRuleRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 8 },
  voteRuleText:    { flex: 1, fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  remindBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.primary },
  remindTxt:       { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },

  commentRow:      { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 12 },
  commentAvatar:   { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F0F0' },
  commentAvatarImg: { width: '100%', height: '100%' },
  commentBody:     { flex: 1, backgroundColor: '#F9F9F9', borderRadius: 12, padding: 10 },
  commentMeta:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentName:     { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  commentDate:     { fontSize: 11, color: '#aaa' },
  commentText:     { fontSize: 13, color: '#1A1A1A', lineHeight: 18 },
  commentInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
  sendBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },

  actionsSection: { marginTop: 24, gap: 10, marginBottom: Spacing.md },
  actionBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 14, backgroundColor: '#F5F5F5' },
  actionBtnDanger: { backgroundColor: 'rgba(220,38,38,0.08)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.25)' },
  actionBtnText:  { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },

  footer:       { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  voteBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: '#F5F5F5' },
  voteBtnLove:  { backgroundColor: '#FFF0F3', borderWidth: 1.5, borderColor: '#FF4B6E' },
  voteBtnPass:  { backgroundColor: '#FFF7ED', borderWidth: 1.5, borderColor: '#F97316' },
  voteBtnEmoji: { fontSize: 18 },
  voteBtnLabel: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
});


/* ─── Fiche détail V2 (maquettes « Envie · Détail vote » / « Validée à réserver ») ── */
const DETAIL_HERO_HEIGHT = 300;
const DETAIL_ROUND_BTN = 64;
const DETAIL_AVATAR = 42;
const DETAIL_VOTE_AVATAR = 32;

const dv = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceAlt },
  hero: { height: DETAIL_HERO_HEIGHT, overflow: 'hidden' },
  heroEmpty: { backgroundColor: Colors.primary },
  heroDim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.34)' },
  heroContent: { flex: 1, paddingHorizontal: Spacing.md2, paddingBottom: Spacing.xl + Spacing.sm, justifyContent: 'space-between' },
  closeBtn: {
    alignSelf: 'flex-end', width: 48, height: 48, borderRadius: Radii.full,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', ...Shadows.lg,
  },
  heroWord: { fontFamily: Fonts.displayBold, fontSize: 88, lineHeight: 100, color: 'rgba(255,255,255,0.85)' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1,
    height: 48, paddingHorizontal: Spacing.lg, borderRadius: Radii.pill,
    backgroundColor: Colors.background, ...Shadows.md,
  },
  badgeText: { ...Typography.filter, color: Colors.textPrimary },
  avatars: { flexDirection: 'row' },
  avatar: {
    width: DETAIL_AVATAR, height: DETAIL_AVATAR, borderRadius: Radii.full, overflow: 'hidden',
    borderWidth: 2, borderColor: Colors.white, backgroundColor: Colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarOverlap: { marginLeft: -16 },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  sheet: {
    marginTop: -Spacing.xl, paddingTop: Spacing.xl, paddingHorizontal: Spacing.md2, gap: Spacing.md,
    borderTopLeftRadius: Radii.sheet, borderTopRightRadius: Radii.sheet, backgroundColor: Colors.surfaceAlt,
  },
  titleBlock: { gap: Spacing.xs },
  title: { fontFamily: Fonts.display, fontSize: 28, color: Colors.textPrimary },
  subtitle: { ...Typography.body, color: Colors.textMuted },
  validated: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2,
    padding: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.primary, ...Shadows.md,
  },
  validatedCheck: { width: 28, height: 28, borderRadius: Radii.full, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  validatedTitle: { fontSize: 15, fontWeight: '600', color: Colors.white },
  validatedSub: { ...Typography.bodySmall, color: Colors.textTertiary },
  booked: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2,
    padding: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.accent, ...Shadows.md,
  },
  bookedText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.white },
  bookedCancel: { ...Typography.bodySmall, fontWeight: '700', color: Colors.white, textDecorationLine: 'underline' },
  afterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  afterText: { ...Typography.body, color: Colors.textMuted },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md2 },
  amountInput: {
    flex: 1, height: 56, paddingHorizontal: Spacing.md2, borderRadius: Radii.full,
    backgroundColor: Colors.surface, fontSize: 16, fontWeight: '600', color: Colors.textInk, ...Shadows.card,
  },
  amountSkip: { paddingHorizontal: Spacing.sm },
  amountSkipText: { ...Typography.body, fontWeight: '600', color: Colors.textMuted },
  amountOk: {
    width: 56, height: 56, borderRadius: Radii.full, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center', ...Shadows.lg,
  },
  rejected: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm2, borderRadius: Radii.lg, borderWidth: 1, borderColor: Colors.line },
  rejectedText: { ...Typography.bodySmall, color: Colors.textMuted },
  boxes: { flexDirection: 'row', gap: Spacing.sm2 - 2 },
  box: { flex: 1, gap: 2, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md2, borderRadius: Radii.pill },
  boxLight: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.primary },
  boxDark: { backgroundColor: Colors.primary },
  boxLabel: { ...Typography.displayLabel, color: Colors.textPrimary },
  boxValue: { fontFamily: Fonts.display, fontSize: 28, color: Colors.textPrimary, marginTop: Spacing.sm },
  boxSub: { ...Typography.bodySmall, color: Colors.textMuted },
  boxSubAccent: { ...Typography.bodySmall, color: Colors.accent },
  onDark: { color: Colors.white },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2,
    minHeight: 56, paddingHorizontal: Spacing.md2, paddingVertical: Spacing.sm2,
    borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card,
  },
  linkTitle: { flex: 1, ...Typography.cardTitle, color: Colors.textInk },
  linkSource: { ...Typography.bodySmall, color: Colors.textMuted },
  section: { gap: Spacing.sm2 - 2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { ...Typography.displayLabel, color: Colors.textPrimary },
  sectionRight: { fontSize: 12, fontWeight: '600', color: Colors.accent },
  card: { paddingHorizontal: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, paddingVertical: Spacing.sm2 - 2 },
  voteRowDivider: { borderTopWidth: 1, borderTopColor: Colors.line },
  voteAvatar: {
    width: DETAIL_VOTE_AVATAR, height: DETAIL_VOTE_AVATAR, borderRadius: Radii.full, overflow: 'hidden',
    backgroundColor: Colors.line, alignItems: 'center', justifyContent: 'center',
  },
  voteAvatarPending: { backgroundColor: Colors.background, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.textMuted },
  voteName: { fontSize: 14, fontWeight: '600', color: Colors.textInk },
  voteStatus: { ...Typography.bodySmall, color: Colors.textMuted },
  voteStatusAccent: { color: Colors.accent },
  voteIcon: { width: 26, height: 26, borderRadius: Radii.full, alignItems: 'center', justifyContent: 'center' },
  remindPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.sm2, paddingVertical: 6, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.primary,
  },
  remindText: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  rule: { ...Typography.bodySmall, color: Colors.textMuted },
  infoValue: { ...Typography.body, color: Colors.textInk },
  infoEmpty: { ...Typography.bodySmall, color: Colors.textMuted },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pill: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.background,
  },
  pillActive: { backgroundColor: Colors.primary },
  pillText: { ...Typography.filter, color: Colors.textPrimary },
  pillTextActive: { color: Colors.white },
  videoEmptyThumb: { backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  commentAvatarBg: { backgroundColor: Colors.line },
  dangerRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg, paddingVertical: Spacing.md },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dangerText: { ...Typography.body, fontWeight: '600', color: Colors.textMuted },
  actions: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', justifyContent: 'center', gap: Spacing.md, paddingTop: Spacing.md,
  },
  roundBtn: {
    width: DETAIL_ROUND_BTN, height: DETAIL_ROUND_BTN, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center', ...Shadows.lg,
  },
  roundBtnOn: { backgroundColor: Colors.primary },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    minWidth: 190, height: DETAIL_ROUND_BTN, paddingHorizontal: Spacing.lg, borderRadius: Radii.full, ...Shadows.lg,
  },
  ctaAccent: { backgroundColor: Colors.accent },
  ctaDark: { backgroundColor: Colors.primary },
  ctaOutlined: { borderWidth: 2, borderColor: Colors.primary },
  ctaText: { ...Typography.button, color: Colors.offWhite },
});
