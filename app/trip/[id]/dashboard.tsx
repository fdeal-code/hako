import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
  Share,
  TextInput,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { tripEvents } from '@/utils/events';
import { ExpandedMapView, CardLayout } from '@/components/map/ExpandedMapView';
import { GlassCard } from '@/components/ui/GlassCard';
import { NavButton } from '@/components/ui/NavButton';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { InviteSheet } from '@/components/invitations/InviteSheet';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

/* ─── Constants ──────────────────────────────────────────────── */
const DOC_CAT_EMOJI: Record<string, string> = {
  vol: '✈️', hotel: '🏨', restaurant: '🍽️', transport: '🚗',
  passeport: '🛂', assurance: '🛡️', visa: '📋', activite: '🎭', autre: '📄',
};
const AVATAR_COLORS = ['#E8C5A5', '#A5B8E0', '#A8D5B5', '#F0B0B0'];
const MONTHS   = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
const DAYS_FR  = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

const CAT: Record<string, { emoji: string; color: string }> = {
  restaurant: { emoji: '🍽️', color: '#F97316' },
  monument:   { emoji: '🏛️', color: '#8B5CF6' },
  cafe:       { emoji: '☕',  color: '#A16207' },
  hotel:      { emoji: '🏨', color: '#0EA5E9' },
  activity:   { emoji: '🎭', color: '#22C55E' },
  photo_spot: { emoji: '📸', color: '#EC4899' },
  bar:        { emoji: '🍺', color: '#EAB308' },
  transport:  { emoji: '🚗', color: '#3B82F6' },
  autre:      { emoji: '✨', color: '#6B7280' },
};
function catInfo(key?: string | null) { return CAT[key ?? ''] ?? CAT.autre; }

/* ─── Types ──────────────────────────────────────────────────── */
interface PastPhoto {
  id: string;
  photo_url: string;
  uploaded_by: string;
  uploader_name?: string;
}
interface PastReview {
  id: string;
  user_id: string;
  rating: number;
  comment?: string | null;
  created_at?: string;
  reviewer_name?: string;
  reviewer_avatar?: string | null;
}
interface PastPlace {
  id: string;
  title: string;
  image_url?: string | null;
  address?: string | null;
  reviews: PastReview[];
  avgRating: number;
}
interface PastStats {
  wishCount: number;
  days: number;
  totalSpent: number;
}

interface TripData {
  id: string;
  name: string;
  destination: string;
  cover_image_url: string | null;
  start_date: string;
  end_date: string;
  owner_id: string | null;
}
interface MemberDisplay {
  user_id: string;
  name: string;
  avatar_url?: string;
}
interface PlanActivity {
  id: string;
  title: string;
  start_time: string | null;
  end_time:   string | null;
  wish_id:    string | null;
  is_locked?: boolean;
  wish?: { id: string; title: string; image_url?: string | null; category?: string | null } | null;
}
type TripStatus = 'future' | 'ongoing' | 'past';

/* ─── Helpers ─────────────────────────────────────────────────── */
function formatDateBadge(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end   + 'T00:00:00');
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${MONTHS[s.getMonth()]} – ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
}

