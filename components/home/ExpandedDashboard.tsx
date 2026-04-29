import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Pressable,
  Share,
} from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from "react-native-maps";
import * as ImagePicker from 'expo-image-picker';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { ExpandedMapView } from '@/components/map/ExpandedMapView';
import { GlassCard } from '@/components/ui/GlassCard';
import { NavButton } from '@/components/ui/NavButton';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { InviteSheet } from '@/components/invitations/InviteSheet';
import { Trip } from '@/constants/types';
import { useAuth } from '@/contexts/AuthContext';
import { useHomeExpand } from '@/contexts/HomeExpandContext';
import { supabase } from '@/services/supabase';
import { tripEvents } from '@/utils/events';

/* ─── Constants ──────────────────────────────────────────────── */
const ENVIE_IMG =
  'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=400&q=60';
const DOC_ITEMS = ["Passeport", "Billets d'avion", "Réservation"];
const AVATAR_BG = ['#E8C5A5', '#A5B8E0', '#A8D5B5', '#F0B0B0'];

/* ─── Types ──────────────────────────────────────────────────── */
interface PlanActivity {
  id:         string;
  title:      string;
  start_time: string | null;
  end_time:   string | null;
  wish_id:    string | null;
  wish?: { id: string; title: string; image_url?: string | null; category?: string | null } | null;
}
type TripStatus = 'future' | 'ongoing' | 'past';

/* ─── Catégories ─────────────────────────────────────────────── */
const CAT_CFG: Record<string, { emoji: string; color: string }> = {
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
function catCfg(k?: string | null) { return CAT_CFG[k ?? ''] ?? CAT_CFG.autre; }

/* ─── Helpers ongoing ─────────────────────────────────────────── */
const MONTHS_OG = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
const DAYS_OG   = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

function getDayBadge(start: string, end: string): string {
  const s   = new Date(start + 'T00:00:00');
  const e   = new Date(end   + 'T00:00:00');
  const now = new Date();
  const cur   = Math.floor((now.getTime() - s.getTime()) / 86_400_000) + 1;
  const total = Math.floor((e.getTime() - s.getTime()) / 86_400_000) + 1;
  return `Jour ${cur}/${total}`;
}
function fmtDayHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_OG[d.getDay()]} ${d.getDate()} ${MONTHS_OG[d.getMonth()]}`;
}
function fmtT(t: string | null): string {
  if (!t) return '--';
  const [h, m] = t.split(':');
  return `${h}h${m !== '00' ? m : ''}`;
}
function actStatus(s: string | null, e: string | null): 'past' | 'current' | 'upcoming' {
  if (!s || !e) return 'upcoming';
  const now = new Date();
  const nm  = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  const start = sh * 60 + (sm ?? 0), end = eh * 60 + (em ?? 0);
  if (nm >= start && nm < end) return 'current';
  if (nm >= end) return 'past';
  return 'upcoming';
}
function timeUntilStr(startTime: string): string {
  const [h, m] = startTime.split(':').map(Number);
  const now  = new Date();
  const diff = (h * 60 + (m ?? 0)) - (now.getHours() * 60 + now.getMinutes());
  if (diff <= 0) return 'maintenant';
  if (diff < 60) return `dans ${diff} min`;
  const hrs = Math.floor(diff / 60), mins = diff % 60;
  return mins ? `dans ${hrs}h${String(mins).padStart(2, '0')}` : `dans ${hrs}h`;
}

/* ─── Member type for display ────────────────────────────────── */
interface MemberDisplay {
  user_id: string;
  name: string;
  avatar_url?: string;
  role: string;
}

function formatPastDates(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end   + 'T00:00:00');
  const year = e.getFullYear();
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()} → ${e.getDate()} ${MONTHS_OG[e.getMonth()]} ${year}`;
  }
  return `${s.getDate()} ${MONTHS_OG[s.getMonth()]} → ${e.getDate()} ${MONTHS_OG[e.getMonth()]} ${year}`;
}

