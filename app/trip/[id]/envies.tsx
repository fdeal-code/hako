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
  Animated,
  PanResponder,
  Dimensions,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { BlurView } from 'expo-blur';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { NavButton } from '@/components/ui/NavButton';

const { width: SW } = Dimensions.get('window');
const COL_GAP   = 10;
const H_PAD     = 14;
const COL_WIDTH = (SW - H_PAD * 2 - COL_GAP) / 2;

/* ─── Types ──────────────────────────────────────────────────── */
type WishType     = 'place' | 'inspiration' | 'orga';
type Category     = 'restaurant' | 'monument' | 'cafe' | 'hotel' | 'activity' | 'photo' | 'photo_spot' | 'bar' | 'autre';
type WishStatus   = 'pending' | 'validated' | 'debate' | 'archived';
type VoteType     = 'up' | 'down';
type StatusFilter = 'all' | 'pending' | 'validated' | 'archived';
type SortBy       = 'recent' | 'oldest' | 'most_voted';
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
  title:          string;
  description?:   string;
  category?:      Category;
  cover_url?:     string;
  image_url?:     string;
  link_url?:      string;
  address?:       string;
  budget?:        BudgetLevel;
  duration?:      DurationKey;
  status:         WishStatus;
  wish_votes:     WishVote[];
  created_at:     string;
  latitude?:      number;
  longitude?:     number;
  type?:          WishType;
  done?:          boolean;
  google_rating?: number;
  links?:         WishLink[];
}

interface WishLink {
  url:        string;
  thumbnail?: string;
  title?:     string;
}

interface WishComment {
  id:          string;
  wish_id:     string;
  user_id:     string;
  user_name:   string;
  user_photo?: string;
  content:     string;
  created_at:  string;
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
const CATEGORY_META: Record<Category, { emoji: string; label: string }> = {
  restaurant: { emoji: '🍽️', label: 'Restaurant' },
  monument:   { emoji: '🏛️', label: 'Monument'   },
  cafe:       { emoji: '☕',  label: 'Café'        },
  hotel:      { emoji: '🏨', label: 'Hôtel'       },
  activity:   { emoji: '🎭', label: 'Activités'   },
  photo:      { emoji: '📸', label: 'Photo spot'  },
  photo_spot: { emoji: '📸', label: 'Photo spot'  },
  bar:        { emoji: '🍺', label: 'Bar'         },
  autre:      { emoji: '📦', label: 'Autre'       },
};

const BUDGET_OPTIONS: { key: BudgetLevel; label: string }[] = [
  { key: 'free', label: 'Gratuit' },
  { key: '€',    label: '€'       },
  { key: '€€',   label: '€€'      },
  { key: '€€€',  label: '€€€'     },
];

const DURATION_OPTIONS: { key: DurationKey; label: string }[] = [
  { key: '30min',    label: '30 min'       },
  { key: '1h',       label: '1h'           },
  { key: '2h',       label: '2h'           },
  { key: 'half-day', label: 'Demi-journée' },
  { key: 'day',      label: 'Journée'      },
];

const ADD_CATEGORIES: { key: Category; emoji: string; label: string }[] = [
  { key: 'restaurant', emoji: '🍽️', label: 'Restaurant' },
  { key: 'monument',   emoji: '🏛️', label: 'Monument'   },
  { key: 'cafe',       emoji: '☕',  label: 'Café'        },
  { key: 'hotel',      emoji: '🏨', label: 'Hôtel'       },
  { key: 'activity',   emoji: '🎭', label: 'Activité'    },
  { key: 'photo_spot', emoji: '📸', label: 'Photo spot'  },
  { key: 'bar',        emoji: '🍺', label: 'Bar'         },
  { key: 'autre',      emoji: '📍', label: 'Autre'       },
];

const MOCK_AVATARS = [
  { id: 'u1', name: 'Alex',  color: '#E8C5A5', photo: 'https://i.pravatar.cc/64?img=5'  },
  { id: 'u2', name: 'Marie', color: '#A5B8E0', photo: 'https://i.pravatar.cc/64?img=12' },
  { id: 'u3', name: 'Tom',   color: '#A8D5B5', photo: 'https://i.pravatar.cc/64?img=23' },
  { id: 'u4', name: 'Sarah', color: '#D4A5C5', photo: 'https://i.pravatar.cc/64?img=8'  },
];

const INSPIRATION_GRADIENTS: readonly [string, string, ...string[]][] = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#a18cd1', '#fbc2eb'],
];

const TYPE_PICKER_OPTIONS: { type: WishType; emoji: string; title: string; subtitle: string }[] = [
  { type: 'place',       emoji: '📍', title: 'Lieu',       subtitle: 'Restaurant, activité, musée...' },
  { type: 'inspiration', emoji: '✨', title: 'Inspiration', subtitle: 'TikTok, Reel, idée...'         },
  { type: 'orga',        emoji: '📋', title: 'Orga',        subtitle: 'Tâche, rappel, note...'        },
];

/* ─── Helpers ────────────────────────────────────────────────── */
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

