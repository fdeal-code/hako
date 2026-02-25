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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { NavButton } from '@/components/ui/NavButton';

const { width: SW } = Dimensions.get('window');
const COL_GAP    = 10;
const H_PAD      = 14;
const COL_WIDTH  = (SW - H_PAD * 2 - COL_GAP) / 2;

/* ─── Types ──────────────────────────────────────────────────── */
type Category   = 'restaurant' | 'monument' | 'cafe' | 'hotel' | 'activity' | 'photo' | 'photo_spot' | 'bar';
type WishStatus = 'pending' | 'validated' | 'debate' | 'archived';
type VoteType   = 'up' | 'down';
type CatFilter  = 'all' | Category;

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
  status:         WishStatus;
  wish_votes:     WishVote[];
  created_at:     string;
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
};

const ADD_CATEGORIES: { key: Category | 'autre'; emoji: string; label: string }[] = [
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

/* ─── Modal helpers ──────────────────────────────────────────── */
interface LinkPreviewData {
  title:     string;
  thumbnail: string | null;
  author:    string | null;
}

interface PlaceSuggestion {
  place_id:    string;
  description: string;
}

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

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

/* ─── Mock data ──────────────────────────────────────────────── */
const MOCK_WISHES: Wish[] = [
  {
    id: '1', trip_id: '1', added_by: 'u1', added_by_name: 'Alex',
    title: 'Prendre adaptateur', category: 'activity',
    description: 'Ne pas oublier l\'adaptateur secteur pour l\'Italie',
    status: 'pending', wish_votes: [], created_at: '',
  },
  {
    id: '2', trip_id: '1', added_by: 'u2', added_by_name: 'Marie',
    title: 'Best Ramen Tokyo', category: 'restaurant',
    image_url: 'https://picsum.photos/seed/ramen/400/280',
    link_url: 'https://www.tiktok.com/@marie/video/7123456789',
    status: 'validated',
    wish_votes: [{ id: 'v1', wish_id: '2', user_id: 'u1', vote: 'up' }],
    created_at: '',
  },
  {
    id: '3', trip_id: '1', added_by: 'u3', added_by_name: 'Tom',
    title: 'Cascade di Trevi', category: 'photo_spot',
    image_url: 'https://picsum.photos/seed/waterfall/400/520',
    link_url: 'https://www.tiktok.com/@tom/video/9876543210',
    status: 'debate',
    wish_votes: [
      { id: 'v2', wish_id: '3', user_id: 'u1', vote: 'up'   },
      { id: 'v3', wish_id: '3', user_id: 'u2', vote: 'down' },
    ],
    created_at: '',
  },
  {
    id: '4', trip_id: '1', added_by: 'u4', added_by_name: 'Sarah',
    title: 'Trouver un resto pour le 15', category: 'restaurant',
    description: 'Idéalement avec une terrasse et une bonne ambiance',
    status: 'pending', wish_votes: [], created_at: '',
  },
  {
    id: '5', trip_id: '1', added_by: 'u1', added_by_name: 'Alex',
    title: 'Vatican Museums', category: 'monument',
    image_url: 'https://picsum.photos/seed/vatican2/400/340',
    link_url: 'https://www.tiktok.com/@alex/video/5555555555',
    status: 'pending', wish_votes: [], created_at: '',
  },
  {
    id: '6', trip_id: '1', added_by: 'u2', added_by_name: 'Marie',
    title: 'Aperitivo au coucher du soleil', category: 'bar',
    description: 'Spritz obligatoire avec vue sur les toits de Rome',
    status: 'pending', wish_votes: [], created_at: '',
  },
];

/* ─── WishCard (masonry, 2 types) ───────────────────────────── */
function WishCard({
  wish,
  currentUserId,
  onVote,
  onPress,
}: {
  wish:          Wish;
  currentUserId: string;
  onVote:        (wishId: string, vote: VoteType) => void;
  onPress:       () => void;
}) {
  const isVideo  = !!wish.link_url;
  const hasImage = !!(wish.image_url ?? wish.cover_url);
  const hasVoted = wish.wish_votes.some(v => v.user_id === currentUserId);

  const pan   = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const swipeRef    = useRef(false);
  const longTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const [flash, setFlash]       = useState<'up' | 'down' | null>(null);
  const [swipeOn, setSwipeOn]   = useState(false);

  // Pulse animation on vote indicator when not voted
  useEffect(() => {
    if (!hasVoted) {
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
  }, [hasVoted]);

  const resetSwipe = useCallback(() => {
    swipeRef.current = false;
    setSwipeOn(false);
    if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null; }
    Animated.spring(pan,   { toValue: 0, useNativeDriver: false }).start();
    Animated.spring(scale, { toValue: 1, useNativeDriver: true  }).start();
  }, [pan, scale]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder:        () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      swipeRef.current && Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 8,
    onMoveShouldSetPanResponderCapture: (_, { dx, dy }) =>
      swipeRef.current && Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 8,
    onPanResponderMove: (_, { dx }) => {
      if (swipeRef.current) pan.setValue(dx);
    },
    onPanResponderRelease: (_, { dx }) => {
      if (swipeRef.current) {
        if (dx > 60) {
          setFlash('up');
          onVote(wish.id, 'up');
          setTimeout(() => setFlash(null), 500);
        } else if (dx < -60) {
          setFlash('down');
          onVote(wish.id, 'down');
          setTimeout(() => setFlash(null), 500);
        }
        resetSwipe();
      }
    },
    onPanResponderTerminate: () => resetSwipe(),
  })).current;

  const statusColor =
    wish.status === 'validated' ? '#22C55E' :
    wish.status === 'debate'    ? '#F97316' : '#9CA3AF';

  // Card height varies by type and id
  const n = parseInt(wish.id, 10) || 0;
  const cardH = isVideo && hasImage
    ? 205 + (n % 3) * 28
    : 148 + (n % 2) * 22;

  const imageUri = wish.image_url ?? wish.cover_url;
  const addedByAvatar = MOCK_AVATARS.find(a => a.name === wish.added_by_name);

  return (
    <Animated.View
      style={{ transform: [{ translateX: pan }, { scale }], marginBottom: COL_GAP }}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={[s.card, { height: cardH }]}
        activeOpacity={0.92}
        onPress={() => { if (!swipeRef.current) onPress(); }}
        onLongPress={() => {
          swipeRef.current = true;
          setSwipeOn(true);
          Animated.spring(scale, { toValue: 1.05, useNativeDriver: true }).start();
        }}
        delayLongPress={450}
      >
        {/* ── Video / image card ── */}
        {isVideo && hasImage ? (
          <>
            <Image source={{ uri: imageUri! }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={s.cardDim} />

            {/* Badge TikTok */}
            <View style={[s.badge, s.badgeTikTok]}>
              <Text style={s.badgeText}>TikTok</Text>
            </View>

            {/* Play button */}
            <View style={s.playWrap}>
              <View style={s.playBtn}>
                <Ionicons name="play" size={18} color="white" />
              </View>
            </View>

            {/* Vote indicator */}
            <View style={s.dotWrap}>
              <Animated.View style={[s.dot, { backgroundColor: statusColor, transform: [{ scale: hasVoted ? 1 : pulseAnim }] }]} />
            </View>

            {/* Bottom meta */}
            <View style={s.cardBottomVideo}>
              <Text style={s.titleVideo} numberOfLines={2}>{wish.title}</Text>
              {wish.added_by_name && (
                <View style={s.authorRow}>
                  <View style={[s.avatarXS, { backgroundColor: addedByAvatar?.color ?? '#ccc' }]}>
                    <Image source={{ uri: addedByAvatar?.photo }} style={s.avatarXSImg} />
                  </View>
                  <Text style={s.authorName}>{wish.added_by_name}</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          /* ── Organisation card ── */
          <>
            {/* Badge Organisation */}
            <View style={[s.badge, s.badgeOrg]}>
              <Text style={s.badgeText}>Organisation</Text>
            </View>

            {/* Vote indicator */}
            <View style={s.dotWrap}>
              <Animated.View style={[s.dot, { backgroundColor: statusColor, transform: [{ scale: hasVoted ? 1 : pulseAnim }] }]} />
            </View>

            {/* Title center */}
            <View style={s.orgBody}>
              <Text style={s.titleOrg} numberOfLines={4}>{wish.title}</Text>
            </View>

            {/* Overlapping avatars bottom */}
            <View style={s.orgBottom}>
              {MOCK_AVATARS.slice(0, 3).map((a, i) => (
                <View
                  key={a.id}
                  style={[s.avatarSM, { backgroundColor: a.color, marginLeft: i > 0 ? -9 : 0, zIndex: 10 - i }]}
                >
                  <Image source={{ uri: a.photo }} style={s.avatarSMImg} />
                </View>
              ))}
            </View>
          </>
        )}

        {/* Vote flash overlay */}
        {flash && (
          <View style={[StyleSheet.absoluteFill, s.flashOverlay, { backgroundColor: flash === 'up' ? 'rgba(34,197,94,0.38)' : 'rgba(239,68,68,0.38)' }]}>
            <Text style={{ fontSize: 36 }}>{flash === 'up' ? '❤️' : '👎'}</Text>
          </View>
        )}

        {/* Swipe mode border hint */}
        {swipeOn && (
          <View style={[StyleSheet.absoluteFill, s.swipeBorder]} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ─── Detail bottom sheet ────────────────────────────────────── */
function DetailSheet({
  wish,
  currentUserId,
  onVote,
  onClose,
}: {
  wish:          Wish | null;
  currentUserId: string;
  onVote:        (wishId: string, vote: VoteType) => void;
  onClose:       () => void;
}) {
  if (!wish) return null;
  const insets     = useSafeAreaInsets();
  const catMeta    = wish.category ? CATEGORY_META[wish.category] : null;
  const upVotes    = wish.wish_votes.filter(v => v.vote === 'up').length;
  const downVotes  = wish.wish_votes.filter(v => v.vote === 'down').length;
  const myVote     = wish.wish_votes.find(v => v.user_id === currentUserId)?.vote ?? null;
  const isVideo    = !!wish.link_url;
  const imageUri   = wish.image_url ?? wish.cover_url;
  const statusColor =
    wish.status === 'validated' ? '#22C55E' :
    wish.status === 'debate'    ? '#F97316' : '#9CA3AF';
  const statusLabel =
    wish.status === 'validated' ? 'Validée' :
    wish.status === 'debate'    ? 'En débat' : 'En attente';

  return (
    <Modal visible={!!wish} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[d.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>

        {/* Handle */}
        <View style={d.handle} />

        <ScrollView showsVerticalScrollIndicator={false} bounces>
          {/* Image */}
          {imageUri ? (
            <View style={d.imgWrap}>
              <Image source={{ uri: imageUri }} style={d.img} resizeMode="cover" />
              {isVideo && (
                <TouchableOpacity
                  style={d.openTikTok}
                  onPress={() => wish.link_url && Linking.openURL(wish.link_url)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="logo-tiktok" size={16} color="white" />
                  <Text style={d.openTikTokText}>Ouvrir dans TikTok</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <View style={d.body}>
            {/* Status + category */}
            <View style={d.metaRow}>
              <View style={[d.statusBadge, { backgroundColor: statusColor + '22' }]}>
                <View style={[d.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[d.statusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
              {catMeta && (
                <View style={d.catBadge}>
                  <Text style={d.catBadgeText}>{catMeta.emoji} {catMeta.label}</Text>
                </View>
              )}
            </View>

            {/* Title */}
            <Text style={d.title}>{wish.title}</Text>

            {/* Description */}
            {wish.description ? (
              <Text style={d.desc}>{wish.description}</Text>
            ) : null}

            {/* Address */}
            {wish.address ? (
              <View style={d.infoRow}>
                <Ionicons name="location-outline" size={15} color={Colors.textSecondary} />
                <Text style={d.infoText}>{wish.address}</Text>
              </View>
            ) : null}

            {/* Added by */}
            {wish.added_by_name ? (
              <View style={d.infoRow}>
                <Ionicons name="person-outline" size={15} color={Colors.textSecondary} />
                <Text style={d.infoText}>Ajouté par {wish.added_by_name}</Text>
              </View>
            ) : null}

            {/* Votes */}
            <View style={d.voteSection}>
              <Text style={d.voteSectionTitle}>Votes</Text>
              <View style={d.voteCounts}>
                <View style={d.voteCount}>
                  <Text style={d.voteCountEmoji}>❤️</Text>
                  <Text style={d.voteCountN}>{upVotes}</Text>
                </View>
                <View style={d.voteCount}>
                  <Text style={d.voteCountEmoji}>👎</Text>
                  <Text style={d.voteCountN}>{downVotes}</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Bottom actions */}
        <View style={d.footer}>
          <TouchableOpacity
            style={[d.voteBtn, myVote === 'up' && d.voteBtnLove]}
            onPress={() => onVote(wish.id, 'up')}
            activeOpacity={0.8}
          >
            <Text style={d.voteBtnEmoji}>❤️</Text>
            <Text style={[d.voteBtnLabel, myVote === 'up' && { color: '#FF4B6E' }]}>J'y vais</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[d.voteBtn, myVote === 'down' && d.voteBtnPass]}
            onPress={() => onVote(wish.id, 'down')}
            activeOpacity={0.8}
          >
            <Text style={d.voteBtnEmoji}>👎</Text>
            <Text style={d.voteBtnLabel}>Pas pour moi</Text>
          </TouchableOpacity>

          {wish.status === 'validated' && (
            <TouchableOpacity
              style={d.planBtn}
              onPress={() => Alert.alert('Planning', 'Fonctionnalité à venir !')}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={16} color={Colors.white} />
              <Text style={d.planBtnText}>Au planning</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

/* ─── AddWishModal ───────────────────────────────────────────── */
function AddWishModal({
  visible, tripId, userId, onClose, onAdded,
}: {
  visible: boolean; tripId: string; userId: string;
  onClose: () => void; onAdded: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [linkUrl,         setLinkUrl]         = useState('');
  const [linkPreview,     setLinkPreview]     = useState<LinkPreviewData | null>(null);
  const [isFetchingLink,  setIsFetchingLink]  = useState(false);
  const [title,           setTitle]           = useState('');
  const [category,        setCategory]        = useState<Category | 'autre' | null>(null);
  const [addrQuery,       setAddrQuery]       = useState('');
  const [addrSuggestions, setAddrSuggestions] = useState<PlaceSuggestion[]>([]);
  const [selAddr,         setSelAddr]         = useState<PlaceSuggestion | null>(null);
  const [description,     setDescription]     = useState('');
  const [isSaving,        setIsSaving]        = useState(false);
  const addrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setLinkUrl(''); setLinkPreview(null); setIsFetchingLink(false);
      setTitle(''); setCategory(null);
      setAddrQuery(''); setAddrSuggestions([]); setSelAddr(null);
      setDescription(''); setIsSaving(false);
    }
  }, [visible]);

  const handleLinkChange = useCallback(async (url: string) => {
    setLinkUrl(url);
    setLinkPreview(null);
    if (!url.includes('tiktok.com')) return;
    setIsFetchingLink(true);
    const data = await fetchLinkData(url);
    setIsFetchingLink(false);
    if (data) { setLinkPreview(data); setTitle(t => t || data.title); }
  }, []);

  const handlePasteClipboard = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text.includes('tiktok.com') || text.includes('instagram.com')) {
        handleLinkChange(text);
      } else {
        Alert.alert('Presse-papier', 'Aucun lien TikTok ou Instagram détecté.');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de lire le presse-papier.');
    }
  }, [handleLinkChange]);

  const handleAddrChange = useCallback((text: string) => {
    setAddrQuery(text); setSelAddr(null);
    if (addrTimer.current) clearTimeout(addrTimer.current);
    addrTimer.current = setTimeout(async () => {
      const results = await fetchPlaces(text);
      setAddrSuggestions(results);
    }, 400);
  }, []);

  const handleSelectAddr = useCallback((place: PlaceSuggestion) => {
    setSelAddr(place); setAddrQuery(place.description); setAddrSuggestions([]);
  }, []);

  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert('Titre requis', 'Donne un titre à ton envie'); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('wishes').insert({
        trip_id: tripId, added_by: userId || null,
        title: title.trim(), description: description.trim() || null,
        category: !category || category === 'autre' ? null : category,
        image_url: linkPreview?.thumbnail ?? null,
        link_url: linkUrl.trim() || null,
        address: selAddr?.description ?? (addrQuery.trim() || null),
        status: 'pending',
      });
      if (error) throw error;
      onAdded(); onClose();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "Impossible d'ajouter l'envie");
    }
    setIsSaving(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[m.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>

          <View style={m.header}>
            <Text style={m.headerTitle}>Nouvelle envie</Text>
            <TouchableOpacity onPress={onClose} style={m.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={m.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Link + clipboard */}
            <View style={m.section}>
              <Text style={m.label}>🔗 Coller un lien TikTok ou Reels</Text>
              <View style={m.linkRow}>
                <TextInput
                  style={[m.input, { flex: 1 }]}
                  placeholder="https://www.tiktok.com/..."
                  placeholderTextColor={Colors.textTertiary}
                  value={linkUrl} onChangeText={handleLinkChange}
                  autoCapitalize="none" autoCorrect={false} keyboardType="url"
                />
                {isFetchingLink && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 8 }} />}
              </View>
              <TouchableOpacity style={m.clipboardBtn} onPress={handlePasteClipboard} activeOpacity={0.75}>
                <Ionicons name="clipboard-outline" size={15} color={Colors.textSecondary} />
                <Text style={m.clipboardText}>Coller depuis le presse-papier</Text>
              </TouchableOpacity>
              {linkPreview && (
                <View style={m.previewCard}>
                  {linkPreview.thumbnail && (
                    <Image source={{ uri: linkPreview.thumbnail }} style={m.previewThumb} resizeMode="cover" />
                  )}
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={m.previewTitle} numberOfLines={2}>{linkPreview.title}</Text>
                    {linkPreview.author && <Text style={m.previewAuthor}>@{linkPreview.author}</Text>}
                    <View style={m.previewBadge}><Text style={m.previewBadgeText}>🎵 TikTok</Text></View>
                  </View>
                </View>
              )}
            </View>

            {/* Title */}
            <View style={m.section}>
              <Text style={m.label}>Titre *</Text>
              <TextInput style={m.input} placeholder="Ex: Fontaine de Trevi" placeholderTextColor={Colors.textTertiary} value={title} onChangeText={setTitle} />
            </View>

            {/* Category */}
            <View style={m.section}>
              <Text style={m.label}>Catégorie</Text>
              <View style={m.catGrid}>
                {ADD_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[m.catBtn, category === cat.key && m.catBtnActive]}
                    onPress={() => setCategory(cat.key as Category | 'autre')}
                    activeOpacity={0.75}
                  >
                    <Text style={m.catEmoji}>{cat.emoji}</Text>
                    <Text style={[m.catLabel, category === cat.key && m.catLabelActive]}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Address */}
            <View style={m.section}>
              <Text style={m.label}>📍 Adresse / Lieu</Text>
              <TextInput style={m.input} placeholder="Rechercher un lieu..." placeholderTextColor={Colors.textTertiary} value={addrQuery} onChangeText={handleAddrChange} autoCorrect={false} />
              {addrSuggestions.length > 0 && (
                <View style={m.suggestBox}>
                  {addrSuggestions.map((sug, i) => (
                    <TouchableOpacity
                      key={sug.place_id}
                      style={[m.suggestItem, i < addrSuggestions.length - 1 && m.suggestBorder]}
                      onPress={() => handleSelectAddr(sug)} activeOpacity={0.7}
                    >
                      <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                      <Text style={m.suggestText} numberOfLines={1}>{sug.description}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Description */}
            <View style={m.section}>
              <Text style={m.label}>Note (optionnelle)</Text>
              <TextInput
                style={[m.input, m.inputMultiline]}
                placeholder="Ajoute une note..." placeholderTextColor={Colors.textTertiary}
                value={description} onChangeText={setDescription}
                multiline numberOfLines={3} textAlignVertical="top"
              />
            </View>
          </ScrollView>

          <View style={m.footer}>
            <TouchableOpacity style={[m.submitBtn, isSaving && { opacity: 0.6 }]} onPress={handleSubmit} disabled={isSaving} activeOpacity={0.85}>
              {isSaving
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={m.submitBtnText}>Ajouter l'envie</Text>}
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─── Écran principal ────────────────────────────────────────── */
export default function EnviesScreen() {
  const { id: tripId }  = useLocalSearchParams<{ id: string }>();
  const insets          = useSafeAreaInsets();
  const { session }     = useAuth();
  const currentUserId   = session?.user?.id ?? '';

  const [wishes,       setWishes]       = useState<Wish[]>(MOCK_WISHES);
  const [loading,      setLoading]      = useState(false);
  const [catFilter,    setCatFilter]    = useState<CatFilter>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [detailWish,   setDetailWish]   = useState<Wish | null>(null);

  /* ── Fetch Supabase ── */
  const fetchWishes = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('wishes').select('*, wish_votes(*)')
        .eq('trip_id', tripId).order('created_at', { ascending: false });
      if (!error && data && data.length > 0) setWishes(data as Wish[]);
    } catch {}
    setLoading(false);
  }, [tripId]);

  useEffect(() => { fetchWishes(); }, [fetchWishes]);

  /* ── Dynamic category chips ── */
  const catChips = useMemo(() => {
    const catSet = new Set<Category>();
    wishes.forEach(w => { if (w.category && w.status !== 'archived') catSet.add(w.category); });
    return Array.from(catSet).map(cat => ({ key: cat, label: CATEGORY_META[cat].label }));
  }, [wishes]);

  const activeWishes = useMemo(() => wishes.filter(w => w.status !== 'archived'), [wishes]);

  /* ── Filtered + masonry ── */
  const filtered = useMemo(() => {
    if (catFilter === 'all') return activeWishes;
    return activeWishes.filter(w => w.category === catFilter);
  }, [activeWishes, catFilter]);

  const [leftCol, rightCol] = useMemo(() => {
    const left: Wish[] = []; const right: Wish[] = [];
    filtered.forEach((w, i) => { if (i % 2 === 0) left.push(w); else right.push(w); });
    return [left, right];
  }, [filtered]);

  /* ── Unvoted count ── */
  const unvotedCount = useMemo(() =>
    activeWishes.filter(w => !w.wish_votes.some(v => v.user_id === currentUserId)).length,
    [activeWishes, currentUserId]
  );

  /* ── Vote (optimistic + Supabase) ── */
  const handleVote = useCallback((wishId: string, vote: VoteType) => {
    setWishes(prev => prev.map(w => {
      if (w.id !== wishId) return w;
      const existing    = w.wish_votes.find(v => v.user_id === currentUserId);
      const shouldRemove = existing?.vote === vote;
      if (shouldRemove) {
        supabase.from('wish_votes').delete().eq('wish_id', wishId).eq('user_id', currentUserId).then(() => {});
      } else {
        supabase.from('wish_votes').upsert({ wish_id: wishId, user_id: currentUserId, vote }, { onConflict: 'wish_id,user_id' }).then(() => {});
      }
      const newVotes = shouldRemove
        ? w.wish_votes.filter(v => v.user_id !== currentUserId)
        : [...w.wish_votes.filter(v => v.user_id !== currentUserId), { id: `${wishId}-${currentUserId}`, wish_id: wishId, user_id: currentUserId, vote }];
      return { ...w, wish_votes: newVotes };
    }));
  }, [currentUserId]);

  const renderCol = (col: Wish[]) => col.map(w => (
    <WishCard
      key={w.id}
      wish={w}
      currentUserId={currentUserId}
      onVote={handleVote}
      onPress={() => setDetailWish(w)}
    />
  ));

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={st.header}>
        <Text style={st.title}>Vos envies</Text>
        <TouchableOpacity style={st.gearBtn} activeOpacity={0.7}>
          <Ionicons name="settings-outline" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Category filter chips ── */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={st.filtersScroll} contentContainerStyle={st.filtersContent}
      >
        <TouchableOpacity
          style={[st.chip, catFilter === 'all' && st.chipActive]}
          onPress={() => setCatFilter('all')} activeOpacity={0.8}
        >
          <Text style={[st.chipText, catFilter === 'all' && st.chipTextActive]}>
            Toutes ({activeWishes.length})
          </Text>
        </TouchableOpacity>
        {catChips.map(c => (
          <TouchableOpacity
            key={c.key}
            style={[st.chip, catFilter === c.key && st.chipActive]}
            onPress={() => setCatFilter(c.key)} activeOpacity={0.8}
          >
            <Text style={[st.chipText, catFilter === c.key && st.chipTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Vote banner ── */}
      {unvotedCount > 0 && (
        <TouchableOpacity
          style={st.voteBanner}
          onPress={() => setCatFilter('all')}
          activeOpacity={0.85}
        >
          <Text style={st.voteBannerText}>
            🗳️ {unvotedCount} envie{unvotedCount > 1 ? 's' : ''} attend{unvotedCount > 1 ? 'ent' : ''} ton vote !
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Masonry grid ── */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : filtered.length === 0 ? (
        <View style={st.empty}>
          <Text style={st.emptyIcon}>✨</Text>
          <Text style={st.emptyText}>Aucune envie pour l'instant</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[st.masonryContent, { paddingBottom: Math.max(insets.bottom, 16) + 110 }]}
        >
          <View style={st.masonryRow}>
            <View style={{ width: COL_WIDTH }}>{renderCol(leftCol)}</View>
            <View style={{ width: COL_WIDTH }}>{renderCol(rightCol)}</View>
          </View>
        </ScrollView>
      )}

      {/* ── Bottom nav (dashboard style) ── */}
      <View
        style={[st.bottomNav, { bottom: Math.max(insets.bottom, 10) + 16 }]}
        pointerEvents="box-none"
      >
        <NavButton icon="arrow-back-outline" onPress={() => router.back()} />
        <NavButton icon="add" iconSize={28} onPress={() => setShowAddModal(true)} />
        <NavButton icon="options-outline" />
      </View>

      {/* ── Modals ── */}
      <AddWishModal
        visible={showAddModal}
        tripId={tripId ?? ''}
        userId={currentUserId}
        onClose={() => setShowAddModal(false)}
        onAdded={() => { setShowAddModal(false); fetchWishes(); }}
      />

      <DetailSheet
        wish={detailWish}
        currentUserId={currentUserId}
        onVote={handleVote}
        onClose={() => setDetailWish(null)}
      />

    </View>
  );
}

/* ─── Card styles ────────────────────────────────────────────── */
const s = StyleSheet.create({
  card: {
    width: COL_WIDTH,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    ...Shadows.md,
  },
  cardDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },

  /* Badges */
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeTikTok: { backgroundColor: 'rgba(220,80,60,0.92)' },
  badgeOrg:    { backgroundColor: 'rgba(120,140,90,0.92)' },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* Vote indicator dot */
  dotWrap: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
  },

  /* Play button */
  playWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Video card bottom */
  cardBottomVideo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  titleVideo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 18,
    marginBottom: 4,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  avatarXS: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  avatarXSImg: { width: '100%', height: '100%' },
  authorName: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },

  /* Org card */
  orgBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 44,
    paddingBottom: 8,
    justifyContent: 'flex-start',
  },
  titleOrg: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  orgBottom: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  avatarSM: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  avatarSMImg: { width: '100%', height: '100%' },

  /* Flash & swipe */
  flashOverlay: {
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeBorder: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
    opacity: 0.45,
  },
});

/* ─── Screen styles ──────────────────────────────────────────── */
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  gearBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filtersScroll: { maxHeight: 52, marginBottom: Spacing.sm },
  filtersContent: {
    paddingHorizontal: H_PAD,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radii.full,
    backgroundColor: '#F0F0F0',
  },
  chipActive: { backgroundColor: Colors.primary },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  chipTextActive: { color: Colors.white },

  voteBanner: {
    marginHorizontal: H_PAD,
    marginBottom: Spacing.sm,
    backgroundColor: '#FFFBEB',
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  voteBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },

  masonryContent: {
    paddingHorizontal: H_PAD,
    paddingTop: Spacing.sm,
  },
  masonryRow: {
    flexDirection: 'row',
    gap: COL_GAP,
  },

  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyIcon: { fontSize: 48 },
  emptyText:  { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },

  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
});

/* ─── Detail sheet styles ────────────────────────────────────── */
const d = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  imgWrap: { width: '100%', height: 260 },
  img: { width: '100%', height: '100%' },
  openTikTok: {
    position: 'absolute',
    bottom: 14, right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: Radii.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  openTikTokText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  body: { padding: Spacing.md, gap: Spacing.sm },
  metaRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: Radii.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  catBadge: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  catBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },

  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
  desc:  { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  infoText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },

  voteSection: { marginTop: Spacing.sm, gap: Spacing.sm },
  voteSectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  voteCounts: { flexDirection: 'row', gap: Spacing.lg },
  voteCount: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  voteCountEmoji: { fontSize: 20 },
  voteCountN: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },

  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  voteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  voteBtnLove: { backgroundColor: '#FFF0F3', borderColor: '#FF4B6E' },
  voteBtnPass: { backgroundColor: Colors.surface, borderColor: Colors.textTertiary },
  voteBtnEmoji: { fontSize: 18 },
  voteBtnLabel: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  planBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 13,
    borderRadius: Radii.lg, backgroundColor: Colors.primary,
  },
  planBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },
});

/* ─── Modal styles ───────────────────────────────────────────── */
const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
  closeBtn: {
    width: 36, height: 36, borderRadius: Radii.full,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xl },
  section: { marginBottom: Spacing.lg },
  label: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radii.md,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: 15, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.border,
  },
  inputMultiline: { height: 90, paddingTop: 12 },
  linkRow: { flexDirection: 'row', alignItems: 'center' },
  clipboardBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, paddingVertical: 8,
  },
  clipboardText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  previewCard: {
    flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radii.md,
    padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  previewThumb: { width: 64, height: 64, borderRadius: Radii.sm },
  previewTitle: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, lineHeight: 18 },
  previewAuthor: { fontSize: 12, color: Colors.textSecondary },
  previewBadge: {
    alignSelf: 'flex-start', backgroundColor: '#F0F0F0',
    borderRadius: Radii.full, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2,
  },
  previewBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  catBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: Radii.md, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, minWidth: 76, gap: 4,
  },
  catBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catEmoji: { fontSize: 20 },
  catLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  catLabelActive: { color: Colors.white },
  suggestBox: {
    marginTop: 4, backgroundColor: Colors.white, borderRadius: Radii.md,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadows.sm,
  },
  suggestItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  suggestBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  suggestText: { flex: 1, fontSize: 13, color: Colors.textPrimary },
  footer: {
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: Radii.lg,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center', ...Shadows.md,
  },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white, letterSpacing: -0.3 },
});