function formatDateLabel(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const M = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${M[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${M[s.getMonth()]} – ${M[e.getMonth()]} ${e.getFullYear()}`;
}

/** YYYY-MM-DD → JJ/MM/AAAA */
function isoToDisplay(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** JJ/MM/AAAA → YYYY-MM-DD, null si invalide */
function parseDate(s: string): string | null {
  if (!s.trim()) return null;
  const parts = s.trim().split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (y.length !== 4) return null;
  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  if (isNaN(new Date(iso).getTime())) return null;
  return iso;
}

/* ─── ExpandedDashboard ──────────────────────────────────────── */
export interface CardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  trip: Trip;
  cardLayout: CardLayout;
  progress: SharedValue<number>;
}

export function ExpandedDashboard({ trip, cardLayout, progress }: Props) {
  /* ── Statut du voyage ── */
  const tripStatus: TripStatus = (() => {
    const n     = new Date();
    const start = new Date(trip.start_date + 'T00:00:00');
    const end   = new Date(trip.end_date   + 'T23:59:59');
    if (n >= start && n <= end) return 'ongoing';
    if (n > end)                return 'past';
    return 'future';
  })();

  /* ── État ongoing ── */
  const [todayActivities,    setTodayActivities]    = useState<PlanActivity[]>([]);
  const [tomorrowActivities, setTomorrowActivities] = useState<PlanActivity[]>([]);
  const [unplannedCount,     setUnplannedCount]     = useState(0);

  const insets = useSafeAreaInsets();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const { session } = useAuth();

  const mapCardRef = useRef<View>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mapCardLayout, setMapCardLayout] = useState<CardLayout>({ x: 0, y: 0, width: 0, height: 145 });
  const [showSettings,    setShowSettings]    = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [members,      setMembers]      = useState<any[]>([]);
  const [budgetTotal,   setBudgetTotal]   = useState<number | null>(null);
  const [enviesCount,   setEnviesCount]   = useState<number | null>(null);
  const [validatedCount, setValidatedCount] = useState<number | null>(null);

  /* Past dashboard — counts for bento cards */
  const [pastPhotosCount, setPastPhotosCount] = useState(0);
  const [pastPlacesCount, setPastPlacesCount] = useState(0);
  const [pastTotalSpent,  setPastTotalSpent]  = useState(0);
  const [pastPolyline,    setPastPolyline]    = useState<{ latitude: number; longitude: number }[]>([]);

  /* ── Géocodage de la destination ── */
  const [region, setRegion] = useState({
    latitude: 48.8566, longitude: 2.3522,
    latitudeDelta: 0.5, longitudeDelta: 0.5,
  });

  useEffect(() => {
    const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
    if (!key || !trip.destination) return;
    fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trip.destination)}&key=${key}`)
      .then(r => r.json())
      .then(json => {
        if (json.status === 'OK' && json.results.length > 0) {
          const { lat, lng } = json.results[0].geometry.location;
          setRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.5, longitudeDelta: 0.5 });
        }
      })
      .catch(() => {});
  }, [trip.destination]);

  /* ── Fetch real members via profiles table ── */
  useEffect(() => {
    if (!trip.id) return;
    const loadMembers = async () => {
      const { data: membersList } = await supabase
        .from('trip_members')
        .select('user_id')
        .eq('trip_id', trip.id);

      if (membersList) {
        const profiles: any[] = [];
        for (const m of membersList) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', m.user_id)
            .single();
          console.log('PROFILE LOADED:', JSON.stringify(data));
          if (data) profiles.push(data);
        }
        setMembers(profiles);
      }
    };
    loadMembers();
  }, [trip.id]);

  /* ── Fetch budget total ── */
  useEffect(() => {
    if (!trip.id) return;
    supabase.from('expenses').select('amount').eq('trip_id', trip.id)
      .then(({ data }) => {
        if (data) setBudgetTotal(data.reduce((sum, e) => sum + (e.amount ?? 0), 0));
      });
  }, [trip.id]);

  /* ── Fetch envies count ── */
  useEffect(() => {
    if (!trip.id) return;
    supabase.from('wishes').select('status').eq('trip_id', trip.id)
      .then(({ data }) => {
        if (data) {
          const active = data.filter(w => w.status !== 'archived');
          setEnviesCount(active.length);
          setValidatedCount(active.filter(w => w.status === 'validated').length);
        }
      });
  }, [trip.id]);

  /* ── Charger les données "en cours" ── */
  useEffect(() => {
    if (tripStatus !== 'ongoing' || !trip.id) return;
    const today    = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];

    supabase.from('planning_items')
      .select('id, title, start_time, end_time, wish_id, wish:wish_id(id, title, image_url, category)')
      .eq('trip_id', trip.id).eq('day_date', today)
      .order('start_time', { ascending: true })
      .then(({ data }) => setTodayActivities((data ?? []) as unknown as PlanActivity[]));

    supabase.from('planning_items')
      .select('id, title, start_time, end_time, wish_id')
      .eq('trip_id', trip.id).eq('day_date', tomorrow)
      .order('start_time', { ascending: true })
      .then(({ data }) => setTomorrowActivities((data ?? []) as unknown as PlanActivity[]));

    supabase.from('planning_items').select('wish_id').eq('trip_id', trip.id)
      .then(({ data: planned }) => {
        const ids = (planned ?? []).map((p: any) => p.wish_id).filter(Boolean);
        supabase.from('wishes').select('id').eq('trip_id', trip.id).eq('status', 'validated')
          .then(({ data: v }) =>
            setUnplannedCount((v ?? []).filter((w: any) => !ids.includes(w.id)).length),
          );
      });
  }, [tripStatus, trip.id]);

  /* ── Fetch past counts (bento cards) ── */
  useEffect(() => {
    if (tripStatus !== 'past' || !trip.id) return;

    supabase.from('trip_photos').select('id', { count: 'exact', head: true })
      .eq('trip_id', trip.id)
      .then(({ count }) => setPastPhotosCount(count ?? 0));

    supabase.from('wishes').select('id', { count: 'exact', head: true })
      .eq('trip_id', trip.id).eq('type', 'place').eq('status', 'validated')
      .then(({ count }) => setPastPlacesCount(count ?? 0));

    supabase.from('expenses').select('amount').eq('trip_id', trip.id)
      .then(({ data }) => {
        const total = (data ?? []).reduce((s, e) => s + parseFloat(String(e.amount)), 0);
        setPastTotalSpent(total);
      });

    supabase.from('planning_items')
      .select('id, wish:wish_id(latitude, longitude)')
      .eq('trip_id', trip.id)
      .order('day_date', { ascending: true })
      .order('start_time', { ascending: true })
      .then(({ data }) => {
        const coords = (data ?? [])
          .filter((p: any) => p.wish?.latitude && p.wish?.longitude)
          .map((p: any) => ({ latitude: p.wish.latitude, longitude: p.wish.longitude }));
        setPastPolyline(coords);
      });
  }, [tripStatus, trip.id]);

  const sharePastTrip = useCallback(async () => {
    await Share.share({
      message: `🌍 ${trip.name} — ${trip.destination}\n📅 ${formatPastDates(trip.start_date, trip.end_date)}\n\n${pastPhotosCount > 0 ? `📸 ${pastPhotosCount} photos\n` : ''}${pastPlacesCount > 0 ? `📍 ${pastPlacesCount} lieux visités\n` : ''}\nOrganisé avec HAKO ✈️`,
    });
  }, [trip, pastPhotosCount, pastPlacesCount]);

  const isOwner = session?.user?.id === trip.created_by;

  const { triggerCollapse } = useHomeExpand();
  const handleBack = useCallback(() => {
    triggerCollapse.current?.();
  }, [triggerCollapse]);

  const handleMapPress = useCallback(() => {
    mapCardRef.current?.measureInWindow((x, y, width, height) => {
      setMapCardLayout({ x, y, width, height });
      setIsMapExpanded(true);
    });
  }, []);

  /* ── Hero : s'anime depuis la card vers le plein écran ── */
  const heroStyle = useAnimatedStyle(() => {
    'worklet';
    const p = progress.value;
    return {
      left:         interpolate(p, [0, 1], [cardLayout.x, 0]),
      top:          interpolate(p, [0, 1], [cardLayout.y, 0]),
      width:        interpolate(p, [0, 1], [cardLayout.width,  SCREEN_W]),
      height:       interpolate(p, [0, 1], [cardLayout.height, SCREEN_H]),
      borderRadius: interpolate(p, [0, 1], [20, 0]),
    };
  });

  /* ── Header : fade in + slide down ── */
  const headerStyle = useAnimatedStyle(() => {
    'worklet';
    const p = progress.value;
    return {
      opacity:   interpolate(p, [0.55, 0.9], [0, 1], 'clamp'),
      transform: [{ translateY: interpolate(p, [0.55, 0.9], [-14, 0], 'clamp') }],
    };
  });

  /* ── Bento : fade in + slide up ── */
  const bentoStyle = useAnimatedStyle(() => {
    'worklet';
    const p = progress.value;
    return {
      opacity:   interpolate(p, [0.65, 1], [0, 1], 'clamp'),
      transform: [{ translateY: interpolate(p, [0.65, 1], [28, 0], 'clamp') }],
    };
  });

  const dateLabel = formatDateLabel(trip.start_date, trip.end_date);
  const pastDateRange = tripStatus === 'past' ? formatPastDates(trip.start_date, trip.end_date) : '';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {/* ── Hero image (layer bas) : s'étend de la card au plein écran ── */}
      <Animated.View style={[styles.hero, heroStyle]}>
        <Image
          source={trip.cover_url ? { uri: trip.cover_url } : require('@/assets/images/icon.png')}
          style={{ width: SCREEN_W, height: SCREEN_H }}
          resizeMode="cover"
        />
        <View style={styles.bgDim} />
      </Animated.View>

      {/* ── Contenu dashboard (layer haut) ── */}
      <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top }]} pointerEvents="box-none">

        {/* Header */}
        <Animated.View style={[styles.header, headerStyle]}>
          {/* Top badges row */}
          <View style={styles.topBadgesRow}>
            {tripStatus === 'ongoing' ? (
              <View style={[styles.heroBadge, styles.heroBadgeOngoing]}>
                <View style={styles.liveDot} />
                <Text style={styles.heroBadgeText}>En cours</Text>
              </View>
            ) : tripStatus === 'past' ? (
              <View style={[styles.heroBadge, styles.heroBadgePast]}>
                <Text style={[styles.heroBadgeText, { opacity: 0.85 }]}>Terminé ✈️</Text>
              </View>
            ) : (
              <View style={styles.heroBadge}>
                <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={['rgba(255,255,255,0.50)', 'rgba(255,255,255,0.15)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.heroBadgeText}>À venir</Text>
              </View>
            )}
            <View style={{ flex: 1 }} />
            <BlurView intensity={50} tint="dark" style={styles.dateBadge}>
              {tripStatus === 'ongoing' && <View style={styles.liveDot} />}
              <Text style={styles.dateBadgeText}>
                {tripStatus === 'ongoing'
                  ? getDayBadge(trip.start_date, trip.end_date)
                  : dateLabel}
              </Text>
            </BlurView>
          </View>

          <MaskedView
            style={styles.destinationMask}
            maskElement={
              <LinearGradient
                colors={['rgba(255,255,255,1.0)', 'rgba(255,255,255,0.10)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            }
          >
            <Text style={[styles.destText, tripStatus === 'past' && styles.destTextPast]} adjustsFontSizeToFit numberOfLines={2}>
              {trip.name.toUpperCase()}
            </Text>
          </MaskedView>
          {tripStatus === 'past' && (
            <Text style={styles.pastDateLine}>{pastDateRange}</Text>
          )}

          <View style={styles.avatarsRow}>
            {members.map((m, i) => (
              <MemberAvatar key={m.id} member={m} size={40} index={i} />
            ))}
          </View>
        </Animated.View>

        {/* Bento / Ongoing dashboard */}
        <Animated.View style={[{ flex: 1 }, bentoStyle]}>
          {tripStatus === 'ongoing' ? (
            /* ── Dashboard EN COURS ── */
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[og.scroll, { paddingBottom: insets.bottom + 110 }]}
            >

              {/* Section 1 : Aujourd'hui */}
              <View style={og.section}>
                <Text style={og.sectionTitle}>AUJOURD'HUI · {fmtDayHeader(new Date().toISOString().split('T')[0])}</Text>
                {todayActivities.length === 0 ? (
                  <View style={og.emptyCard}>
                    <Text style={og.emptyText}>Aucune activité planifiée aujourd'hui</Text>
                  </View>
                ) : (
                  todayActivities.map((act) => {
                    const status = actStatus(act.start_time, act.end_time);
                    const cfg = catCfg(act.wish?.category);
                    return (
                      <TouchableOpacity
                        key={act.id}
                        style={[og.actCard, status === 'current' && og.actCardCurrent]}
                        onPress={() => router.push(`/trip/${trip.id}/planning`)}
                        activeOpacity={0.8}
                      >
                        <View style={[og.actBorder, { backgroundColor: cfg.color }]} />
                        <View style={og.actThumb}>
                          <Text style={og.actEmoji}>{cfg.emoji}</Text>
                        </View>
                        <View style={og.actInfo}>
                          <Text style={og.actTitle} numberOfLines={1}>{act.title}</Text>
                          <Text style={og.actTime}>
                            {fmtT(act.start_time)}{act.end_time ? ` – ${fmtT(act.end_time)}` : ''}
                          </Text>
                        </View>
                        {status === 'current' && (
                          <View style={og.badge}>
                            <View style={og.badgeDot} />
                            <Text style={og.badgeText}>EN COURS</Text>
                          </View>
                        )}
                        {status === 'upcoming' && act.start_time && (
                          <Text style={og.actUntil}>{timeUntilStr(act.start_time)}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              {/* Section 2 : Accès rapide */}
              <View style={og.section}>
                <Text style={og.sectionTitle}>ACCÈS RAPIDE</Text>
                <View style={og.quickGrid}>
                  <TouchableOpacity style={og.quickBtn} onPress={() => router.push(`/trip/${trip.id}/planning`)} activeOpacity={0.8}>
                    <Ionicons name="calendar-outline" size={22} color="#1A1A1A" />
                    <Text style={og.quickLabel}>Planning</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={og.quickBtn} onPress={() => router.push(`/trip/${trip.id}/documents`)} activeOpacity={0.8}>
                    <Ionicons name="document-outline" size={22} color="#1A1A1A" />
                    <Text style={og.quickLabel}>Documents</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={og.quickBtn} onPress={() => router.push(`/trip/${trip.id}/budget`)} activeOpacity={0.8}>
                    <Ionicons name="wallet-outline" size={22} color="#1A1A1A" />
                    <Text style={og.quickLabel}>Budget</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={og.quickBtn} onPress={() => router.push(`/trip/${trip.id}/envies`)} activeOpacity={0.8}>
                    <Ionicons name="heart-outline" size={22} color="#1A1A1A" />
                    <Text style={og.quickLabel}>Envies</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Section 3 : Demain */}
              {tomorrowActivities.length > 0 && (
                <View style={og.section}>
                  <Text style={og.sectionTitle}>DEMAIN</Text>
                  {tomorrowActivities.slice(0, 3).map((act) => {
                    const cfg = catCfg(act.wish?.category);
                    return (
                      <View key={act.id} style={og.tomorrowRow}>
                        <Text style={og.tomorrowEmoji}>{cfg.emoji}</Text>
                        <Text style={og.tomorrowTitle} numberOfLines={1}>{act.title}</Text>
                        <Text style={og.tomorrowTime}>{fmtT(act.start_time)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Section 4 : Envies non planifiées */}
              {unplannedCount > 0 && (
                <TouchableOpacity
                  style={og.unplannedBanner}
                  onPress={() => router.push(`/trip/${trip.id}/envies`)}
                  activeOpacity={0.8}
                >
                  <Text style={og.unplannedEmoji}>✨</Text>
                  <Text style={og.unplannedText}>
                    {unplannedCount} envie{unplannedCount > 1 ? 's' : ''} en attente de planification
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                </TouchableOpacity>
              )}
            </ScrollView>
          ) : tripStatus === 'past' ? (
            /* ── Dashboard PASSÉ — bento grid ── */
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
            >
              {/* Row 1 : Photos + Avis */}
              <View style={styles.row}>
                <GlassCard flex={1} minHeight={140} onPress={() => router.push(`/trip/${trip.id}/past-photos`)}>
                  <Text style={styles.cardTitle}>📸 PHOTOS</Text>
                  {pastPhotosCount > 0 ? (
                    <Text style={styles.enviesCount}>
                      {pastPhotosCount} photo{pastPhotosCount > 1 ? 's' : ''}
                    </Text>
                  ) : (
                    <Text style={styles.enviesEmpty}>Ajoute tes souvenirs</Text>
                  )}
                </GlassCard>

                <GlassCard flex={1} minHeight={140} onPress={() => router.push(`/trip/${trip.id}/past-avis`)}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>⭐ AVIS</Text>
                    <Ionicons name="star-outline" size={15} color="rgba(255,255,255,0.7)" />
                  </View>
                  <Text style={styles.planningInfo}>
                    {pastPlacesCount > 0
                      ? `${pastPlacesCount} lieu${pastPlacesCount > 1 ? 'x' : ''} à noter`
                      : 'Aucun lieu validé'}
                  </Text>
                </GlassCard>
              </View>

              {/* Row 2 : Parcours */}
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
                    {pastPolyline.length > 0
                      ? pastPolyline.map((c, i) => <Marker key={i} coordinate={c} />)
                      : <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }} />
                    }
                    {pastPolyline.length > 1 && (
                      <Polyline coordinates={pastPolyline} strokeColor="rgba(255,255,255,0.9)" strokeWidth={2.5} />
                    )}
                  </MapView>
                  <View style={styles.mapLabelWrap}>
                    <Ionicons name="map-outline" size={12} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.mapLabel}>
                      {pastPolyline.length > 1 ? 'Notre parcours' : trip.destination}
                    </Text>
                  </View>
                </GlassCard>
              </View>

              {/* Row 3 : Partager + Bilan */}
              <View style={styles.row}>
                <GlassCard flex={1} minHeight={115} onPress={sharePastTrip}>
                  <Text style={styles.cardTitle}>🔗 PARTAGER</Text>
                  <View style={styles.addCircle}>
                    <Ionicons name="share-social-outline" size={20} color="#fff" />
                  </View>
                  <Text style={styles.budgetSub}>Partage ton voyage</Text>
                </GlassCard>

                <GlassCard flex={1} minHeight={115} onPress={() => router.push(`/trip/${trip.id}/budget`)}>
                  <Text style={styles.cardTitle}>💰 BILAN</Text>
                  {pastTotalSpent > 0 ? (
                    <>
                      <Text style={styles.budgetAmount}>
                        {Math.round(pastTotalSpent).toLocaleString('fr-FR')} €
                      </Text>
                      <Text style={styles.budgetSub}>dépensés</Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.addCircle}>
                        <Ionicons name="wallet-outline" size={20} color="#fff" />
                      </View>
                      <Text style={styles.budgetSub}>Voir le budget</Text>
                    </>
                  )}
                </GlassCard>
              </View>
            </ScrollView>
          ) : (
            /* ── Dashboard FUTUR ── */
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
            >
              {/* Row 1 : Documents + Planning */}
              <View style={styles.row}>
                <GlassCard flex={1} minHeight={140} onPress={() => router.push(`/trip/${trip.id}/documents`)}>
                  <Text style={styles.cardTitle}>DOCUMENT</Text>
                  <View style={styles.docList}>
                    {DOC_ITEMS.map((item, i) => (
                      <View key={i} style={styles.docRow}>
                        <View style={styles.bullet} />
                        <Text style={styles.docText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </GlassCard>

                <GlassCard flex={1} minHeight={140} onPress={() => router.push(`/trip/${trip.id}/planning`)}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>PLANNING</Text>
                    <Ionicons name="calendar-outline" size={15} color="rgba(255,255,255,0.7)" />
                  </View>
                  <Text style={styles.planningInfo}>{'02/06\nDépart de Lyon'}</Text>
                </GlassCard>
              </View>

              {/* Row 2 : Map */}
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
                    <Text style={styles.mapLabel}>{trip.destination}</Text>
                  </View>
                </GlassCard>
              </View>

              {/* Row 3 : Envies + Budget */}
              <View style={styles.row}>
                <GlassCard
                  flex={1}
                  minHeight={115}
                  backgroundImageUri={ENVIE_IMG}
                  onPress={() => router.push(`/trip/${trip.id}/envies`)}
                >
                  <Text style={styles.cardTitle}>VOS ENVIES</Text>
                  {enviesCount !== null && enviesCount > 0 ? (
                    <Text style={styles.enviesCount}>
                      {enviesCount} envie{enviesCount > 1 ? 's' : ''}
                      {validatedCount !== null && validatedCount > 0
                        ? ` · ${validatedCount} validée${validatedCount > 1 ? 's' : ''}`
                        : ''}
                    </Text>
                  ) : (
                    <Text style={styles.enviesEmpty}>Ajoute ta première envie !</Text>
                  )}
                </GlassCard>

                <GlassCard flex={1} minHeight={115} onPress={() => router.push(`/trip/${trip.id}/budget`)}>
                  <Text style={styles.cardTitle}>BUDGET</Text>
                  {budgetTotal !== null && budgetTotal > 0 ? (
                    <>
                      <Text style={styles.budgetAmount}>
                        {budgetTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                      </Text>
                      <Text style={styles.budgetSub}>dépensés</Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.addCircle}>
                        <Ionicons name="add" size={20} color="#fff" />
                      </View>
                      <Text style={styles.budgetSub}>Ajouter une dépense</Text>
                    </>
                  )}
                </GlassCard>
              </View>
            </ScrollView>
          )}
        </Animated.View>

        {/* ── Bottom nav ── */}
        <Animated.View
          style={[styles.bottomNav, { bottom: Math.max(insets.bottom, 10) + 16 }, bentoStyle]}
          pointerEvents="box-none"
        >
          <NavButton icon="arrow-back-outline" onPress={handleBack} />
          {tripStatus === 'past'
            ? <NavButton icon="camera-outline" iconSize={24} onPress={() => router.push(`/trip/${trip.id}/past-photos`)} />
            : <NavButton icon="add" iconSize={28} onPress={() => setShowInviteSheet(true)} />
          }
          {tripStatus === 'past'
            ? <NavButton icon="share-social-outline" iconSize={22} onPress={sharePastTrip} />
            : <NavButton icon="settings-outline" onPress={() => setShowSettings(true)} />
          }
        </Animated.View>

      </View>

      {isMapExpanded && (
        <ExpandedMapView
          cardLayout={mapCardLayout}
          onClose={() => setIsMapExpanded(false)}
          tripId={trip.id}
          destination={trip.destination}
          region={region}
        />
      )}

      {/* Settings sheet */}
      <TripSettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        trip={trip}
        members={members.map(m => ({ user_id: m.id, name: m.nickname ?? 'Membre', avatar_url: m.avatar_url, role: 'member' }))}
        onInvite={() => { setShowSettings(false); setShowInviteSheet(true); }}
      />

      {/* Invite sheet */}
      <InviteSheet
        visible={showInviteSheet}
        onClose={() => setShowInviteSheet(false)}
        tripId={trip.id}
      />

    </View>
  );
}

/* ─── TripSettingsSheet ──────────────────────────────────────── */
function TripSettingsSheet({
  visible,
  onClose,
  trip,
  members,
  onInvite,
}: {
  visible: boolean;
  onClose: () => void;
  trip: Trip;
  members: MemberDisplay[];
  onInvite: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [name,        setName]        = useState(trip.name);
  const [destination, setDestination] = useState(trip.destination);
  const [startDate,   setStartDate]   = useState(isoToDisplay(trip.start_date));
  const [endDate,     setEndDate]     = useState(isoToDisplay(trip.end_date));
  const [coverUri,    setCoverUri]    = useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const handlePickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorise l'accès à ta galerie.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    const parsedStart = startDate ? parseDate(startDate) : null;
    const parsedEnd   = endDate   ? parseDate(endDate)   : null;

    if (startDate && !parsedStart) {
      Alert.alert('Date invalide', 'Format attendu : JJ/MM/AAAA pour la date de départ.');
      return;
    }
    if (endDate && !parsedEnd) {
      Alert.alert('Date invalide', 'Format attendu : JJ/MM/AAAA pour la date de retour.');
      return;
    }

    try {
      setSaving(true);
      const userId = session!.user.id;

      let coverImageUrl: string | null = trip.cover_url ?? null;
      if (coverUri) {
        const ext      = coverUri.split('.').pop() ?? 'jpg';
        const filePath = `${userId}/${Date.now()}.${ext}`;
        const formData = new FormData();
        formData.append('file', { uri: coverUri, name: `cover.${ext}`, type: `image/${ext}` } as any);
        const { error: uploadError } = await supabase.storage
          .from('covers')
          .upload(filePath, formData, { upsert: true, contentType: `image/${ext}` });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(filePath);
        coverImageUrl = publicUrl;
      }

      const { error } = await supabase
        .from('trips')
        .update({
          name:            name.trim(),
          destination:     destination.trim(),
          start_date:      parsedStart,
          end_date:        parsedEnd,
          cover_image_url: coverImageUrl,
        })
        .eq('id', trip.id);

      if (error) throw error;
      tripEvents.emit();
      onClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erreur lors de la sauvegarde.';
      Alert.alert('Erreur', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer le voyage',
      'Êtes-vous sûr ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            console.log('DELETING TRIP:', trip.id);

            const { error: memberError } = await supabase
              .from('trip_members')
              .delete()
              .eq('trip_id', trip.id);
            console.log('DELETE MEMBERS ERROR:', JSON.stringify(memberError));

            const { error: tripError } = await supabase
              .from('trips')
              .delete()
              .eq('id', trip.id);
            console.log('DELETE TRIP ERROR:', JSON.stringify(tripError));

            tripEvents.emit();
            setDeleting(false);
            onClose();
            setTimeout(() => {
              router.replace('/');
            }, 100);
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={sheet.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[sheet.container, { paddingBottom: insets.bottom + Spacing.md }]}>

          {/* Handle bar */}
          <View style={sheet.handleBar} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sheet.scroll}>

            {/* Header */}
            <View style={sheet.header}>
              <Text style={sheet.title}>Paramètres</Text>
              <TouchableOpacity onPress={onClose} style={sheet.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color="#888" />
              </TouchableOpacity>
            </View>

            {/* ── Section : Modifier ── */}
            <Text style={sheet.sectionLabel}>Modifier le voyage</Text>

            <SheetField label="Nom du voyage" value={name} onChangeText={setName} placeholder="Ex : Road trip Italie" />
            <SheetField label="Destination" value={destination} onChangeText={setDestination} placeholder="Ex : Italie" />
            <View style={sheet.dateRow}>
              <SheetField label="Départ" value={startDate} onChangeText={setStartDate} placeholder="JJ/MM/AAAA" style={{ flex: 1 }} />
              <SheetField label="Retour" value={endDate} onChangeText={setEndDate} placeholder="JJ/MM/AAAA" style={{ flex: 1 }} />
            </View>

            <TouchableOpacity style={sheet.coverBtn} onPress={handlePickCover} activeOpacity={0.8}>
              <Ionicons name="image-outline" size={18} color={Colors.primary} />
              <Text style={sheet.coverBtnText}>
                {coverUri ? 'Photo sélectionnée ✓' : 'Changer la photo de couverture'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[sheet.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={sheet.saveBtnText}>Sauvegarder les modifications</Text>
              }
            </TouchableOpacity>

            {/* ── Section : Membres ── */}
            <Text style={[sheet.sectionLabel, { marginTop: Spacing.lg }]}>Membres</Text>

            {members.length === 0 ? (
              <Text style={sheet.emptyMembers}>Aucun membre pour l'instant.</Text>
            ) : (
              members.map((m) => (
                <View key={m.user_id} style={sheet.memberRow}>
                  <MemberAvatar member={{ avatar_url: m.avatar_url, nickname: m.name }} size={50} index={0} />
                  <View style={sheet.memberInfo}>
                    <Text style={sheet.memberName}>{m.name}</Text>
                    {m.role === 'owner' && (
                      <Text style={sheet.memberRole}>Organisateur</Text>
                    )}
                  </View>
                </View>
              ))
            )}

            <TouchableOpacity style={sheet.inviteBtn} activeOpacity={0.8} onPress={onInvite}>
              <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
              <Text style={sheet.inviteBtnText}>Inviter par email</Text>
            </TouchableOpacity>

            {/* ── Section : Danger ── */}
            <View style={sheet.dangerSection}>
              <TouchableOpacity
                style={[sheet.deleteBtn, deleting && { opacity: 0.6 }]}
                onPress={handleDelete}
                disabled={deleting}
                activeOpacity={0.85}
              >
                {deleting
                  ? <ActivityIndicator color="#E53935" />
                  : (
                    <>
                      <Ionicons name="trash-outline" size={18} color="#E53935" />
                      <Text style={sheet.deleteBtnText}>Supprimer le voyage</Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ─── SheetField ─────────────────────────────────────────────── */
function SheetField({
  label,
  value,
  onChangeText,
  placeholder,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  style?: object;
}) {
  return (
    <View style={[sheet.field, style]}>
      <Text style={sheet.fieldLabel}>{label}</Text>
      <TextInput
        style={sheet.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
      />
    </View>
  );
}

/* ─── Sheet styles ───────────────────────────────────────────── */
const sheet = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: Spacing.sm,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
    marginTop: Spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#888',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: '#1A1A1A',
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: 12,
  },
  coverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: Spacing.md,
  },
  coverBtnText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyMembers: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  memberInfo: {
    flex: 1,
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  memberRole: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    marginTop: 2,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: Spacing.sm,
  },
  inviteBtnText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  dangerSection: {
    marginTop: 32,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(220,38,38,0.08)',
    borderRadius: 14,
    paddingVertical: 17,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.3)',
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
});

/* ─── Ongoing dashboard styles ───────────────────────────────── */
const og = StyleSheet.create({
  scroll: {
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 20,
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    padding: 16,
    gap: 10,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  /* Activity card */
  actCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 10,
    gap: 10,
    overflow: 'hidden',
  },
  actCardCurrent: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  actBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 2,
  },
  actThumb: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  actEmoji: { fontSize: 20 },
  actInfo: { flex: 1 },
  actTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  actTime: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  actUntil: { fontSize: 12, fontWeight: '600', color: '#6B7280' },

  /* EN COURS badge */
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#16A34A', letterSpacing: 0.5 },

  /* Empty state */
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },

  /* Quick access grid */
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickBtn: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickLabel: { fontSize: 12, fontWeight: '600', color: '#374151' },

  /* Tomorrow */
  tomorrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  tomorrowEmoji: { fontSize: 16, width: 24, textAlign: 'center' },
  tomorrowTitle: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '500' },
  tomorrowTime: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },

  /* Unplanned banner */
  unplannedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    padding: 14,
    ...Shadows.sm,
  },
  unplannedEmoji: { fontSize: 18 },
  unplannedText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#374151' },
});

/* ─── Main styles ────────────────────────────────────────────── */
const styles = StyleSheet.create({
  /* Hero */
  hero: {
    position: 'absolute',
    overflow: 'hidden',
  },
  bgDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,15,30,0.28)',
  },

  /* Header */
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
  destinationMask: {
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  destText: {
    fontSize: 64,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 2,
  },
  topBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroBadge: {
    overflow: 'hidden',
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,1)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  heroBadgeOngoing: {
    backgroundColor: 'rgba(34,197,94,0.35)',
    borderColor: 'rgba(34,197,94,0.25)',
  },
  heroBadgePast: {
    backgroundColor: 'rgba(110,110,110,0.65)',
    borderColor: 'rgba(110,110,110,0.4)',
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dateBadge: {
    overflow: 'hidden',
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  avatarsRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addMemberBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -9,
  },

  /* Settings gear button */
  settingsGearBtn: {
    width: 40,
    height: 40,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  settingsGearBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.50)',
  },

  /* Scroll / Bento */
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  row: { flexDirection: 'row', gap: Spacing.sm },

  /* Card text styles */
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  /* Documents */
  docList: { gap: 7, marginTop: Spacing.sm },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.65)' },
  docText: { fontSize: 12, color: '#FFFFFF', fontWeight: '500' },

  /* Planning */
  planningInfo: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    lineHeight: 20,
    marginTop: Spacing.sm,
  },

  /* Map */
  mapLabelWrap: { position: 'absolute', bottom: 10, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.28)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999 },
  mapLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },

  /* Envies */
  enviesEmpty: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontStyle: 'italic', marginTop: Spacing.xs },
  enviesCount: { fontSize: 13, color: '#FFFFFF', fontWeight: '600', marginTop: Spacing.xs, lineHeight: 18 },

  /* Budget */
  addCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginVertical: 2 },
  budgetAmount: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 6, letterSpacing: -0.5 },
  budgetSub: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginTop: 2 },

  /* Bottom nav */
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },

  /* Past trip header overrides */
  destTextPast: {
    fontSize: 38,
    letterSpacing: 0.5,
    lineHeight: 44,
  },
  pastDateLine: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
    marginBottom: 4,
  },
});