function computeStatus(votes: WishVote[]): WishStatus {
  const ups   = votes.filter(v => v.vote === 'up').length;
  const downs = votes.filter(v => v.vote === 'down').length;
  if (ups === 0 && downs === 0) return 'pending';
  if (downs === 0) return 'validated';
  return 'debate';
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

function detectCategory(types: string[]): Category | null {
  if (types.some(t => ['restaurant', 'food', 'meal_delivery', 'meal_takeaway', 'fast_food'].includes(t)))
    return 'restaurant';
  if (types.some(t => ['cafe', 'bakery', 'coffee_shop'].includes(t)))
    return 'cafe';
  if (types.some(t => ['bar', 'night_club', 'pub'].includes(t)))
    return 'bar';
  if (types.some(t => ['lodging', 'hotel'].includes(t)))
    return 'hotel';
  if (types.some(t => ['museum', 'church', 'place_of_worship', 'tourist_attraction', 'landmark', 'natural_feature'].includes(t)))
    return 'monument';
  if (types.some(t => ['amusement_park', 'bowling_alley', 'gym', 'spa', 'stadium', 'park'].includes(t)))
    return 'activity';
  return null;
}

/* ─── WishCard ───────────────────────────────────────────────── */
function WishCard({
  wish, currentUserId, onVote, onPress, onToggleDone,
}: {
  wish:          Wish;
  currentUserId: string;
  onVote:        (wishId: string, vote: VoteType) => void;
  onPress:       () => void;
  onToggleDone:  (wishId: string) => void;
}) {
  const wishType = wish.type ?? 'inspiration';
  const isOrga   = wishType === 'orga';
  const isPlace  = wishType === 'place';
  const imageUri = wish.image_url ?? wish.cover_url;
  const hasImage = !!imageUri;
  const hasVoted = wish.wish_votes.some(v => v.user_id === currentUserId);

  const pan       = useRef(new Animated.Value(0)).current;
  const scale     = useRef(new Animated.Value(1)).current;
  const swipeRef  = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [flash,   setFlash]   = useState<'up' | 'down' | null>(null);
  const [swipeOn, setSwipeOn] = useState(false);

  useEffect(() => {
    if (!hasVoted && !isOrga) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.5, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
    pulseAnim.setValue(1);
  }, [hasVoted, isOrga]);

  const resetSwipe = useCallback(() => {
    swipeRef.current = false;
    setSwipeOn(false);
    Animated.spring(pan,   { toValue: 0, useNativeDriver: false }).start();
    Animated.spring(scale, { toValue: 1, useNativeDriver: true  }).start();
  }, [pan, scale]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder:        () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      !isOrga && swipeRef.current && Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 8,
    onMoveShouldSetPanResponderCapture: (_, { dx, dy }) =>
      !isOrga && swipeRef.current && Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 8,
    onPanResponderMove:   (_, { dx }) => { if (swipeRef.current && !isOrga) pan.setValue(dx); },
    onPanResponderRelease: (_, { dx }) => {
      if (swipeRef.current && !isOrga) {
        if (dx > 60)       { setFlash('up');   onVote(wish.id, 'up');   setTimeout(() => setFlash(null), 500); }
        else if (dx < -60) { setFlash('down'); onVote(wish.id, 'down'); setTimeout(() => setFlash(null), 500); }
        resetSwipe();
      }
    },
    onPanResponderTerminate: () => resetSwipe(),
  })).current;

  const statusColor =
    wish.status === 'validated' ? '#22C55E' :
    wish.status === 'debate'    ? '#F97316' : '#9CA3AF';

  const n = parseInt(wish.id, 10) || 0;
  let cardH: number;
  if (isPlace)  cardH = hasImage ? 195 + (n % 2) * 30 : 130;
  else if (!isOrga) cardH = hasImage ? 205 + (n % 3) * 28 : 148 + (n % 2) * 22;
  else cardH = wish.description ? 155 : 130;

  const gradientColors = INSPIRATION_GRADIENTS[n % INSPIRATION_GRADIENTS.length];

  return (
    <Animated.View
      style={{ transform: [{ translateX: pan }, { scale }], marginBottom: COL_GAP }}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={[
          cs.card,
          { height: cardH },
          isPlace && { borderWidth: 2.5, borderColor: statusColor },
        ]}
        activeOpacity={0.92}
        onPress={() => { if (!swipeRef.current) onPress(); }}
        onLongPress={() => {
          if (isOrga) return;
          swipeRef.current = true; setSwipeOn(true);
          Animated.spring(scale, { toValue: 1.05, useNativeDriver: true }).start();
        }}
        delayLongPress={450}
      >

        {/* ── Lieu ── */}
        {isPlace && (
          <>
            {hasImage ? (
              <>
                <Image source={{ uri: imageUri! }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={cs.cardDim} />
              </>
            ) : (
              <View style={[StyleSheet.absoluteFill, cs.placeNoImageBg]}>
                <Text style={{ fontSize: 36 }}>
                  {wish.category ? (CATEGORY_META[wish.category]?.emoji ?? '📍') : '📍'}
                </Text>
              </View>
            )}
            <View style={[cs.badge, cs.badgePlace]}>
              <Text style={cs.badgeText}>📍 Lieu</Text>
            </View>
            <View style={cs.cardBottomPlace}>
              <Text style={hasImage ? cs.titleVideo : cs.titlePlaceNoImg} numberOfLines={2}>{wish.title}</Text>
              {!!wish.google_rating && (
                <Text style={cs.ratingText}>⭐ {wish.google_rating.toFixed(1)}</Text>
              )}
            </View>
          </>
        )}

        {/* ── Inspiration ── */}
        {wishType === 'inspiration' && (
          <>
            {hasImage ? (
              <>
                <Image source={{ uri: imageUri! }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={cs.cardDim} />
              </>
            ) : (
              <LinearGradient
                colors={gradientColors}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            )}
            <View style={[cs.badge, cs.badgeTikTok]}>
              <Text style={cs.badgeText}>
                {wish.link_url?.includes('tiktok.com') ? 'TikTok' :
                 wish.link_url?.includes('instagram.com') ? 'Reel' : '✨ Inspiration'}
              </Text>
            </View>
            {hasImage && (
              <View style={cs.playWrap}>
                <View style={cs.playBtn}><Ionicons name="play" size={18} color="white" /></View>
              </View>
            )}
            <View style={cs.dotWrap}>
              <Animated.View style={[cs.dot, { backgroundColor: statusColor, transform: [{ scale: hasVoted ? 1 : pulseAnim }] }]} />
            </View>
            <View style={cs.cardBottomVideo}>
              <Text style={cs.titleVideo} numberOfLines={2}>{wish.title}</Text>
              {wish.added_by_name && (
                <View style={cs.authorRow}>
                  <View style={[cs.avatarXS, { backgroundColor: '#9CA3AF' }]} />
                  <Text style={cs.authorName}>{wish.added_by_name}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* ── Orga ── */}
        {isOrga && (
          <>
            <View style={[cs.badge, cs.badgeOrg]}>
              <Text style={cs.badgeText}>📋 Orga</Text>
            </View>
            <TouchableOpacity
              style={cs.checkboxWrap}
              onPress={() => onToggleDone(wish.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={[cs.checkbox, wish.done && cs.checkboxDone]}>
                {wish.done && <Ionicons name="checkmark" size={14} color="white" />}
              </View>
            </TouchableOpacity>
            <View style={[cs.orgBody, wish.done && { opacity: 0.45 }]}>
              <Text
                style={[cs.titleOrg, wish.done && { textDecorationLine: 'line-through' }]}
                numberOfLines={4}
              >
                {wish.title}
              </Text>
              {!!wish.description && (
                <Text style={cs.descOrg} numberOfLines={2}>{wish.description}</Text>
              )}
            </View>
            <View style={cs.orgBottom}>
              {MOCK_AVATARS.slice(0, 3).map((a, i) => (
                <View key={a.id} style={[cs.avatarSM, { backgroundColor: a.color, marginLeft: i > 0 ? -9 : 0, zIndex: 10 - i }]}>
                  <Image source={{ uri: a.photo }} style={cs.avatarSMImg} />
                </View>
              ))}
            </View>
          </>
        )}

        {!isOrga && flash && (
          <View style={[StyleSheet.absoluteFill, cs.flashOverlay, { backgroundColor: flash === 'up' ? 'rgba(34,197,94,0.38)' : 'rgba(239,68,68,0.38)' }]}>
            <Text style={{ fontSize: 36 }}>{flash === 'up' ? '❤️' : '👎'}</Text>
          </View>
        )}
        {!isOrga && swipeOn && <View style={[StyleSheet.absoluteFill, cs.swipeBorder]} />}
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ─── DetailSheet ────────────────────────────────────────────── */
function DetailSheet({
  wish, currentUserId, isAuthor,
  onVote, onUpdate, onArchive, onDelete, onClose,
}: {
  wish:          Wish | null;
  currentUserId: string;
  isAuthor:      boolean;
  onVote:        (wishId: string, vote: VoteType) => void;
  onUpdate:      (wishId: string, patch: Partial<Wish>) => void;
  onArchive:     (wishId: string) => void;
  onDelete:      (wishId: string) => void;
  onClose:       () => void;
}) {
  const insets = useSafeAreaInsets();

  const [editingAddr,   setEditingAddr]   = useState(false);
  const [addrInput,     setAddrInput]     = useState('');
  const [addrSugs,      setAddrSugs]      = useState<PlaceSuggestion[]>([]);
  const [editingDesc,   setEditingDesc]   = useState(false);
  const [descInput,     setDescInput]     = useState('');
  const [localBudget,   setLocalBudget]   = useState<BudgetLevel | null>(null);
  const [localDuration, setLocalDuration] = useState<DurationKey | null>(null);
  const [comments,      setComments]      = useState<WishComment[]>([]);
  const [commentText,   setCommentText]   = useState('');
  const [isSending,     setIsSending]     = useState(false);

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

  useEffect(() => {
    if (wish) {
      setEditingAddr(false); setAddrInput(wish.address ?? ''); setAddrSugs([]);
      setEditingDesc(false); setDescInput(wish.description ?? '');
      setLocalBudget(wish.budget ?? null);
      setLocalDuration(wish.duration ?? null);
      setComments([]); setCommentText('');
      setShowAssociate(false); setAssociateQuery(''); setAssociateSugs([]);
      setAddingVideo(false); setVideoInput('');
    }
  }, [wish?.id]);

  if (!wish) return null;

  const catMeta     = wish.category ? CATEGORY_META[wish.category] : null;
  const myVote      = wish.wish_votes.find(v => v.user_id === currentUserId)?.vote ?? null;
  const isVideo     = !!wish.link_url;
  const imageUri    = wish.image_url ?? wish.cover_url;
  const statusColor =
    wish.status === 'validated' ? '#22C55E' :
    wish.status === 'debate'    ? '#F97316' : '#9CA3AF';
  const statusLabel =
    wish.status === 'validated' ? 'Validée' :
    wish.status === 'debate'    ? 'En débat' :
    wish.status === 'archived'  ? 'Archivée' : 'En attente';

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
  const saveBudget = (val: BudgetLevel) => {
    const next = localBudget === val ? null : val;
    setLocalBudget(next as BudgetLevel | null);
    onUpdate(wish.id, { budget: next ?? undefined });
  };
  const saveDuration = (val: DurationKey) => {
    const next = localDuration === val ? null : val;
    setLocalDuration(next as DurationKey | null);
    onUpdate(wish.id, { duration: next ?? undefined });
  };

  const sendComment = async () => {
    if (!commentText.trim()) return;
    setIsSending(true);
    const newComment: WishComment = {
      id: Date.now().toString(), wish_id: wish.id,
      user_id: currentUserId, user_name: 'Moi',
      content: commentText.trim(), created_at: new Date().toISOString(),
    };
    supabase.from('wish_comments').insert({
      wish_id: wish.id, user_id: currentUserId || null,
      user_name: 'Moi', content: commentText.trim(),
    }).then(() => {});
    setComments(prev => [...prev, newComment]);
    setCommentText('');
    setIsSending(false);
  };

  const confirmArchive = () => Alert.alert(
    'Archiver', 'Archiver cette envie ?',
    [{ text: 'Annuler', style: 'cancel' }, { text: 'Archiver', onPress: () => { onArchive(wish.id); onClose(); } }]
  );
  const confirmDelete = () => Alert.alert(
    'Supprimer', 'Supprimer définitivement cette envie ?',
    [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => { onDelete(wish.id); onClose(); } }]
  );

  const isOrga = wish.type === 'orga';

  return (
    <Modal visible={!!wish} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[ds.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>

          <View style={ds.handle} />

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ── Image principale ── */}
            {imageUri ? (
              <View style={ds.imgWrap}>
                <Image source={{ uri: imageUri }} style={ds.img} resizeMode="cover" />
                {isVideo && (
                  <TouchableOpacity
                    style={ds.openTikTok}
                    onPress={async () => {
                      if (!wish.link_url) return;
                      try {
                        const ok = await Linking.canOpenURL(wish.link_url);
                        if (ok) await Linking.openURL(wish.link_url);
                        else await WebBrowser.openBrowserAsync(wish.link_url);
                      } catch {
                        await WebBrowser.openBrowserAsync(wish.link_url!);
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="logo-tiktok" size={16} color="white" />
                    <Text style={ds.openTikTokText}>Ouvrir dans TikTok</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {/* ── Section Vidéos (type place) ── */}
            {wish.type === 'place' && (
              <View style={ds.videoSection}>
                {/* Header */}
                <View style={ds.videoSectionHeader}>
                  <Text style={ds.videoSectionTitle}>🎬 Vidéos</Text>
                  {!addingVideo && (
                    <TouchableOpacity
                      style={ds.videoAddPill}
                      onPress={() => setAddingVideo(true)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="add" size={15} color={Colors.primary} />
                      <Text style={ds.videoAddPillText}>Ajouter</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Input d'ajout */}
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
                      <TouchableOpacity
                        style={ds.videoCancelBtn}
                        onPress={() => { setAddingVideo(false); setVideoInput(''); }}
                        activeOpacity={0.7}
                      >
                        <Text style={ds.videoCancelText}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[ds.videoConfirmBtn, (!videoInput.trim() || isFetchingVid) && { opacity: 0.4 }]}
                        onPress={handleAddVideoToWish}
                        disabled={!videoInput.trim() || isFetchingVid}
                        activeOpacity={0.8}
                      >
                        {isFetchingVid
                          ? <ActivityIndicator size="small" color="white" />
                          : <Text style={ds.videoConfirmText}>Ajouter</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Liste des vidéos */}
                {wish.links && wish.links.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={ds.videoScroll}
                  >
                    {wish.links.map((vl, i) => (
                      <View key={i} style={ds.videoCard}>
                        <TouchableOpacity
                          onPress={async () => {
                            try {
                              const ok = await Linking.canOpenURL(vl.url);
                              if (ok) await Linking.openURL(vl.url);
                              else await WebBrowser.openBrowserAsync(vl.url);
                            } catch {
                              await WebBrowser.openBrowserAsync(vl.url);
                            }
                          }}
                          activeOpacity={0.85}
                        >
                          <View style={ds.videoThumbWrap}>
                            {vl.thumbnail ? (
                              <Image source={{ uri: vl.thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            ) : (
                              <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' }]}>
                                <Ionicons name="logo-tiktok" size={28} color="#9CA3AF" />
                              </View>
                            )}
                            <View style={ds.videoPlayOverlay}>
                              <View style={ds.videoPlayBtn}>
                                <Ionicons name="play" size={14} color="white" />
                              </View>
                            </View>
                            {/* Bouton supprimer */}
                            <TouchableOpacity
                              style={ds.videoDeleteBtn}
                              onPress={() => handleRemoveVideoFromWish(i)}
                              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                            >
                              <Ionicons name="close-circle" size={18} color="white" />
                            </TouchableOpacity>
                          </View>
                          {vl.title && (
                            <Text style={ds.videoCardTitle} numberOfLines={2}>{vl.title}</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  !addingVideo && (
                    <Text style={ds.videoEmpty}>Aucune vidéo pour l'instant</Text>
                  )
                )}
              </View>
            )}

            <View style={ds.body}>

              {/* ── Title + badges ── */}
              <View style={ds.titleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={ds.title}>{wish.title}</Text>
                </View>
              </View>
              <View style={ds.badgeRow}>
                <View style={[ds.statusBadge, { backgroundColor: statusColor + '22' }]}>
                  <View style={[ds.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[ds.statusText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
                {catMeta && (
                  <View style={ds.catBadge}>
                    <Text style={ds.catBadgeText}>{catMeta.emoji} {catMeta.label}</Text>
                  </View>
                )}
                {wish.type && (
                  <View style={[ds.catBadge, { backgroundColor: wish.type === 'place' ? '#EFF6FF' : wish.type === 'orga' ? '#F0FDF4' : '#FFF7ED' }]}>
                    <Text style={ds.catBadgeText}>
                      {wish.type === 'place' ? '📍 Lieu' : wish.type === 'orga' ? '📋 Orga' : '✨ Inspiration'}
                    </Text>
                  </View>
                )}
              </View>

              {/* ── Orga done toggle ── */}
              {isOrga && (
                <TouchableOpacity
                  style={[ds.doneBtn, wish.done && ds.doneBtnActive]}
                  onPress={() => onUpdate(wish.id, { done: !wish.done })}
                  activeOpacity={0.8}
                >
                  <Ionicons name={wish.done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={wish.done ? '#22C55E' : Colors.textSecondary} />
                  <Text style={[ds.doneBtnText, wish.done && { color: '#22C55E' }]}>
                    {wish.done ? 'Fait ✅' : 'Marquer comme fait'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* ── Address ── */}
              {!isOrga && (
                <View style={ds.section}>
                  <Text style={ds.sectionLabel}>📍 Adresse</Text>
                  {!editingAddr && wish.address ? (
                    <TouchableOpacity onPress={() => isAuthor && setEditingAddr(true)} activeOpacity={0.75}>
                      <Text style={ds.infoValue}>{wish.address}</Text>
                    </TouchableOpacity>
                  ) : !editingAddr ? (
                    isAuthor ? (
                      <TouchableOpacity style={ds.addBtn} onPress={() => setEditingAddr(true)} activeOpacity={0.75}>
                        <Ionicons name="add-circle-outline" size={15} color={Colors.primary} />
                        <Text style={ds.addBtnText}>Ajouter une adresse</Text>
                      </TouchableOpacity>
                    ) : <Text style={ds.infoEmpty}>—</Text>
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

              {/* ── Transform inspiration → place ── */}
              {wish.type === 'inspiration' && (
                <View style={ds.section}>
                  {!showAssociate ? (
                    <TouchableOpacity style={ds.associateBtn} onPress={() => setShowAssociate(true)} activeOpacity={0.8}>
                      <Text style={ds.associateBtnIcon}>📍</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={ds.associateBtnTitle}>Associer un lieu Google</Text>
                        <Text style={ds.associateBtnSub}>Cette inspiration apparaîtra sur la carte</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  ) : (
                    <>
                      <Text style={ds.sectionLabel}>📍 Associer un lieu</Text>
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

              {/* ── Description ── */}
              <View style={ds.section}>
                <Text style={ds.sectionLabel}>📝 Description</Text>
                {!editingDesc && wish.description ? (
                  <TouchableOpacity onPress={() => isAuthor && setEditingDesc(true)} activeOpacity={0.75}>
                    <Text style={ds.infoValue}>{wish.description}</Text>
                  </TouchableOpacity>
                ) : !editingDesc ? (
                  isAuthor ? (
                    <TouchableOpacity style={ds.addBtn} onPress={() => setEditingDesc(true)} activeOpacity={0.75}>
                      <Ionicons name="add-circle-outline" size={15} color={Colors.primary} />
                      <Text style={ds.addBtnText}>Ajouter une description</Text>
                    </TouchableOpacity>
                  ) : <Text style={ds.infoEmpty}>—</Text>
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

              {/* ── Budget + Duration (not for orga) ── */}
              {!isOrga && (
                <>
                  <View style={ds.section}>
                    <Text style={ds.sectionLabel}>💰 Budget estimé</Text>
                    <View style={ds.pillRow}>
                      {BUDGET_OPTIONS.map(opt => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[ds.pill, localBudget === opt.key && ds.pillActive]}
                          onPress={() => isAuthor && saveBudget(opt.key)}
                          activeOpacity={0.8}
                        >
                          <Text style={[ds.pillText, localBudget === opt.key && ds.pillTextActive]}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={ds.section}>
                    <Text style={ds.sectionLabel}>⏱ Durée estimée</Text>
                    <View style={ds.pillRow}>
                      {DURATION_OPTIONS.map(opt => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[ds.pill, localDuration === opt.key && ds.pillActive]}
                          onPress={() => isAuthor && saveDuration(opt.key)}
                          activeOpacity={0.8}
                        >
                          <Text style={[ds.pillText, localDuration === opt.key && ds.pillTextActive]}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}

              {/* ── Link ── */}
              {wish.link_url && (
                <View style={ds.section}>
                  <Text style={ds.sectionLabel}>🔗 Lien source</Text>
                  <TouchableOpacity
                    onPress={async () => {
                      if (!wish.link_url) return;
                      try {
                        const ok = await Linking.canOpenURL(wish.link_url);
                        if (ok) await Linking.openURL(wish.link_url);
                        else await WebBrowser.openBrowserAsync(wish.link_url);
                      } catch {
                        await WebBrowser.openBrowserAsync(wish.link_url!);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[ds.infoValue, { color: '#3B82F6', textDecorationLine: 'underline' }]} numberOfLines={1}>
                      {wish.link_url}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Votes des membres (not for orga) ── */}
              {!isOrga && (
                <View style={ds.section}>
                  <Text style={ds.sectionLabel}>🗳️ Votes des membres</Text>
                  <View style={ds.memberVoteList}>
                    {MOCK_AVATARS.map(member => {
                      const mv = wish.wish_votes.find(v => v.user_id === member.id);
                      return (
                        <View key={member.id} style={ds.memberVoteRow}>
                          <View style={[ds.memberAvatar, { backgroundColor: member.color }]}>
                            <Image source={{ uri: member.photo }} style={ds.memberAvatarImg} />
                          </View>
                          <Text style={ds.memberName}>{member.name}</Text>
                          <View style={ds.memberVoteBadge}>
                            <Text style={ds.memberVoteEmoji}>
                              {mv?.vote === 'up' ? '❤️' : mv?.vote === 'down' ? '👎' : '⏳'}
                            </Text>
                            <Text style={ds.memberVoteLabel}>
                              {mv?.vote === 'up' ? 'J\'y vais' : mv?.vote === 'down' ? 'Pas pour moi' : 'Pas voté'}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* ── Commentaires ── */}
              <View style={ds.section}>
                <Text style={ds.sectionLabel}>💬 Commentaires</Text>
                {comments.length === 0 && (
                  <Text style={ds.infoEmpty}>Aucun commentaire. Soyez le premier !</Text>
                )}
                {comments.map(c => {
                  const av = MOCK_AVATARS.find(a => a.id === c.user_id);
                  return (
                    <View key={c.id} style={ds.commentRow}>
                      <View style={[ds.commentAvatar, { backgroundColor: av?.color ?? '#ccc' }]}>
                        {av ? (
                          <Image source={{ uri: av.photo }} style={ds.commentAvatarImg} />
                        ) : (
                          <Text style={{ fontSize: 12, color: '#fff' }}>{c.user_name[0]}</Text>
                        )}
                      </View>
                      <View style={ds.commentBody}>
                        <View style={ds.commentMeta}>
                          <Text style={ds.commentName}>{c.user_name}</Text>
                          <Text style={ds.commentDate}>
                            {new Date(c.created_at).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        <Text style={ds.commentText}>{c.content}</Text>
                      </View>
                    </View>
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

              {/* ── Actions ── */}
              <View style={ds.actionsSection}>
                {wish.status === 'validated' && !isOrga && (
                  <TouchableOpacity
                    style={[ds.actionBtn, { backgroundColor: Colors.primary }]}
                    onPress={() => Alert.alert('Planning', 'Fonctionnalité à venir !')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="calendar-outline" size={17} color={Colors.white} />
                    <Text style={[ds.actionBtnText, { color: Colors.white }]}>Ajouter au planning</Text>
                  </TouchableOpacity>
                )}
                {wish.status !== 'archived' && (
                  <TouchableOpacity style={ds.actionBtn} onPress={confirmArchive} activeOpacity={0.85}>
                    <Ionicons name="archive-outline" size={17} color={Colors.textPrimary} />
                    <Text style={ds.actionBtnText}>Archiver</Text>
                  </TouchableOpacity>
                )}
                {isAuthor && (
                  <TouchableOpacity style={[ds.actionBtn, ds.actionBtnDanger]} onPress={confirmDelete} activeOpacity={0.85}>
                    <Ionicons name="trash-outline" size={17} color="#EF4444" />
                    <Text style={[ds.actionBtnText, { color: '#EF4444' }]}>Supprimer</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>

          {/* ── Vote buttons (not for orga) ── */}
          {!isOrga && (
            <View style={ds.footer}>
              <TouchableOpacity
                style={[ds.voteBtn, myVote === 'up' && ds.voteBtnLove]}
                onPress={() => onVote(wish.id, 'up')} activeOpacity={0.8}
              >
                <Text style={ds.voteBtnEmoji}>❤️</Text>
                <Text style={[ds.voteBtnLabel, myVote === 'up' && { color: '#FF4B6E' }]}>
                  {myVote === 'up' ? 'Voté !' : 'J\'y vais'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ds.voteBtn, myVote === 'down' && ds.voteBtnPass]}
                onPress={() => onVote(wish.id, 'down')} activeOpacity={0.8}
              >
                <Text style={ds.voteBtnEmoji}>👎</Text>
                <Text style={ds.voteBtnLabel}>
                  {myVote === 'down' ? 'Voté !' : 'Pas pour moi'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─── TypePickerModal ────────────────────────────────────────── */
function TypePickerModal({
  visible, onSelect, onClose,
}: {
  visible:  boolean;
  onSelect: (type: WishType) => void;
  onClose:  () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tp.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[tp.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={tp.handle} />
          <Text style={tp.title}>Ajouter une envie</Text>
          <Text style={tp.subtitle}>Quel type d'envie veux-tu ajouter ?</Text>
          {TYPE_PICKER_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.type}
              style={tp.card}
              onPress={() => onSelect(opt.type)}
              activeOpacity={0.85}
            >
              <View style={[tp.cardIconWrap, {
                backgroundColor:
                  opt.type === 'place'       ? '#EFF6FF' :
                  opt.type === 'inspiration' ? '#FFF7ED' : '#F0FDF4',
              }]}>
                <Text style={tp.cardIcon}>{opt.emoji}</Text>
              </View>
              <View style={tp.cardText}>
                <Text style={tp.cardTitle}>{opt.title}</Text>
                <Text style={tp.cardSubtitle}>{opt.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C0C0C0" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

/* ─── AddWishModal ───────────────────────────────────────────── */
function AddWishModal({
  visible, tripId, userId, wishType, onClose, onAdded,
}: {
  visible:  boolean;
  tripId:   string;
  userId:   string;
  wishType: WishType;
  onClose:  () => void;
  onAdded:  () => void;
}) {
  const insets = useSafeAreaInsets();

  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [isSaving,    setIsSaving]    = useState(false);

  /* ── Place state ── */
  const [placeQuery,       setPlaceQuery]       = useState('');
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [selectedPlace,    setSelectedPlace]    = useState<PlaceDetails | null>(null);
  const [videoLinks,       setVideoLinks]       = useState<WishLink[]>([]);
  const [videoUrl,         setVideoUrl]         = useState('');
  const [isFetchingVideo,  setIsFetchingVideo]  = useState(false);
  const placeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Inspiration state ── */
  const [insLink,          setInsLink]          = useState('');
  const [linkPreview,      setLinkPreview]      = useState<LinkPreviewData | null>(null);
  const [isFetchingLink,   setIsFetchingLink]   = useState(false);
  const [category,         setCategory]         = useState<Category | null>(null);
  const [showPlaceSearch,  setShowPlaceSearch]  = useState(false);
  const [insPlaceQuery,    setInsPlaceQuery]    = useState('');
  const [insPlaceSugs,     setInsPlaceSugs]     = useState<PlaceSuggestion[]>([]);
  const [insSelectedPlace, setInsSelectedPlace] = useState<PlaceDetails | null>(null);
  const insPlaceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle(''); setDescription(''); setIsSaving(false);
      setPlaceQuery(''); setPlaceSuggestions([]); setSelectedPlace(null);
      setVideoLinks([]); setVideoUrl(''); setIsFetchingVideo(false);
      setInsLink(''); setLinkPreview(null); setIsFetchingLink(false);
      setCategory(null); setShowPlaceSearch(false);
      setInsPlaceQuery(''); setInsPlaceSugs([]); setInsSelectedPlace(null);
    }
  }, [visible]);

  const handlePlaceSearch = useCallback((text: string) => {
    setPlaceQuery(text);
    setSelectedPlace(null);
    if (placeTimer.current) clearTimeout(placeTimer.current);
    placeTimer.current = setTimeout(async () => {
      setPlaceSuggestions(await fetchPlaces(text));
    }, 400);
  }, []);

  const selectPlace = async (sug: PlaceSuggestion) => {
    setPlaceSuggestions([]);
    const details = await fetchPlaceDetails(sug.place_id);
    if (details) {
      setSelectedPlace(details);
      setPlaceQuery(details.name ?? sug.description);
      if (!title) setTitle(details.name ?? '');
      // Auto-detect category from Google types
      if (details.googleTypes) {
        const detected = detectCategory(details.googleTypes);
        if (detected) setCategory(detected);
      }
    }
  };

  const handleAddVideo = async () => {
    const url = videoUrl.trim();
    if (!url) return;
    setIsFetchingVideo(true);
    const data = await fetchLinkData(url);
    setIsFetchingVideo(false);
    const link: WishLink = {
      url,
      thumbnail: data?.thumbnail ?? undefined,
      title:     data?.title     ?? undefined,
    };
    setVideoLinks(prev => [...prev, link]);
    setVideoUrl('');
  };

  const handlePasteVideo = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text.includes('tiktok.com') || text.includes('instagram.com')) {
        setVideoUrl(text);
      } else {
        Alert.alert('Presse-papier', 'Aucun lien TikTok ou Instagram détecté.');
      }
    } catch { Alert.alert('Erreur', 'Impossible de lire le presse-papier.'); }
  };

  const handleInsLinkChange = useCallback(async (url: string) => {
    setInsLink(url); setLinkPreview(null);
    if (!url.includes('tiktok.com') && !url.includes('instagram.com')) return;
    setIsFetchingLink(true);
    const data = await fetchLinkData(url);
    setIsFetchingLink(false);
    if (data) { setLinkPreview(data); setTitle(t => t || data.title); }
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text.includes('tiktok.com') || text.includes('instagram.com')) {
        handleInsLinkChange(text);
      } else {
        Alert.alert('Presse-papier', 'Aucun lien TikTok ou Instagram détecté.');
      }
    } catch { Alert.alert('Erreur', 'Impossible de lire le presse-papier.'); }
  }, [handleInsLinkChange]);

  const handleInsPlaceSearch = useCallback((text: string) => {
    setInsPlaceQuery(text); setInsSelectedPlace(null);
    if (insPlaceTimer.current) clearTimeout(insPlaceTimer.current);
    insPlaceTimer.current = setTimeout(async () => {
      setInsPlaceSugs(await fetchPlaces(text));
    }, 400);
  }, []);

  const selectInsPlace = async (sug: PlaceSuggestion) => {
    setInsPlaceSugs([]);
    const details = await fetchPlaceDetails(sug.place_id);
    if (details) { setInsSelectedPlace(details); setInsPlaceQuery(details.name ?? sug.description); }
  };

  const handleSubmit = async () => {
    if (wishType === 'place' && !selectedPlace) {
      Alert.alert('Lieu requis', 'Recherche et sélectionne un lieu Google');
      return;
    }
    if (!title.trim() && wishType !== 'place') {
      Alert.alert('Titre requis', 'Donne un titre à ton envie');
      return;
    }
    setIsSaving(true);
    try {
      const base: Record<string, unknown> = {
        trip_id:     tripId,
        added_by:    userId || null,
        title:       title.trim() || selectedPlace?.name || '',
        description: description.trim() || null,
        status:      'pending',
        type:        wishType,
      };

      if (wishType === 'place' && selectedPlace) {
        base.address       = selectedPlace.address;
        base.latitude      = selectedPlace.lat;
        base.longitude     = selectedPlace.lng;
        base.google_rating = selectedPlace.rating ?? null;
        base.image_url     = selectedPlace.photoUrl ?? null;
        base.category      = category ?? null;
        base.links         = videoLinks.length > 0 ? videoLinks : null;
      }

      if (wishType === 'inspiration') {
        base.link_url  = insLink.trim() || null;
        base.image_url = linkPreview?.thumbnail ?? null;
        base.category  = category ?? null;
        if (insSelectedPlace) {
          base.address   = insSelectedPlace.address;
          base.latitude  = insSelectedPlace.lat;
          base.longitude = insSelectedPlace.lng;
        }
      }

      const { error } = await supabase.from('wishes').insert(base);
      if (error) throw error;
      onAdded(); onClose();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "Impossible d'ajouter l'envie");
    }
    setIsSaving(false);
  };

  const FORM_TITLES: Record<WishType, string> = {
    place:       '📍 Ajouter un lieu',
    inspiration: '✨ Ajouter une inspiration',
    orga:        '📋 Ajouter une tâche',
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[am.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={am.header}>
            <Text style={am.headerTitle}>{FORM_TITLES[wishType]}</Text>
            <TouchableOpacity onPress={onClose} style={am.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={am.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* ══ LIEU ══ */}
            {wishType === 'place' && (
              <>
                <View style={am.section}>
                  <Text style={am.label}>🔍 Rechercher un lieu *</Text>
                  <TextInput
                    style={am.input}
                    placeholder="Fontaine de Trevi, restaurant..."
                    placeholderTextColor={Colors.textTertiary}
                    value={placeQuery}
                    onChangeText={handlePlaceSearch}
                    autoCorrect={false}
                    autoFocus
                  />
                  {placeSuggestions.length > 0 && (
                    <View style={am.suggestBox}>
                      {placeSuggestions.slice(0, 5).map((sug, i) => (
                        <TouchableOpacity
                          key={sug.place_id}
                          style={[am.suggestItem, i < placeSuggestions.length - 1 && am.suggestBorder]}
                          onPress={() => selectPlace(sug)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                          <Text style={am.suggestText} numberOfLines={1}>{sug.description}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {selectedPlace && (
                  <View style={am.placePreviewCard}>
                    {selectedPlace.photoUrl && (
                      <Image source={{ uri: selectedPlace.photoUrl }} style={am.placePreviewImage} resizeMode="cover" />
                    )}
                    <View style={am.placePreviewBody}>
                      {!!selectedPlace.name && <Text style={am.placePreviewName}>{selectedPlace.name}</Text>}
                      <Text style={am.placePreviewAddr} numberOfLines={2}>{selectedPlace.address}</Text>
                      {!!selectedPlace.rating && (
                        <Text style={am.placePreviewRating}>⭐ {selectedPlace.rating.toFixed(1)}</Text>
                      )}
                    </View>
                  </View>
                )}

                <View style={am.section}>
                  <Text style={am.label}>Titre</Text>
                  <TextInput
                    style={am.input}
                    placeholder="Nom du lieu"
                    placeholderTextColor={Colors.textTertiary}
                    value={title}
                    onChangeText={setTitle}
                  />
                </View>

                {/* Catégorie (pré-sélectionnée par Google, modifiable) */}
                <View style={am.section}>
                  <Text style={am.label}>Catégorie</Text>
                  <View style={am.catGrid}>
                    {ADD_CATEGORIES.map(cat => (
                      <TouchableOpacity
                        key={cat.key}
                        style={[am.catBtn, category === cat.key && am.catBtnActive]}
                        onPress={() => setCategory(prev => prev === cat.key ? null : cat.key as Category)}
                        activeOpacity={0.75}
                      >
                        <Text style={am.catEmoji}>{cat.emoji}</Text>
                        <Text style={[am.catLabel, category === cat.key && am.catLabelActive]}>{cat.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Section vidéos */}
                <View style={am.section}>
                  <Text style={am.label}>🎬 Ajouter des vidéos</Text>
                  <Text style={am.videoHint}>Montre aux autres à quoi ça ressemble !</Text>
                  <View style={am.videoInputRow}>
                    <TextInput
                      style={[am.input, { flex: 1 }]}
                      placeholder="Lien TikTok ou Reel..."
                      placeholderTextColor={Colors.textTertiary}
                      value={videoUrl}
                      onChangeText={setVideoUrl}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      returnKeyType="done"
                      onSubmitEditing={handleAddVideo}
                    />
                    <TouchableOpacity style={am.videoPasteBtn} onPress={handlePasteVideo} activeOpacity={0.75}>
                      <Ionicons name="clipboard-outline" size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[am.videoAddBtn, (!videoUrl.trim() || isFetchingVideo) && { opacity: 0.5 }]}
                      onPress={handleAddVideo}
                      disabled={!videoUrl.trim() || isFetchingVideo}
                      activeOpacity={0.85}
                    >
                      {isFetchingVideo
                        ? <ActivityIndicator size="small" color={Colors.white} />
                        : <Text style={am.videoAddBtnText}>Ajouter</Text>
                      }
                    </TouchableOpacity>
                  </View>
                  {/* Liste des vidéos ajoutées */}
                  {videoLinks.map((vl, i) => (
                    <View key={i} style={am.videoItem}>
                      {vl.thumbnail ? (
                        <Image source={{ uri: vl.thumbnail }} style={am.videoThumb} resizeMode="cover" />
                      ) : (
                        <View style={[am.videoThumb, { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons name="play-circle-outline" size={22} color="#9CA3AF" />
                        </View>
                      )}
                      <Text style={am.videoItemTitle} numberOfLines={2}>{vl.title ?? vl.url}</Text>
                      <TouchableOpacity onPress={() => setVideoLinks(prev => prev.filter((_, j) => j !== i))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <View style={am.section}>
                  <Text style={am.label}>Note (optionnelle)</Text>
                  <TextInput
                    style={[am.input, am.inputMultiline]}
                    placeholder="Ajoute une note..."
                    placeholderTextColor={Colors.textTertiary}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </>
            )}

            {/* ══ INSPIRATION ══ */}
            {wishType === 'inspiration' && (
              <>
                <View style={am.section}>
                  <Text style={am.label}>🔗 Coller un lien TikTok ou Reels</Text>
                  <View style={am.linkRow}>
                    <TextInput
                      style={[am.input, { flex: 1 }]}
                      placeholder="https://www.tiktok.com/..."
                      placeholderTextColor={Colors.textTertiary}
                      value={insLink}
                      onChangeText={handleInsLinkChange}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                    {isFetchingLink && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 8 }} />}
                  </View>
                  <TouchableOpacity style={am.clipboardBtn} onPress={handlePaste} activeOpacity={0.75}>
                    <Ionicons name="clipboard-outline" size={15} color={Colors.textSecondary} />
                    <Text style={am.clipboardText}>Coller depuis le presse-papier</Text>
                  </TouchableOpacity>
                  {linkPreview && (
                    <View style={am.previewCard}>
                      {linkPreview.thumbnail && <Image source={{ uri: linkPreview.thumbnail }} style={am.previewThumb} resizeMode="cover" />}
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={am.previewTitle} numberOfLines={2}>{linkPreview.title}</Text>
                        {linkPreview.author && <Text style={am.previewAuthor}>@{linkPreview.author}</Text>}
                        <View style={am.previewBadge}><Text style={am.previewBadgeText}>🎵 TikTok</Text></View>
                      </View>
                    </View>
                  )}
                </View>

                <View style={am.section}>
                  <Text style={am.label}>Titre</Text>
                  <TextInput
                    style={am.input}
                    placeholder="Ex: Super restaurant à Rome"
                    placeholderTextColor={Colors.textTertiary}
                    value={title}
                    onChangeText={setTitle}
                  />
                </View>

                <View style={am.section}>
                  <Text style={am.label}>Catégorie (optionnelle)</Text>
                  <View style={am.catGrid}>
                    {ADD_CATEGORIES.map(cat => (
                      <TouchableOpacity
                        key={cat.key}
                        style={[am.catBtn, category === cat.key && am.catBtnActive]}
                        onPress={() => setCategory(prev => prev === cat.key ? null : cat.key as Category)}
                        activeOpacity={0.75}
                      >
                        <Text style={am.catEmoji}>{cat.emoji}</Text>
                        <Text style={[am.catLabel, category === cat.key && am.catLabelActive]}>{cat.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={am.section}>
                  {!showPlaceSearch ? (
                    <TouchableOpacity style={am.associateBtn} onPress={() => setShowPlaceSearch(true)} activeOpacity={0.8}>
                      <Text style={am.associateBtnEmoji}>📍</Text>
                      <Text style={am.associateBtnText}>Associer un lieu Google (optionnel)</Text>
                      <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                    </TouchableOpacity>
                  ) : (
                    <>
                      <Text style={am.label}>📍 Lieu associé</Text>
                      <TextInput
                        style={am.input}
                        placeholder="Rechercher un lieu..."
                        placeholderTextColor={Colors.textTertiary}
                        value={insPlaceQuery}
                        onChangeText={handleInsPlaceSearch}
                        autoCorrect={false}
                      />
                      {insPlaceSugs.length > 0 && (
                        <View style={am.suggestBox}>
                          {insPlaceSugs.slice(0, 4).map((sug, i) => (
                            <TouchableOpacity
                              key={sug.place_id}
                              style={[am.suggestItem, i < insPlaceSugs.length - 1 && am.suggestBorder]}
                              onPress={() => selectInsPlace(sug)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                              <Text style={am.suggestText} numberOfLines={1}>{sug.description}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      {insSelectedPlace && (
                        <View style={am.insPlacePreview}>
                          <Ionicons name="location" size={14} color={Colors.primary} />
                          <Text style={am.insPlacePreviewText} numberOfLines={1}>{insSelectedPlace.address}</Text>
                          <TouchableOpacity onPress={() => { setInsSelectedPlace(null); setInsPlaceQuery(''); }}>
                            <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}
                </View>

                <View style={am.section}>
                  <Text style={am.label}>Note (optionnelle)</Text>
                  <TextInput
                    style={[am.input, am.inputMultiline]}
                    placeholder="Ajoute une note..."
                    placeholderTextColor={Colors.textTertiary}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </>
            )}

            {/* ══ ORGA ══ */}
            {wishType === 'orga' && (
              <>
                <View style={am.section}>
                  <Text style={am.label}>Titre *</Text>
                  <TextInput
                    style={am.input}
                    placeholder="Ex: Prendre adaptateur secteur"
                    placeholderTextColor={Colors.textTertiary}
                    value={title}
                    onChangeText={setTitle}
                    autoFocus
                  />
                </View>
                <View style={am.section}>
                  <Text style={am.label}>Description (optionnelle)</Text>
                  <TextInput
                    style={[am.input, am.inputMultiline]}
                    placeholder="Détails, rappels..."
                    placeholderTextColor={Colors.textTertiary}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </>
            )}

          </ScrollView>

          <View style={am.footer}>
            <TouchableOpacity style={[am.submitBtn, isSaving && { opacity: 0.6 }]} onPress={handleSubmit} disabled={isSaving} activeOpacity={0.85}>
              {isSaving
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={am.submitBtnText}>Ajouter</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─── Filter Menu styles ─────────────────────────────────────── */
const fm = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 8,
  },
  handle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.18)', alignSelf: 'center', marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  title:    { flex: 1, fontSize: 17, fontWeight: '800', color: '#111' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#888', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  catWrap:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  catChip:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, backgroundColor: '#F0F0F0' },
  catChipActive:    { backgroundColor: '#111' },
  catChipEmoji:     { fontSize: 15 },
  catChipLabel:     { fontSize: 13, fontWeight: '600', color: '#111' },
  catChipLabelActive: { color: '#fff' },
  typeWrap:         { flexDirection: 'row', gap: 8, marginBottom: 4 },
  typeChip:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 99, backgroundColor: '#F0F0F0' },
  typeChipActive:   { backgroundColor: '#111' },
  typeChipEmoji:    { fontSize: 14 },
  typeChipLabel:    { fontSize: 12, fontWeight: '600', color: '#111' },
  typeChipLabelActive: { color: '#fff' },
  sortWrap:         { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 24 },
  sortChip:         { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 99, backgroundColor: '#F0F0F0' },
  sortChipActive:   { backgroundColor: '#111' },
  sortLabel:        { fontSize: 13, fontWeight: '600', color: '#111' },
  sortLabelActive:  { color: '#fff' },
  resetBtn:  { alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E0E0E0' },
  resetText: { fontSize: 14, fontWeight: '700', color: '#888' },
});

/* ─── FilterMenu ─────────────────────────────────────────────── */
const FM_CATS: { key: Category; emoji: string; label: string }[] = [
  { key: 'restaurant', emoji: '🍽️', label: 'Restaurant' },
  { key: 'monument',   emoji: '🏛️', label: 'Monument'   },
  { key: 'cafe',       emoji: '☕',  label: 'Café'        },
  { key: 'hotel',      emoji: '🏨', label: 'Hôtel'       },
  { key: 'activity',   emoji: '🎭', label: 'Activités'   },
  { key: 'photo_spot', emoji: '📸', label: 'Photo spot'  },
  { key: 'bar',        emoji: '🍺', label: 'Bar'         },
  { key: 'autre',      emoji: '📦', label: 'Autre'       },
];

const FM_TYPES: { key: WishType; emoji: string; label: string }[] = [
  { key: 'place',       emoji: '📍', label: 'Lieux'        },
  { key: 'inspiration', emoji: '✨', label: 'Inspirations' },
  { key: 'orga',        emoji: '📋', label: 'Orga'         },
];

const FM_SORTS: { key: SortBy; label: string }[] = [
  { key: 'recent',     label: 'Plus récent' },
  { key: 'oldest',     label: 'Plus ancien' },
  { key: 'most_voted', label: 'Plus voté'   },
];

function FilterMenu({
  visible, catFilters, typeFilters, sortBy,
  onToggleCat, onToggleType, onSetSort, onReset, onClose,
}: {
  visible:      boolean;
  catFilters:   Set<Category>;
  typeFilters:  Set<WishType>;
  sortBy:       SortBy;
  onToggleCat:  (cat: Category) => void;
  onToggleType: (type: WishType) => void;
  onSetSort:    (sort: SortBy) => void;
  onReset:      () => void;
  onClose:      () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={fm.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[fm.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <View style={fm.handle} />
          <View style={fm.titleRow}>
            <Text style={fm.title}>Filtres</Text>
            <TouchableOpacity onPress={onClose} style={fm.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={fm.sectionLabel}>Type</Text>
          <View style={[fm.typeWrap, { marginBottom: 20 }]}>
            {FM_TYPES.map(t => {
              const active = typeFilters.has(t.key);
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[fm.typeChip, active && fm.typeChipActive]}
                  onPress={() => onToggleType(t.key)}
                  activeOpacity={0.8}
                >
                  <Text style={fm.typeChipEmoji}>{t.emoji}</Text>
                  <Text style={[fm.typeChipLabel, active && fm.typeChipLabelActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={fm.sectionLabel}>Catégories</Text>
          <View style={[fm.catWrap, { marginBottom: 20 }]}>
            {FM_CATS.map(cat => {
              const active = catFilters.has(cat.key);
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[fm.catChip, active && fm.catChipActive]}
                  onPress={() => onToggleCat(cat.key)}
                  activeOpacity={0.8}
                >
                  <Text style={fm.catChipEmoji}>{cat.emoji}</Text>
                  <Text style={[fm.catChipLabel, active && fm.catChipLabelActive]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[fm.sectionLabel, { marginTop: 0 }]}>Trier par</Text>
          <View style={fm.sortWrap}>
            {FM_SORTS.map(s => (
              <TouchableOpacity
                key={s.key}
                style={[fm.sortChip, sortBy === s.key && fm.sortChipActive]}
                onPress={() => onSetSort(s.key)}
                activeOpacity={0.8}
              >
                <Text style={[fm.sortLabel, sortBy === s.key && fm.sortLabelActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={fm.resetBtn} onPress={onReset} activeOpacity={0.8}>
            <Text style={fm.resetText}>Réinitialiser</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Écran principal ────────────────────────────────────────── */
export default function EnviesScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const insets         = useSafeAreaInsets();
  const { session }    = useAuth();
  const currentUserId  = session?.user?.id ?? '';

  const [wishes,         setWishes]         = useState<Wish[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>('all');
  const userChangedFilter = useRef(false);
  const [catFilters,     setCatFilters]     = useState<Set<Category>>(new Set());
  const [typeFilters,    setTypeFilters]    = useState<Set<WishType>>(new Set());
  const [sortBy,         setSortBy]         = useState<SortBy>('recent');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [selectedType,   setSelectedType]   = useState<WishType>('inspiration');
  const [showAddModal,   setShowAddModal]   = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [detailId,       setDetailId]       = useState<string | null>(null);

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
        .eq('trip_id', tripId).order('created_at', { ascending: false });
      if (!error && data) setWishes(data as Wish[]);
    } catch {}
    setLoading(false);
  }, [tripId]);

  useEffect(() => { fetchWishes(); }, [fetchWishes]);

  /* ── Filtre par défaut ── */
  useEffect(() => {
    if (wishes.length > 0 && !userChangedFilter.current) {
      const hasPending = wishes.some(w => w.status === 'pending');
      setStatusFilter(hasPending ? 'pending' : 'all');
    }
  }, [wishes]);

  /* ── Status chip counts ── */
  const pendingCount   = useMemo(() => wishes.filter(w => w.status === 'pending').length,   [wishes]);
  const validatedCount = useMemo(() => wishes.filter(w => w.status === 'validated').length, [wishes]);
  const archivedCount  = useMemo(() => wishes.filter(w => w.status === 'archived').length,  [wishes]);
  const allActiveCount = useMemo(() => wishes.filter(w => w.status !== 'archived').length,  [wishes]);

  const statusChips = useMemo(() => {
    const chips: { key: StatusFilter; label: string }[] = [];
    if (pendingCount > 0)
      chips.push({ key: 'pending',   label: `En attente (${pendingCount})` });
    chips.push({ key: 'all',         label: `Toutes (${allActiveCount})` });
    chips.push({ key: 'validated',   label: `Validées (${validatedCount})` });
    chips.push({ key: 'archived',    label: `Archivées (${archivedCount})` });
    return chips;
  }, [pendingCount, validatedCount, archivedCount, allActiveCount]);

  const toggleCat = useCallback((cat: Category) => {
    setCatFilters(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }, []);

  const toggleType = useCallback((type: WishType) => {
    setTypeFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }, []);

  /* ── Filtered + sorted ── */
  const filtered = useMemo(() => {
    let result = statusFilter === 'all'
      ? wishes.filter(w => w.status !== 'archived')
      : wishes.filter(w => w.status === statusFilter);
    if (typeFilters.size > 0)
      result = result.filter(w => typeFilters.has(w.type ?? 'inspiration'));
    if (catFilters.size > 0)
      result = result.filter(w => w.category && catFilters.has(w.category));
    result = [...result].sort((a, b) => {
      if (sortBy === 'oldest')
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'most_voted')
        return b.wish_votes.length - a.wish_votes.length;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return result;
  }, [wishes, statusFilter, catFilters, typeFilters, sortBy]);

  const [leftCol, rightCol] = useMemo(() => {
    const l: Wish[] = []; const r: Wish[] = [];
    filtered.forEach((w, i) => { if (i % 2 === 0) l.push(w); else r.push(w); });
    return [l, r];
  }, [filtered]);

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

      const newStatus = computeStatus(newVotes);
      if (newStatus !== w.status)
        supabase.from('wishes').update({ status: newStatus }).eq('id', wishId).then(() => {});

      return { ...w, wish_votes: newVotes, status: newStatus };
    }));
  }, [currentUserId]);

  /* ── Update wish fields ── */
  const handleUpdate = useCallback((wishId: string, patch: Partial<Wish>) => {
    setWishes(prev => prev.map(w => w.id === wishId ? { ...w, ...patch } : w));
    const { wish_votes: _wv, ...dbPatch } = patch as Wish;
    supabase.from('wishes').update(dbPatch).eq('id', wishId).then(({ error }) => {
      if (error) console.warn('[handleUpdate] ERROR:', JSON.stringify(error));
    });
  }, []);

  /* ── Toggle done (orga) ── */
  const handleToggleDone = useCallback((wishId: string) => {
    setWishes(prev => prev.map(w => {
      if (w.id !== wishId) return w;
      const newDone = !w.done;
      supabase.from('wishes').update({ done: newDone }).eq('id', wishId).then(() => {});
      return { ...w, done: newDone };
    }));
  }, []);

  /* ── Archive / Delete ── */
  const handleArchive = useCallback((wishId: string) => {
    handleUpdate(wishId, { status: 'archived' });
  }, [handleUpdate]);

  const handleDelete = useCallback((wishId: string) => {
    setWishes(prev => prev.filter(w => w.id !== wishId));
    supabase.from('wishes').delete().eq('id', wishId).then(() => {});
  }, []);

  const renderCol = (col: Wish[]) => col.map(w => (
    <WishCard
      key={w.id} wish={w}
      currentUserId={currentUserId}
      onVote={handleVote}
      onPress={() => setDetailId(w.id)}
      onToggleDone={handleToggleDone}
    />
  ));

  return (
    <View style={[sc.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={sc.header}>
        <Text style={sc.title}>Vos envies</Text>
        <TouchableOpacity style={sc.gearBtn} activeOpacity={0.7}>
          <Ionicons name="settings-outline" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Status chips ── */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={sc.filterRow} contentContainerStyle={sc.filterContent}
      >
        {statusChips.map(c => (
          <TouchableOpacity
            key={c.key}
            style={[sc.chip, statusFilter === c.key && sc.chipActive]}
            onPress={() => { userChangedFilter.current = true; setStatusFilter(c.key); }}
            activeOpacity={0.8}
          >
            <Text style={[sc.chipText, statusFilter === c.key && sc.chipTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Vote banner ── */}
      {unvotedCount > 0 && (
        <TouchableOpacity style={sc.voteBanner} onPress={() => { setStatusFilter('pending'); setCatFilters(new Set()); setTypeFilters(new Set()); }} activeOpacity={0.85}>
          <Text style={sc.voteBannerText}>
            🗳️ {unvotedCount} envie{unvotedCount > 1 ? 's' : ''} attend{unvotedCount > 1 ? 'ent' : ''} ton vote !
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Masonry grid ── */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : filtered.length === 0 ? (
        <View style={sc.empty}>
          <Text style={sc.emptyIcon}>✨</Text>
          <Text style={sc.emptyText}>Aucune envie dans cette catégorie</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[sc.masonryContent, { paddingBottom: Math.max(insets.bottom, 16) + 110 }]}
        >
          <View style={sc.masonryRow}>
            <View style={{ width: COL_WIDTH }}>{renderCol(leftCol)}</View>
            <View style={{ width: COL_WIDTH }}>{renderCol(rightCol)}</View>
          </View>
        </ScrollView>
      )}

      {/* ── Bottom nav ── */}
      <View
        style={[sc.bottomNav, { bottom: Math.max(insets.bottom, 10) + 16 }]}
        pointerEvents="box-none"
      >
        <NavButton icon="arrow-back-outline" onPress={() => router.back()} />
        <NavButton icon="add" iconSize={28} onPress={() => setShowTypePicker(true)} />
        <NavButton icon="options-outline" onPress={() => setShowFilterMenu(true)} />
      </View>

      {/* ── Modals ── */}
      <TypePickerModal
        visible={showTypePicker}
        onSelect={(type) => { setSelectedType(type); setShowTypePicker(false); setShowAddModal(true); }}
        onClose={() => setShowTypePicker(false)}
      />
      <FilterMenu
        visible={showFilterMenu}
        catFilters={catFilters}
        typeFilters={typeFilters}
        sortBy={sortBy}
        onToggleCat={toggleCat}
        onToggleType={toggleType}
        onSetSort={setSortBy}
        onReset={() => { setCatFilters(new Set()); setTypeFilters(new Set()); setSortBy('recent'); }}
        onClose={() => setShowFilterMenu(false)}
      />
      <AddWishModal
        visible={showAddModal}
        tripId={tripId ?? ''}
        userId={currentUserId}
        wishType={selectedType}
        onClose={() => setShowAddModal(false)}
        onAdded={() => { setShowAddModal(false); fetchWishes(); }}
      />
      <DetailSheet
        wish={detailWish} currentUserId={currentUserId}
        isAuthor={detailWish?.added_by === currentUserId}
        onVote={handleVote} onUpdate={handleUpdate}
        onArchive={handleArchive} onDelete={handleDelete}
        onClose={() => setDetailId(null)}
      />

    </View>
  );
}

/* ─── Card styles ────────────────────────────────────────────── */
const cs = StyleSheet.create({
  card: { width: COL_WIDTH, borderRadius: 20, overflow: 'hidden', backgroundColor: Colors.surface, ...Shadows.md },
  cardDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },

  /* Badge */
  badge:      { position: 'absolute', top: 10, left: 10, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  badgeTikTok: { backgroundColor: 'rgba(220,80,60,0.92)' },
  badgePlace:  { backgroundColor: 'rgba(59,130,246,0.92)' },
  badgeOrg:    { backgroundColor: 'rgba(120,140,90,0.92)' },
  badgeText:   { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  /* Status dot */
  dotWrap: { position: 'absolute', top: 10, right: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)' },

  /* Play button */
  playWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playBtn:  { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.28)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },

  /* Inspiration bottom */
  cardBottomVideo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, backgroundColor: 'rgba(0,0,0,0.22)' },
  titleVideo:      { fontSize: 13, fontWeight: '700', color: '#fff', lineHeight: 18, marginBottom: 4 },
  authorRow:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  avatarXS:        { width: 20, height: 20, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  authorName:      { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  /* Place card */
  placeNoImageBg:   { backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  cardBottomPlace:  { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, backgroundColor: 'rgba(0,0,0,0.22)' },
  titlePlaceNoImg:  { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, lineHeight: 18 },
  ratingText:       { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginTop: 2 },

  /* Orga card */
  checkboxWrap: { position: 'absolute', top: 10, right: 10, zIndex: 10 },
  checkbox:     { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#9CA3AF', backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  orgBody:      { flex: 1, paddingHorizontal: 12, paddingTop: 44, paddingBottom: 8, justifyContent: 'flex-start' },
  titleOrg:     { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, lineHeight: 20 },
  descOrg:      { fontSize: 12, color: Colors.textSecondary, lineHeight: 16, marginTop: 4 },
  orgBottom:    { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12 },
  avatarSM:     { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: Colors.white },
  avatarSMImg:  { width: '100%', height: '100%' },

  flashOverlay: { borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  swipeBorder:  { borderRadius: 20, borderWidth: 2, borderColor: Colors.primary, opacity: 0.45 },
});

/* ─── TypePickerModal styles ─────────────────────────────────── */
const tp = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12,
  },
  handle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  title:    { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  cardIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardIcon:     { fontSize: 22 },
  cardText:     { flex: 1 },
  cardTitle:    { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  cardSubtitle: { fontSize: 13, color: Colors.textSecondary },
});

/* ─── Screen styles ──────────────────────────────────────────── */
const sc = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: H_PAD, paddingTop: Spacing.sm, paddingBottom: Spacing.sm,
  },
  title:   { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  gearBtn: { width: 40, height: 40, borderRadius: Radii.full, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },

  filterRow:     { maxHeight: 48, marginBottom: 4 },
  filterContent: { paddingHorizontal: H_PAD, gap: Spacing.sm, alignItems: 'center' },
  chip:          { paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radii.full, backgroundColor: '#F0F0F0' },
  chipActive:    { backgroundColor: Colors.primary },
  chipText:      { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  chipTextActive: { color: Colors.white },

  voteBanner: {
    marginHorizontal: H_PAD, marginTop: 4, marginBottom: 10,
    backgroundColor: '#FFFBEB', borderRadius: Radii.md,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  voteBannerText: { fontSize: 13, fontWeight: '600', color: '#92400E' },

  masonryContent: { paddingHorizontal: H_PAD, paddingTop: Spacing.sm },
  masonryRow:     { flexDirection: 'row', gap: COL_GAP },

  empty:     { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },

  bottomNav: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 14 },
});

/* ─── Detail sheet styles ────────────────────────────────────── */
const ds = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 12, marginBottom: 8 },

  imgWrap:       { width: '100%', height: 240 },
  img:           { width: '100%', height: '100%' },

  /* Video section */
  videoSection:        { paddingTop: 14, paddingBottom: 6 },
  videoSectionHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  videoSectionTitle:   { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  videoAddPill:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '14', borderRadius: Radii.full, paddingHorizontal: 10, paddingVertical: 5 },
  videoAddPillText:    { fontSize: 12, fontWeight: '700', color: Colors.primary },
  videoInputWrap:      { marginHorizontal: 16, marginBottom: 12, gap: 8 },
  videoInput:          { backgroundColor: Colors.surface, borderRadius: Radii.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  videoInputActions:   { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  videoCancelBtn:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radii.full, backgroundColor: Colors.surface },
  videoCancelText:     { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  videoConfirmBtn:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radii.full, backgroundColor: Colors.primary },
  videoConfirmText:    { fontSize: 13, color: 'white', fontWeight: '700' },
  videoScroll:         { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  videoCard:           { width: 130, gap: 6 },
  videoThumbWrap:      { width: 130, height: 92, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1C1C1E' },
  videoPlayOverlay:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  videoPlayBtn:        { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.28)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  videoDeleteBtn:      { position: 'absolute', top: 5, right: 5 },
  videoCardTitle:      { fontSize: 11, color: Colors.textSecondary, lineHeight: 14 },
  videoEmpty:          { paddingHorizontal: 16, fontSize: 12, color: Colors.textTertiary, fontStyle: 'italic', marginBottom: 4 },
  openTikTok:    { position: 'absolute', bottom: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: Radii.full, paddingHorizontal: 14, paddingVertical: 8 },
  openTikTokText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  body:      { padding: Spacing.md, gap: 6 },
  titleRow:  { flexDirection: 'row', alignItems: 'flex-start' },
  title:     { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3, lineHeight: 28 },
  badgeRow:  { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: 6, marginBottom: 4, flexWrap: 'wrap' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radii.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot:   { width: 7, height: 7, borderRadius: 4 },
  statusText:  { fontSize: 12, fontWeight: '700' },
  catBadge:    { backgroundColor: Colors.surface, borderRadius: Radii.full, paddingHorizontal: 10, paddingVertical: 4 },
  catBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },

  /* Orga done button */
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8, paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  doneBtnActive: { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
  doneBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },

  /* Associate place button */
  associateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: Radii.md, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: '#93C5FD', backgroundColor: '#EFF6FF',
  },
  associateBtnIcon:  { fontSize: 20 },
  associateBtnTitle: { fontSize: 14, fontWeight: '700', color: '#1D4ED8' },
  associateBtnSub:   { fontSize: 12, color: '#60A5FA', marginTop: 1 },

  section:      { marginTop: Spacing.md, gap: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.1 },
  infoValue:    { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  infoEmpty:    { fontSize: 13, color: Colors.textTertiary, fontStyle: 'italic' },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addBtnText:   { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  inputRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { backgroundColor: Colors.surface, borderRadius: Radii.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  miniBtn: { paddingVertical: 10, borderRadius: Radii.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  miniBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  miniBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  suggestBox:  { marginTop: 4, backgroundColor: Colors.white, borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadows.sm },
  suggestItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: 12, paddingVertical: 10 },
  suggestBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  suggestText: { flex: 1, fontSize: 13, color: Colors.textPrimary },
  pillRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radii.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillText:   { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  pillTextActive: { color: Colors.white },

  memberVoteList:  { gap: 12 },
  memberVoteRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberAvatar:    { width: 34, height: 34, borderRadius: 17, overflow: 'hidden' },
  memberAvatarImg: { width: '100%', height: '100%' },
  memberName:      { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  memberVoteBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberVoteEmoji: { fontSize: 16 },
  memberVoteLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

  commentRow:      { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 12 },
  commentAvatar:   { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  commentAvatarImg: { width: '100%', height: '100%' },
  commentBody:     { flex: 1, backgroundColor: Colors.surface, borderRadius: Radii.md, padding: 10 },
  commentMeta:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentName:     { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  commentDate:     { fontSize: 11, color: Colors.textTertiary },
  commentText:     { fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  commentInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
  sendBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },

  actionsSection: { marginTop: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  actionBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: Radii.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  actionBtnDanger: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  actionBtnText:  { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },

  footer:       { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  voteBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: Radii.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  voteBtnLove:  { backgroundColor: '#FFF0F3', borderColor: '#FF4B6E' },
  voteBtnPass:  { backgroundColor: '#FFF7ED', borderColor: '#F97316' },
  voteBtnEmoji: { fontSize: 18 },
  voteBtnLabel: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
});

/* ─── AddWishModal styles ────────────────────────────────────── */
const am = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
  closeBtn:    { width: 36, height: 36, borderRadius: Radii.full, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xl },
  section:     { marginBottom: Spacing.lg },
  label:       { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  input:       { backgroundColor: Colors.surface, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  inputMultiline: { height: 90, paddingTop: 12 },
  linkRow:     { flexDirection: 'row', alignItems: 'center' },
  clipboardBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingVertical: 8 },
  clipboardText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  previewCard:  { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radii.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  previewThumb: { width: 64, height: 64, borderRadius: Radii.sm },
  previewTitle: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, lineHeight: 18 },
  previewAuthor: { fontSize: 12, color: Colors.textSecondary },
  previewBadge: { alignSelf: 'flex-start', backgroundColor: '#F0F0F0', borderRadius: Radii.full, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  previewBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },

  /* Place preview card */
  placePreviewCard:  { marginBottom: Spacing.md, borderRadius: Radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  placePreviewImage: { width: '100%', height: 130 },
  placePreviewBody:  { padding: 12, gap: 3 },
  placePreviewName:  { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  placePreviewAddr:  { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
  placePreviewRating: { fontSize: 13, fontWeight: '600', color: '#D97706', marginTop: 4 },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  catBtn:  { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: Radii.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, minWidth: 76, gap: 4 },
  catBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catEmoji:     { fontSize: 20 },
  catLabel:     { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  catLabelActive: { color: Colors.white },

  suggestBox:  { marginTop: 4, backgroundColor: Colors.white, borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadows.sm },
  suggestItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 12 },
  suggestBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  suggestText: { flex: 1, fontSize: 13, color: Colors.textPrimary },

  /* Associate place button */
  associateBtn:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 14, borderRadius: Radii.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#93C5FD', backgroundColor: '#EFF6FF' },
  associateBtnEmoji: { fontSize: 18 },
  associateBtnText:  { flex: 1, fontSize: 14, fontWeight: '600', color: '#1D4ED8' },

  /* Inline place preview */
  insPlacePreview:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, padding: 10, backgroundColor: '#EFF6FF', borderRadius: Radii.md },
  insPlacePreviewText: { flex: 1, fontSize: 13, color: Colors.textPrimary },

  /* Video links (place form) */
  videoHint:     { fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  videoInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  videoPasteBtn: { width: 44, height: 44, borderRadius: Radii.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  videoAddBtn:   { height: 44, paddingHorizontal: 14, borderRadius: Radii.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  videoAddBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  videoItem:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: Colors.border },
  videoThumb:    { width: 56, height: 40, borderRadius: 6, overflow: 'hidden' },
  videoItemTitle: { flex: 1, fontSize: 12, color: Colors.textPrimary, lineHeight: 16 },

  footer:        { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  submitBtn:     { backgroundColor: Colors.primary, borderRadius: Radii.lg, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', ...Shadows.md },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white, letterSpacing: -0.3 },
});