function getDayBadge(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end   + 'T00:00:00');
  const now = new Date();
  const current = Math.floor((now.getTime() - s.getTime()) / 86_400_000) + 1;
  const total   = Math.floor((e.getTime() - s.getTime()) / 86_400_000) + 1;
  return `Jour ${current}/${total}`;
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function formatPastDates(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end   + 'T00:00:00');
  const year = e.getFullYear();
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()} → ${e.getDate()} ${MONTHS[e.getMonth()]} ${year}`;
  }
  return `${s.getDate()} ${MONTHS[s.getMonth()]} → ${e.getDate()} ${MONTHS[e.getMonth()]} ${year}`;
}

function fmtTime(t: string | null): string {
  if (!t) return '--:--';
  const [h, m] = t.split(':');
  return `${h}h${m !== '00' ? m : ''}`;
}

type ActivityStatus = 'past' | 'current' | 'upcoming';
function getActivityStatus(startTime: string | null, endTime: string | null): ActivityStatus {
  if (!startTime || !endTime) return 'upcoming';
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMins = sh * 60 + (sm ?? 0);
  const endMins   = eh * 60 + (em ?? 0);
  if (nowMins >= startMins && nowMins < endMins) return 'current';
  if (nowMins >= endMins) return 'past';
  return 'upcoming';
}

function timeUntil(startTime: string): string {
  const [h, m] = startTime.split(':').map(Number);
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const diff = (h * 60 + (m ?? 0)) - nowMins;
  if (diff <= 0) return 'maintenant';
  if (diff < 60) return `dans ${diff} min`;
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  return mins ? `dans ${hrs}h${String(mins).padStart(2, '0')}` : `dans ${hrs}h`;
}

/* ─── Main screen ─────────────────────────────────────────────── */
export default function DashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();
  const { session } = useAuth();

  const currentUserId = session?.user?.id ?? '';

  const mapCardRef = useRef<View>(null);
  const [isMapExpanded,  setIsMapExpanded]  = useState(false);
  const [mapCardLayout,  setMapCardLayout]  = useState<CardLayout>({ x: 0, y: 0, width: 0, height: 145 });

  /* Trip & members */
  const [trip,    setTrip]    = useState<TripData | null>(null);
  const [members, setMembers] = useState<MemberDisplay[]>([]);
  const [isOwner, setIsOwner] = useState(false);

  /* Sheets */
  const [showInviteSheet,   setShowInviteSheet]   = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);

  /* Future dashboard data */
  const [recentDocs, setRecentDocs] = useState<{ id: string; title: string; category: string }[]>([]);
  const [docCount,   setDocCount]   = useState(0);
  const [region, setRegion] = useState({
    latitude: 48.8566, longitude: 2.3522,
    latitudeDelta: 0.5, longitudeDelta: 0.5,
  });

  /* Ongoing dashboard data */
  const [todayActivities,    setTodayActivities]    = useState<PlanActivity[]>([]);
  const [tomorrowActivities, setTomorrowActivities] = useState<PlanActivity[]>([]);
  const [unplannedCount,     setUnplannedCount]     = useState(0);

  /* Past dashboard data */
  const [pastStats,       setPastStats]       = useState<PastStats>({ wishCount: 0, days: 0, totalSpent: 0 });
  const [pastPhotos,      setPastPhotos]      = useState<PastPhoto[]>([]);
  const [pastPlaces,      setPastPlaces]      = useState<PastPlace[]>([]);
  const [pastPolyline,    setPastPolyline]    = useState<{ latitude: number; longitude: number }[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [reviewTarget,    setReviewTarget]    = useState<PastPlace | null>(null);
  const [photoViewer,     setPhotoViewer]     = useState<PastPhoto | null>(null);

  /* ── Trip status ── */
  const tripStatus = useMemo<TripStatus>(() => {
    if (!trip) return 'future';
    const now       = new Date();
    const startDate = new Date(trip.start_date + 'T00:00:00');
    const endDate   = new Date(trip.end_date   + 'T23:59:59');

    console.log('=== TRIP STATUS DEBUG ===');
    console.log('NOW:        ', now.toISOString());
    console.log('START:      ', startDate.toISOString());
    console.log('END:        ', endDate.toISOString());
    console.log('start_date raw:', trip.start_date);
    console.log('end_date raw:  ', trip.end_date);
    console.log('NOW >= START:', now >= startDate);
    console.log('NOW <= END:  ', now <= endDate);

    let status: TripStatus = 'future';
    if (now >= startDate && now <= endDate) status = 'ongoing';
    else if (now > endDate) status = 'past';

    console.log('TRIP STATUS:', status);
    return status;
  }, [trip]);

  /* ── Fetch base data ── */
  useEffect(() => {
    if (!id) return;

    supabase
      .from('trips')
      .select('id, name, destination, cover_image_url, start_date, end_date, owner_id')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          setTrip(data);
          setIsOwner(data.owner_id === session?.user?.id);
          const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
          if (key && data.destination) {
            fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(data.destination)}&key=${key}`)
              .then(r => r.json())
              .then(json => {
                if (json.status === 'OK' && json.results?.[0]) {
                  const { lat, lng } = json.results[0].geometry.location;
                  setRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.5, longitudeDelta: 0.5 });
                }
              })
              .catch(() => {});
          }
        }
      });

    supabase
      .from('trip_members')
      .select('user_id, role, profile:profiles(nickname, avatar_url)')
      .eq('trip_id', id)
      .then(({ data }) => {
        setMembers((data ?? []).map((m: any) => ({
          user_id:    m.user_id,
          name:       m.profile?.nickname ?? 'Membre',
          avatar_url: m.profile?.avatar_url ?? undefined,
        })));
      });

    supabase.from('documents').select('id, title, category').eq('trip_id', id)
      .order('created_at', { ascending: false }).limit(3)
      .then(({ data }) => setRecentDocs(data ?? []));
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('trip_id', id)
      .then(({ count }) => setDocCount(count ?? 0));

  }, [id, session?.user?.id]);

  /* ── Fetch ongoing data ── */
  useEffect(() => {
    if (tripStatus !== 'ongoing' || !id) return;

    const today    = new Date().toISOString().split('T')[0];
    const tomorrowD = new Date(Date.now() + 86_400_000);
    const tomorrow = tomorrowD.toISOString().split('T')[0];

    // Today's activities
    supabase
      .from('planning_items')
      .select('id, title, start_time, end_time, wish_id, is_locked, wish:wish_id(id, title, image_url, category)')
      .eq('trip_id', id)
      .eq('day_date', today)
      .order('start_time', { ascending: true })
      .then(({ data }) => setTodayActivities((data ?? []) as unknown as PlanActivity[]));

    // Tomorrow's activities
    supabase
      .from('planning_items')
      .select('id, title, start_time, end_time, wish_id')
      .eq('trip_id', id)
      .eq('day_date', tomorrow)
      .order('start_time', { ascending: true })
      .then(({ data }) => setTomorrowActivities((data ?? []) as PlanActivity[]));

    // Unplanned validated wishes
    supabase.from('planning_items').select('wish_id').eq('trip_id', id)
      .then(({ data: planned }) => {
        const plannedIds = (planned ?? []).map((p: any) => p.wish_id).filter(Boolean);
        supabase.from('wishes').select('id').eq('trip_id', id).eq('status', 'validated')
          .then(({ data: validated }) => {
            const count = (validated ?? []).filter((w: any) => !plannedIds.includes(w.id)).length;
            setUnplannedCount(count);
          });
      });

  }, [tripStatus, id]);

  /* ── Fetch past data ── */
  useEffect(() => {
    if (tripStatus !== 'past' || !id || !trip) return;

    const days = Math.ceil(
      (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86_400_000,
    ) + 1;

    supabase.from('wishes').select('*', { count: 'exact', head: true })
      .eq('trip_id', id).eq('status', 'validated')
      .then(({ count }) => {
        supabase.from('expenses').select('amount').eq('trip_id', id)
          .then(({ data: exps }) => {
            const totalSpent = (exps ?? []).reduce((s, e) => s + parseFloat(String(e.amount)), 0);
            setPastStats({ wishCount: count ?? 0, days, totalSpent });
          });
      });

    supabase.from('trip_photos').select('id, photo_url, uploaded_by')
      .eq('trip_id', id).order('created_at', { ascending: false })
      .then(async ({ data }) => {
        const photos = await Promise.all((data ?? []).map(async p => {
          const { data: prof } = await supabase.from('profiles').select('nickname').eq('id', p.uploaded_by).single();
          return { ...p, uploader_name: prof?.nickname ?? 'Membre' } as PastPhoto;
        }));
        setPastPhotos(photos);
      });

    supabase.from('wishes').select('id, title, image_url, address')
      .eq('trip_id', id).eq('type', 'place').eq('status', 'validated')
      .then(async ({ data: places }) => {
        const enriched = await Promise.all((places ?? []).map(async place => {
          const { data: rvws } = await supabase.from('activity_reviews').select('*').eq('wish_id', place.id);
          const enrichedRvws = await Promise.all((rvws ?? []).map(async r => {
            const { data: prof } = await supabase.from('profiles').select('nickname, avatar_url').eq('id', r.user_id).single();
            return { ...r, reviewer_name: prof?.nickname ?? 'Membre', reviewer_avatar: prof?.avatar_url ?? null } as PastReview;
          }));
          const avgRating = enrichedRvws.length > 0
            ? enrichedRvws.reduce((s, r) => s + r.rating, 0) / enrichedRvws.length
            : 0;
          return { ...place, reviews: enrichedRvws, avgRating } as PastPlace;
        }));
        setPastPlaces(enriched);
      });

    supabase.from('planning_items')
      .select('id, wish:wish_id(latitude, longitude)')
      .eq('trip_id', id)
      .order('day_date', { ascending: true })
      .order('start_time', { ascending: true })
      .then(({ data }) => {
        const coords = (data ?? [])
          .filter((p: any) => p.wish?.latitude && p.wish?.longitude)
          .map((p: any) => ({ latitude: p.wish.latitude, longitude: p.wish.longitude }));
        setPastPolyline(coords);
      });
  }, [tripStatus, id, trip]);

  const reloadPastPhotos = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('trip_photos').select('id, photo_url, uploaded_by')
      .eq('trip_id', id).order('created_at', { ascending: false });
    const photos = await Promise.all((data ?? []).map(async p => {
      const { data: prof } = await supabase.from('profiles').select('nickname').eq('id', p.uploaded_by).single();
      return { ...p, uploader_name: prof?.nickname ?? 'Membre' } as PastPhoto;
    }));
    setPastPhotos(photos);
  }, [id]);

  const uploadPastPhotos = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingPhotos(true);
    try {
      for (const asset of result.assets) {
        const ext = asset.uri.split('.').pop() ?? 'jpg';
        const filePath = `${id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
        const formData = new FormData();
        formData.append('file', { uri: asset.uri, name: `photo.${ext}`, type: `image/${ext}` } as any);
        await supabase.storage.from('photos').upload(filePath, formData, { upsert: true });
        const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(filePath);
        await supabase.from('trip_photos').insert({ trip_id: id, uploaded_by: currentUserId, photo_url: publicUrl });
      }
      await reloadPastPhotos();
    } catch {
      Alert.alert('Erreur', "Impossible d'envoyer les photos.");
    }
    setUploadingPhotos(false);
  }, [id, currentUserId, reloadPastPhotos]);

  const sharePastTrip = useCallback(async () => {
    if (!trip) return;
    const placesList = pastPlaces.map(w => `📍 ${w.title}`).join('\n');
    await Share.share({
      message: `🌍 ${trip.name} — ${trip.destination}\n📅 ${formatPastDates(trip.start_date, trip.end_date)}\n\nLieux visités :\n${placesList || 'Aucun lieu enregistré'}\n\nOrganisé avec HAKO ✈️`,
    });
  }, [trip, pastPlaces]);

  const handleMapPress = useCallback(() => {
    mapCardRef.current?.measureInWindow((x, y, width, height) => {
      setMapCardLayout({ x, y, width, height });
      setIsMapExpanded(true);
    });
  }, []);

  const badgeText = trip
    ? (tripStatus === 'ongoing' ? getDayBadge(trip.start_date, trip.end_date)
      : tripStatus === 'past'   ? 'Terminé ✈️'
      : formatDateBadge(trip.start_date, trip.end_date))
    : '';
  const pastDateRange = trip ? formatPastDates(trip.start_date, trip.end_date) : '';

  const today = new Date().toISOString().split('T')[0];

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ animation: 'fade', headerShown: false }} />

      {/* ── Background photo ── */}
      {trip?.cover_image_url ? (
        <Image source={{ uri: trip.cover_image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0D1B2A' }]} />
      )}
      <View style={styles.bgDim} />

      <View style={[styles.fg, { paddingTop: insets.top }]}>

        {/* ── HEADER (shared) ── */}
        <Animated.View entering={FadeIn.duration(350).delay(180)} style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>

          <Text style={[styles.destText, tripStatus === 'past' && styles.destTextPast]} numberOfLines={2}>
            {tripStatus === 'past' ? (trip?.name ?? '') : (trip?.destination?.toUpperCase() ?? '')}
          </Text>
          {tripStatus === 'past' && trip && (
            <Text style={styles.pastDateLine}>{pastDateRange}</Text>
          )}

          <View style={styles.headerMeta}>
            <View style={styles.dateBadge}>
              <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient
                colors={['rgba(255,255,255,0.50)', 'rgba(255,255,255,0.15)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {tripStatus === 'ongoing' && <View style={styles.liveDot} />}
              <Text style={styles.dateBadgeText}>{badgeText}</Text>
            </View>

            <View style={styles.avatarsRow}>
              {members.slice(0, 3).map((m, i) => (
                <View
                  key={m.user_id}
                  style={[styles.avatar, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length], marginLeft: i > 0 ? -12 : 0, zIndex: 10 - i }]}
                >
                  {m.avatar_url
                    ? <Image source={{ uri: m.avatar_url }} style={styles.avatarImg} />
                    : <Text style={styles.avatarInitial}>{m.name[0]?.toUpperCase() ?? '?'}</Text>
                  }
                </View>
              ))}
              {isOwner && (
                <TouchableOpacity style={styles.addMemberBtn} activeOpacity={0.8} onPress={() => setShowInviteSheet(true)}>
                  <Ionicons name="add" size={18} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>

        {/* ── BODY ── */}
        <Animated.View entering={FadeInUp.duration(500).delay(300)} style={{ flex: 1 }}>

          {/* ─── FUTURE dashboard ─── */}
          {tripStatus === 'future' && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
            >
              <View style={styles.row}>
                <GlassCard flex={1} minHeight={140} onPress={() => router.push(`/trip/${id}/documents`)}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>DOCUMENTS</Text>
                    <Text style={styles.cardCount}>{docCount}</Text>
                  </View>
                  {recentDocs.length === 0 ? (
                    <Text style={styles.docEmpty}>Aucun document</Text>
                  ) : (
                    <View style={styles.docList}>
                      {recentDocs.map(doc => (
                        <View key={doc.id} style={styles.docRow}>
                          <Text style={styles.docEmoji}>{DOC_CAT_EMOJI[doc.category] ?? '📄'}</Text>
                          <Text style={styles.docText} numberOfLines={1}>{doc.title}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </GlassCard>

                <GlassCard flex={1} minHeight={140} onPress={() => router.push(`/trip/${id}/planning`)}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>PLANNING</Text>
                    <Ionicons name="calendar-outline" size={15} color="rgba(255,255,255,0.7)" />
                  </View>
                  <Text style={styles.planningInfo}>Voir le planning</Text>
                </GlassCard>
              </View>

              <View ref={mapCardRef} collapsable={false}>
                <GlassCard height={145} noPadding onPress={handleMapPress}>
                  <MapView
                    style={StyleSheet.absoluteFill}
                    initialRegion={region}
                    region={region}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                  >
                    <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }} />
                  </MapView>
                  <View style={styles.mapLabelWrap}>
                    <Ionicons name="map-outline" size={12} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.mapLabel}>{trip?.destination ?? ''}</Text>
                  </View>
                </GlassCard>
              </View>

              <View style={styles.row}>
                <GlassCard flex={1} minHeight={115} onPress={() => router.push(`/trip/${id}/envies`)}>
                  <Text style={styles.cardTitle}>VOS ENVIES</Text>
                  <View style={styles.addCircle}>
                    <Ionicons name="heart-outline" size={20} color="#fff" />
                  </View>
                </GlassCard>
                <GlassCard flex={1} minHeight={115} onPress={() => router.push(`/trip/${id}/budget`)}>
                  <Text style={styles.cardTitle}>BUDGET</Text>
                  <View style={styles.addCircle}>
                    <Ionicons name="add" size={20} color="#fff" />
                  </View>
                  <Text style={styles.budgetSub}>Créer un tricount</Text>
                </GlassCard>
              </View>
            </ScrollView>
          )}

          {/* ─── PAST dashboard ─── */}
          {tripStatus === 'past' && (
            <ScrollView
              style={pd.scroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[pd.content, { paddingBottom: insets.bottom + 110 }]}
            >
              {/* ── Stats grid ── */}
              <Animated.View entering={FadeInUp.duration(400).delay(0)}>
                <View style={pd.statGrid}>
                  {[
                    { emoji: '📍', value: String(pastStats.wishCount), label: 'lieux visités' },
                    { emoji: '📅', value: String(pastStats.days), label: 'jours' },
                    { emoji: '👥', value: String(members.length), label: 'voyageurs' },
                    { emoji: '💰', value: pastStats.totalSpent > 0 ? Math.round(pastStats.totalSpent) + ' €' : '–', label: 'dépensés' },
                  ].map((stat, i) => (
                    <View key={i} style={pd.statCard}>
                      <Text style={pd.statEmoji}>{stat.emoji}</Text>
                      <Text style={pd.statValue}>{stat.value}</Text>
                      <Text style={pd.statLabel}>{stat.label}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>

              {/* ── Photos ── */}
              <Animated.View entering={FadeInUp.duration(400).delay(80)} style={pd.section}>
                <View style={pd.sectionHead}>
                  <Text style={pd.sectionTitle}>📸 Photos du voyage</Text>
                  <TouchableOpacity style={pd.addBtn} onPress={uploadPastPhotos} disabled={uploadingPhotos} activeOpacity={0.8}>
                    {uploadingPhotos
                      ? <ActivityIndicator size="small" color={Colors.primary} />
                      : <><Ionicons name="add" size={16} color={Colors.primary} /><Text style={pd.addBtnTxt}>Ajouter</Text></>
                    }
                  </TouchableOpacity>
                </View>
                {pastPhotos.length === 0 ? (
                  <View style={pd.emptyState}>
                    <Text style={pd.emptyEmoji}>📸</Text>
                    <Text style={pd.emptyText}>Partagez vos souvenirs !</Text>
                  </View>
                ) : (
                  <View style={pd.photoGrid}>
                    {[pastPhotos.filter((_, i) => i % 2 === 0), pastPhotos.filter((_, i) => i % 2 !== 0)].map((col, ci) => (
                      <View key={ci} style={pd.photoCol}>
                        {col.map(photo => (
                          <TouchableOpacity key={photo.id} style={pd.photoItem} onPress={() => setPhotoViewer(photo)} activeOpacity={0.9}>
                            <Image source={{ uri: photo.photo_url }} style={pd.photoImg} resizeMode="cover" />
                            <Text style={pd.photoBy} numberOfLines={1}>par {photo.uploader_name ?? 'Membre'}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}
                  </View>
                )}
              </Animated.View>

              {/* ── Avis ── */}
              {pastPlaces.length > 0 && (
                <Animated.View entering={FadeInUp.duration(400).delay(160)} style={pd.section}>
                  <Text style={pd.sectionTitle}>⭐ Vos avis</Text>
                  {pastPlaces.map(place => (
                    <TouchableOpacity key={place.id} style={pd.reviewRow} onPress={() => setReviewTarget(place)} activeOpacity={0.8}>
                      {place.image_url
                        ? <Image source={{ uri: place.image_url }} style={pd.reviewThumb} />
                        : <View style={[pd.reviewThumb, pd.reviewThumbFallback]}><Text style={{ fontSize: 22 }}>📍</Text></View>
                      }
                      <View style={{ flex: 1 }}>
                        <Text style={pd.reviewTitle} numberOfLines={1}>{place.title}</Text>
                        {place.address && <Text style={pd.reviewAddr} numberOfLines={1}>{place.address}</Text>}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={pd.reviewStars}>{place.avgRating > 0 ? '⭐'.repeat(Math.round(place.avgRating)) : '–'}</Text>
                        <Text style={pd.reviewCount}>{place.reviews.length} avis</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </Animated.View>
              )}

              {/* ── Carte ── */}
              {pastPolyline.length > 0 && (
                <Animated.View entering={FadeInUp.duration(400).delay(240)} style={pd.section}>
                  <View style={pd.sectionHead}>
                    <Text style={pd.sectionTitle}>🗺️ Notre parcours</Text>
                    <TouchableOpacity onPress={handleMapPress} activeOpacity={0.8}>
                      <Text style={pd.addBtnTxt}>Voir en grand</Text>
                    </TouchableOpacity>
                  </View>
                  <View ref={mapCardRef} collapsable={false} style={pd.mapWrap}>
                    <MapView
                      style={StyleSheet.absoluteFill}
                      initialRegion={region}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      rotateEnabled={false}
                      pitchEnabled={false}
                      pointerEvents="none"
                    >
                      {pastPolyline.map((c, i) => (
                        <Marker key={i} coordinate={c} />
                      ))}
                      {pastPolyline.length > 1 && (
                        <Polyline coordinates={pastPolyline} strokeColor={Colors.primary} strokeWidth={2} />
                      )}
                    </MapView>
                  </View>
                </Animated.View>
              )}

              {/* ── Partager ── */}
              <Animated.View entering={FadeInUp.duration(400).delay(320)} style={pd.section}>
                <Text style={pd.sectionTitle}>🔗 Partager</Text>
                <TouchableOpacity style={pd.shareBtn} onPress={sharePastTrip} activeOpacity={0.85}>
                  <Ionicons name="share-social-outline" size={20} color="#fff" />
                  <Text style={pd.shareBtnTxt}>Partager le voyage</Text>
                </TouchableOpacity>
              </Animated.View>

              {/* ── Bilan budget ── */}
              {pastStats.totalSpent > 0 && (
                <Animated.View entering={FadeInUp.duration(400).delay(400)} style={pd.section}>
                  <Text style={pd.sectionTitle}>💰 Bilan</Text>
                  <Text style={pd.bilanAmount}>{pastStats.totalSpent.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</Text>
                  <Text style={pd.bilanSub}>dépensés pour {members.length} voyageur{members.length > 1 ? 's' : ''}</Text>
                  <TouchableOpacity style={pd.bilanBtn} onPress={() => router.push(`/trip/${id}/budget`)} activeOpacity={0.8}>
                    <Text style={pd.bilanBtnTxt}>Voir le détail →</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </ScrollView>
          )}

          {/* ─── ONGOING dashboard ─── */}
          {tripStatus === 'ongoing' && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={od.scroll}
              contentContainerStyle={[od.content, { paddingBottom: insets.bottom + 110 }]}
            >

              {/* ── Section 1 : Aujourd'hui ── */}
              <View style={od.section}>
                <View style={od.sectionHeadRow}>
                  <Text style={od.sectionTitle}>Aujourd'hui</Text>
                  <Text style={od.sectionSub}>{formatDayHeader(today)}</Text>
                </View>

                {todayActivities.length === 0 ? (
                  <View style={od.freeDay}>
                    <Text style={od.freeDayEmoji}>🏖️</Text>
                    <Text style={od.freeDayText}>Journée libre !</Text>
                    <Text style={od.freeDaySub}>Profite et explore à ton rythme</Text>
                  </View>
                ) : (
                  <View style={od.actList}>
                    {(() => {
                      // Find the first upcoming activity index
                      const firstNextIdx = todayActivities.findIndex(
                        a => getActivityStatus(a.start_time, a.end_time) === 'upcoming',
                      );
                      return todayActivities.map((activity, idx) => {
                        const status  = getActivityStatus(activity.start_time, activity.end_time);
                        const isNext  = idx === firstNextIdx;
                        const c       = catInfo(activity.wish?.category);
                        return (
                          <TouchableOpacity
                            key={activity.id}
                            style={[
                              od.actRow,
                              status === 'current' && od.actRowCurrent,
                              status === 'past'    && od.actRowPast,
                            ]}
                            activeOpacity={0.75}
                            onPress={() => router.push(
                              `/trip/${id}/planning?highlightDay=${today}&highlightId=${activity.id}` as any,
                            )}
                          >
                            {/* Time */}
                            <Text style={[od.actTime, status === 'past' && od.actTimePast]}>
                              {fmtTime(activity.start_time)}
                            </Text>

                            {/* Thumbnail */}
                            {activity.wish?.image_url ? (
                              <Image source={{ uri: activity.wish.image_url }} style={od.actThumb} resizeMode="cover" />
                            ) : (
                              <View style={[od.actThumb, od.actThumbFallback, { backgroundColor: c.color + '22' }]}>
                                <Text style={od.actThumbEmoji}>{c.emoji}</Text>
                              </View>
                            )}

                            {/* Text */}
                            <View style={od.actTextWrap}>
                              <Text
                                style={[od.actTitle, status === 'past' && od.actTitlePast]}
                                numberOfLines={1}
                              >
                                {status === 'past' ? '✅ ' : ''}{activity.title}
                              </Text>
                              {status === 'current' && (
                                <Text style={od.badgeCurrent}>🔵 EN COURS</Text>
                              )}
                              {status === 'upcoming' && isNext && activity.start_time && (
                                <Text style={od.badgeNext}>
                                  PROCHAINE — {timeUntil(activity.start_time)}
                                </Text>
                              )}
                            </View>

                            <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
                          </TouchableOpacity>
                        );
                      });
                    })()}
                  </View>
                )}
              </View>

              {/* ── Section 2 : Accès rapide ── */}
              <View style={od.section}>
                <Text style={od.sectionTitle}>Accès rapide</Text>
                <View style={od.quickGrid}>
                  <TouchableOpacity style={od.quickCard} onPress={() => router.push(`/trip/${id}/map`)} activeOpacity={0.8}>
                    <Text style={od.quickEmoji}>📍</Text>
                    <Text style={od.quickLabel}>Carte</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={od.quickCard} onPress={() => router.push(`/trip/${id}/documents`)} activeOpacity={0.8}>
                    <Text style={od.quickEmoji}>📄</Text>
                    <Text style={od.quickLabel}>Documents</Text>
                    {docCount > 0 && <Text style={od.quickBadge}>{docCount}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={od.quickCard} onPress={() => router.push(`/trip/${id}/budget`)} activeOpacity={0.8}>
                    <Text style={od.quickEmoji}>💰</Text>
                    <Text style={od.quickLabel}>Budget</Text>
                  </TouchableOpacity>
                  <View style={[od.quickCard, od.quickCardDisabled]}>
                    <Text style={od.quickEmoji}>📸</Text>
                    <Text style={[od.quickLabel, { color: Colors.textTertiary }]}>Photos</Text>
                    <Text style={od.quickSoon}>Bientôt</Text>
                  </View>
                </View>
              </View>

              {/* ── Section 3 : Demain ── */}
              <View style={od.section}>
                <View style={od.sectionHeadRow}>
                  <Text style={od.sectionTitle}>Demain</Text>
                  <Text style={od.sectionSub}>
                    {formatDayHeader(new Date(Date.now() + 86_400_000).toISOString().split('T')[0])}
                  </Text>
                </View>

                {tomorrowActivities.length === 0 ? (
                  <Text style={od.nothingText}>Rien de planifié pour demain</Text>
                ) : (
                  <View style={od.tomorrowList}>
                    {tomorrowActivities.map(a => (
                      <View key={a.id} style={od.tomorrowRow}>
                        <Text style={od.tomorrowTime}>{fmtTime(a.start_time)}</Text>
                        <View style={od.tomorrowDot} />
                        <Text style={od.tomorrowTitle} numberOfLines={1}>{a.title}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* ── Section 4 : Envies non planifiées ── */}
              {unplannedCount > 0 && (
                <View style={[od.section, od.unplannedSection]}>
                  <Text style={od.unplannedEmoji}>🗳️</Text>
                  <View style={od.unplannedText}>
                    <Text style={od.unplannedTitle}>
                      {unplannedCount} envie{unplannedCount > 1 ? 's' : ''} pas encore planifiée{unplannedCount > 1 ? 's' : ''}
                    </Text>
                    <Text style={od.unplannedSub}>Tu as encore des idées à caser dans le planning</Text>
                  </View>
                  <TouchableOpacity
                    style={od.unplannedBtn}
                    onPress={() => router.push(`/trip/${id}/envies`)}
                    activeOpacity={0.8}
                  >
                    <Text style={od.unplannedBtnTxt}>Voir</Text>
                  </TouchableOpacity>
                </View>
              )}

            </ScrollView>
          )}

        </Animated.View>
      </View>

      {/* ── BOTTOM NAV ── */}
      <View
        style={[styles.bottomNav, { bottom: Math.max(insets.bottom, 10) + 16 }]}
        pointerEvents="box-none"
      >
        <NavButton icon="arrow-back-outline" onPress={() => router.back()} />
        {tripStatus === 'past'
          ? <NavButton icon="camera-outline" iconSize={24} onPress={uploadPastPhotos} />
          : <NavButton icon="add" iconSize={28} onPress={() => setShowInviteSheet(true)} />
        }
        {tripStatus === 'past'
          ? <NavButton icon="share-social-outline" iconSize={22} onPress={sharePastTrip} />
          : <NavButton icon="settings-outline" onPress={() => setShowSettingsSheet(true)} />
        }
      </View>

      {isMapExpanded && (
        <ExpandedMapView
          cardLayout={mapCardLayout}
          onClose={() => setIsMapExpanded(false)}
          tripId={id}
          destination={trip?.destination}
          region={region}
        />
      )}

      <InviteSheet visible={showInviteSheet} onClose={() => setShowInviteSheet(false)} tripId={id ?? ''} />

      {reviewTarget && (
        <ReviewDetailModal
          place={reviewTarget}
          members={members}
          currentUserId={currentUserId}
          onClose={() => setReviewTarget(null)}
          onReviewSaved={(updatedPlace) => {
            setPastPlaces(prev => prev.map(p => p.id === updatedPlace.id ? updatedPlace : p));
            setReviewTarget(updatedPlace);
          }}
        />
      )}
      {photoViewer && (
        <PhotoViewerModal photo={photoViewer} onClose={() => setPhotoViewer(null)} />
      )}

      <DashboardSettingsSheet
        visible={showSettingsSheet}
        onClose={() => setShowSettingsSheet(false)}
        tripId={id ?? ''}
        tripName={trip?.name ?? ''}
        members={members}
        isOwner={isOwner}
        onInvite={() => { setShowSettingsSheet(false); setShowInviteSheet(true); }}
      />
    </View>
  );
}

/* ─── DashboardSettingsSheet ─────────────────────────────────── */
function DashboardSettingsSheet({
  visible, onClose, tripId, tripName, members, isOwner, onInvite,
}: {
  visible: boolean; onClose: () => void; tripId: string; tripName: string;
  members: MemberDisplay[]; isOwner: boolean; onInvite: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = () => {
    Alert.alert('Supprimer le voyage', 'Êtes-vous sûr ? Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          await supabase.from('trip_members').delete().eq('trip_id', tripId);
          await supabase.from('trips').delete().eq('id', tripId);
          tripEvents.emit();
          setDeleting(false);
          onClose();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ss.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={ss.container}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <View style={ss.handleBar} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.scroll}>
            <View style={ss.header}>
              <Text style={ss.title}>Paramètres</Text>
              <TouchableOpacity onPress={onClose} style={ss.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={ss.sectionLabel}>Membres ({members.length})</Text>
            {members.length === 0 ? (
              <Text style={ss.empty}>Aucun membre pour l'instant.</Text>
            ) : (
              members.map((m, i) => (
                <View key={m.user_id} style={ss.memberRow}>
                  <View style={[ss.avatar, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }]}>
                    {m.avatar_url
                      ? <Image source={{ uri: m.avatar_url }} style={{ width: '100%', height: '100%' }} />
                      : <Text style={ss.avatarInitial}>{m.name[0]?.toUpperCase() ?? '?'}</Text>
                    }
                  </View>
                  <Text style={ss.memberName}>{m.name}</Text>
                </View>
              ))
            )}
            {isOwner && (
              <TouchableOpacity style={ss.inviteBtn} onPress={onInvite} activeOpacity={0.8}>
                <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
                <Text style={ss.inviteBtnText}>Inviter par email</Text>
              </TouchableOpacity>
            )}
            {isOwner && (
              <View style={ss.danger}>
                <TouchableOpacity
                  style={[ss.deleteBtn, deleting && { opacity: 0.6 }]}
                  onPress={handleDelete}
                  disabled={deleting}
                  activeOpacity={0.85}
                >
                  {deleting
                    ? <ActivityIndicator color="#E53935" />
                    : <>
                        <Ionicons name="trash-outline" size={18} color="#E53935" />
                        <Text style={ss.deleteBtnText}>Supprimer le voyage</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Settings sheet styles ──────────────────────────────────── */
const ss = StyleSheet.create({
  backdrop:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  container:    { borderTopLeftRadius: Radii.xl, borderTopRightRadius: Radii.xl, overflow: 'hidden', maxHeight: '75%' },
  handleBar:    { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.sm, marginBottom: Spacing.sm },
  scroll:       { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  title:        { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  closeBtn:     { padding: Spacing.xs },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  empty:        { fontSize: 13, color: Colors.textTertiary, fontStyle: 'italic', marginBottom: Spacing.sm },
  memberRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  avatar:       { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarInitial:{ fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  memberName:   { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  inviteBtn:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  inviteBtnText:{ fontSize: 14, color: Colors.primary, fontWeight: '500' },
  danger:       { marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  deleteBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: '#FFF0F0', borderRadius: Radii.md, paddingVertical: Spacing.md, borderWidth: 1, borderColor: '#FFD0D0' },
  deleteBtnText:{ fontSize: 15, fontWeight: '700', color: '#E53935' },
});

/* ─── Ongoing dashboard styles (od) ─────────────────────────── */
const od = StyleSheet.create({
  scroll: {
    backgroundColor: Colors.background,
    borderTopLeftRadius:  22,
    borderTopRightRadius: 22,
    marginTop: -10,
  },
  content: {
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  section: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  sectionSub: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },

  /* Free day */
  freeDay: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  freeDayEmoji: { fontSize: 36 },
  freeDayText:  { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  freeDaySub:   { fontSize: 13, color: Colors.textSecondary },

  /* Activity list */
  actList: {
    gap: 2,
  },
  actRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  actRowCurrent: {
    backgroundColor: '#EFF6FF',
  },
  actRowPast: {
    opacity: 0.55,
  },
  actTime: {
    width: 36,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textAlign: 'right',
    flexShrink: 0,
  },
  actTimePast: {
    color: Colors.textTertiary,
  },
  actThumb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    flexShrink: 0,
  },
  actThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actThumbEmoji: {
    fontSize: 16,
  },
  actTextWrap: {
    flex: 1,
    gap: 2,
  },
  actTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  actTitlePast: {
    color: Colors.textSecondary,
  },
  badgeCurrent: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.3,
  },
  badgeNext: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
    letterSpacing: 0.2,
  },

  /* Quick access grid */
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  quickCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
    minHeight: 80,
    justifyContent: 'center',
    ...Shadows.sm,
  },
  quickCardDisabled: {
    opacity: 0.6,
  },
  quickEmoji: {
    fontSize: 26,
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  quickBadge: {
    position: 'absolute',
    top: 8,
    right: 10,
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    backgroundColor: Colors.primary + '18',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  quickSoon: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textTertiary,
  },

  /* Tomorrow */
  nothingText: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  tomorrowList: {
    gap: 10,
    marginTop: 4,
  },
  tomorrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tomorrowTime: {
    width: 36,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  tomorrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  tomorrowTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  /* Unplanned section */
  unplannedSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  unplannedEmoji: {
    fontSize: 28,
    flexShrink: 0,
  },
  unplannedText: {
    flex: 1,
    gap: 2,
  },
  unplannedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  unplannedSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  unplannedBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.full,
    flexShrink: 0,
  },
  unplannedBtnTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});

/* ─── Main styles ────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#0D1B2A' },
  bgDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,15,30,0.25)' },
  fg:    { flex: 1 },

  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xs,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  destText: {
    fontSize: 58, fontWeight: '900',
    color: 'rgba(255,255,255,0.90)',
    letterSpacing: 3, lineHeight: 62,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },
  headerMeta: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: Spacing.sm,
  },
  dateBadge: {
    overflow: 'hidden', borderRadius: Radii.pill,
    paddingHorizontal: Spacing.sm2, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,1)',
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  liveDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  dateBadgeText: {
    color: '#fff', fontSize: 13, fontWeight: '600', letterSpacing: 0.3,
  },
  avatarsRow:    { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 2, borderColor: '#fff',
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  avatarImg:     { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  addMemberBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.surface,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: -12, zIndex: 20,
  },

  scroll: {
    paddingHorizontal: Spacing.md, paddingTop: Spacing.lg, gap: Spacing.sm,
  },
  row: { flexDirection: 'row', gap: Spacing.sm },

  cardTitle:    { fontSize: 12, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardCount:    { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  docList:      { gap: 6, marginTop: Spacing.sm },
  docRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docEmoji:     { fontSize: 12 },
  docEmpty:     { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', marginTop: Spacing.sm },
  docText:      { flex: 1, fontSize: 12, color: '#FFFFFF', fontWeight: '500' },
  planningInfo: { fontSize: 13, color: '#FFFFFF', fontWeight: '600', lineHeight: 20, marginTop: Spacing.sm },
  mapLabelWrap: {
    position: 'absolute', bottom: 10, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.full,
  },
  mapLabel:  { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  addCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginVertical: 2,
  },
  budgetSub: { fontSize: 10, color: '#FFFFFF', textAlign: 'center', fontWeight: '500' },
  bottomNav: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 14,
  },
  destTextPast: { fontSize: 38, letterSpacing: 0.5, lineHeight: 44 },
  pastDateLine: {
    fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.75)',
    marginTop: 4, marginBottom: 4,
  },
});

/* ─── ReviewDetailModal ──────────────────────────────────────── */
function ReviewDetailModal({
  place, members, currentUserId, onClose, onReviewSaved,
}: {
  place: PastPlace;
  members: MemberDisplay[];
  currentUserId: string;
  onClose: () => void;
  onReviewSaved: (updated: PastPlace) => void;
}) {
  const insets = useSafeAreaInsets();
  const [myRating,  setMyRating]  = useState(0);
  const [comment,   setComment]   = useState('');
  const [saving,    setSaving]    = useState(false);

  const existing = place.reviews.find(r => r.user_id === currentUserId);
  useEffect(() => {
    if (existing) { setMyRating(existing.rating); setComment(existing.comment ?? ''); }
  }, [existing]);

  const avgRating = place.reviews.length > 0
    ? place.reviews.reduce((s, r) => s + r.rating, 0) / place.reviews.length
    : 0;

  const handlePublish = async () => {
    if (myRating === 0) { Alert.alert('Note requise', 'Sélectionne au moins 1 étoile.'); return; }
    setSaving(true);
    try {
      await supabase.from('activity_reviews').upsert({
        wish_id: place.id, user_id: currentUserId, rating: myRating, comment: comment.trim() || null,
      });
      const { data: rvws } = await supabase.from('activity_reviews').select('*').eq('wish_id', place.id);
      const enriched = await Promise.all((rvws ?? []).map(async r => {
        const { data: prof } = await supabase.from('profiles').select('nickname, avatar_url').eq('id', r.user_id).single();
        return { ...r, reviewer_name: prof?.nickname ?? 'Membre', reviewer_avatar: prof?.avatar_url ?? null } as PastReview;
      }));
      const newAvg = enriched.length > 0 ? enriched.reduce((s, r) => s + r.rating, 0) / enriched.length : 0;
      onReviewSaved({ ...place, reviews: enriched, avgRating: newAvg });
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer l'avis.");
    }
    setSaving(false);
  };

  function StarRow({ value, size = 28, onSelect }: { value: number; size?: number; onSelect?: (n: number) => void }) {
    return (
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity key={n} onPress={() => onSelect?.(n)} activeOpacity={0.8} disabled={!onSelect}>
            <Text style={{ fontSize: size }}>{n <= value ? '⭐' : '☆'}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[rm.root, { paddingTop: insets.top }]}>
        <View style={rm.topBar}>
          <TouchableOpacity onPress={onClose} style={rm.backBtn} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={rm.topTitle} numberOfLines={1}>{place.title}</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[rm.scroll, { paddingBottom: insets.bottom + 24 }]}>
          {place.image_url && <Image source={{ uri: place.image_url }} style={rm.heroImg} resizeMode="cover" />}
          <Text style={rm.placeName}>{place.title}</Text>
          {place.address && <Text style={rm.placeAddr}>{place.address}</Text>}
          {avgRating > 0 && (
            <View style={rm.avgRow}>
              <Text style={rm.avgNum}>{avgRating.toFixed(1)} / 5</Text>
              <StarRow value={Math.round(avgRating)} size={20} />
              <Text style={rm.avgCount}>({place.reviews.length} avis)</Text>
            </View>
          )}

          <View style={rm.divider} />
          <Text style={rm.subTitle}>Ton avis</Text>
          <StarRow value={myRating} size={40} onSelect={setMyRating} />
          <TextInput
            style={rm.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Ton avis sur ce lieu..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity
            style={[rm.publishBtn, (saving || myRating === 0) && { opacity: 0.4 }]}
            onPress={handlePublish}
            disabled={saving || myRating === 0}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={rm.publishBtnTxt}>Publier</Text>}
          </TouchableOpacity>

          {place.reviews.length > 0 && (
            <>
              <View style={rm.divider} />
              <Text style={rm.subTitle}>Avis du groupe</Text>
              {place.reviews.length === 0 && <Text style={rm.noReview}>Soyez les premiers à noter !</Text>}
              {place.reviews.map((r, i) => (
                <View key={r.id ?? i} style={rm.reviewItem}>
                  <MemberAvatar
                    member={{ nickname: r.reviewer_name, avatar_url: r.reviewer_avatar }}
                    size={36}
                    index={i}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={rm.reviewerName}>{r.reviewer_name ?? 'Membre'}</Text>
                      <StarRow value={r.rating} size={13} />
                    </View>
                    {r.comment && <Text style={rm.reviewComment}>{r.comment}</Text>}
                    {r.created_at && <Text style={rm.reviewDate}>{new Date(r.created_at).toLocaleDateString('fr-FR')}</Text>}
                  </View>
                </View>
              ))}
            </>
          )}
          {place.reviews.length === 0 && (
            <Text style={rm.noReview}>Soyez les premiers à noter !</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ─── PhotoViewerModal ───────────────────────────────────────── */
function PhotoViewerModal({ photo, onClose }: { photo: PastPhoto; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={pv.root}>
        <TouchableOpacity style={[pv.closeBtn, { top: insets.top + 8 }]} onPress={onClose} activeOpacity={0.8}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={pv.imgWrap}
          maximumZoomScale={4}
          minimumZoomScale={1}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          centerContent
        >
          <Image source={{ uri: photo.photo_url }} style={pv.img} resizeMode="contain" />
        </ScrollView>
        <Text style={[pv.caption, { bottom: insets.bottom + 16 }]}>par {photo.uploader_name ?? 'Membre'}</Text>
      </View>
    </Modal>
  );
}

/* ─── Review modal styles ────────────────────────────────────── */
const rm = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#fff' },
  topBar:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle:{ flex: 1, fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  scroll:  { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  heroImg: { width: '100%', height: 200, borderRadius: Radii.sm, marginBottom: 8 },
  placeName: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5 },
  placeAddr: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  avgRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  avgNum:  { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  avgCount:{ fontSize: 12, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  subTitle:{ fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },
  commentInput: { backgroundColor: Colors.background, borderRadius: Radii.sm, padding: 14, fontSize: 14, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, minHeight: 80, textAlignVertical: 'top', marginTop: 12 },
  publishBtn:   { backgroundColor: Colors.primary, borderRadius: Radii.full, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  publishBtnTxt:{ color: '#fff', fontWeight: '800', fontSize: 15 },
  noReview:     { fontSize: 14, color: Colors.textTertiary, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },
  reviewItem:   { flexDirection: 'row', gap: 12, marginBottom: 14 },
  reviewerName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  reviewComment:{ fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  reviewDate:   { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
});

/* ─── Photo viewer styles ────────────────────────────────────── */
const pv = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#000' },
  closeBtn:{ position: 'absolute', right: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  imgWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '100%' },
  img:     { width: '100%', aspectRatio: 1 },
  caption: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },
});

/* ─── Past dashboard styles ──────────────────────────────────── */
const pd = StyleSheet.create({
  scroll:  { backgroundColor: Colors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, marginTop: -10 },
  content: { paddingTop: Spacing.lg, gap: Spacing.sm },
  section: { marginHorizontal: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radii.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadows.sm },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle:{ fontSize: 18, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4 },
  addBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '10', borderRadius: Radii.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.primary + '28' },
  addBtnTxt:   { fontSize: 13, fontWeight: '700', color: Colors.primary },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: Spacing.md },
  statCard: { width: '47%', backgroundColor: Colors.surface, borderRadius: Radii.sm, padding: Spacing.md, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.border, ...Shadows.sm },
  statEmoji:{ fontSize: 26 },
  statValue:{ fontSize: 22, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5 },
  statLabel:{ fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

  emptyState:{ alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyEmoji:{ fontSize: 36 },
  emptyText: { fontSize: 15, color: Colors.textSecondary },

  photoGrid: { flexDirection: 'row', gap: 8 },
  photoCol:  { flex: 1, gap: 8 },
  photoItem: { borderRadius: Radii.sm, overflow: 'hidden' },
  photoImg:  { width: '100%', aspectRatio: 0.85, borderRadius: Radii.sm },
  photoBy:   { fontSize: 11, color: Colors.textSecondary, marginTop: 4, paddingHorizontal: 2 },

  reviewRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  reviewThumb:       { width: 60, height: 60, borderRadius: 30 },
  reviewThumbFallback:{ backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  reviewTitle:       { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  reviewAddr:        { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  reviewStars:       { fontSize: 12 },
  reviewCount:       { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },

  mapWrap: { height: 200, borderRadius: Radii.sm, overflow: 'hidden', marginTop: 12 },

  shareBtn:    { flexDirection: 'row', gap: 10, backgroundColor: Colors.primary, borderRadius: Radii.full, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  shareBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },

  bilanAmount: { fontSize: 40, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1, textAlign: 'center', marginTop: 8 },
  bilanSub:    { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  bilanBtn:    { marginTop: 14, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radii.full, borderWidth: 1.5, borderColor: Colors.primary },
  bilanBtnTxt: { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
