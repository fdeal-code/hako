/**
 * PlanningDetailScreen — page plein écran détail d'un planning_item
 * Accessible depuis la timeline du planning (tap sur une activité)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

/* ─── Types ──────────────────────────────────────────────────── */
type BudgetLevel  = 'free' | '€' | '€€' | '€€€';
type DurationKey  = '30min' | '1h' | '2h' | 'half-day' | 'day';

interface WishLink {
  url: string;
  thumbnail?: string;
  title?: string;
}

interface WishDetail {
  id:             string;
  trip_id:        string;
  title:          string;
  description?:   string;
  category?:      string;
  cover_url?:     string;
  image_url?:     string;
  link_url?:      string;
  address?:       string;
  budget?:        BudgetLevel;
  duration?:      DurationKey;
  status:         string;
  latitude?:      number;
  longitude?:     number;
  google_rating?: number;
  links?:         WishLink[];
}

interface PlanningItemDetail {
  id:         string;
  trip_id:    string;
  wish_id?:   string | null;
  title:      string;
  day_date:   string;
  start_time?: string | null;
  end_time?:   string | null;
  is_locked?:  boolean;
  notes?:      string | null;
  added_by?:   string | null;
  category?:   string | null;
  wish?:       WishDetail | null;
}

/* ─── Category config ────────────────────────────────────────── */
const CAT: Record<string, { emoji: string; color: string; label: string }> = {
  restaurant: { emoji: '🍽️', color: '#F97316', label: 'Restaurant' },
  monument:   { emoji: '🏛️', color: '#8B5CF6', label: 'Monument'   },
  cafe:       { emoji: '☕',  color: '#A16207', label: 'Café'        },
  hotel:      { emoji: '🏨', color: '#0EA5E9', label: 'Hôtel'       },
  activity:   { emoji: '🎭', color: '#22C55E', label: 'Activité'    },
  photo_spot: { emoji: '📸', color: '#EC4899', label: 'Photo spot'  },
  photo:      { emoji: '📸', color: '#EC4899', label: 'Photo spot'  },
  bar:        { emoji: '🍺', color: '#EAB308', label: 'Bar'         },
  transport:  { emoji: '🚗', color: '#3B82F6', label: 'Transport'   },
  orga:       { emoji: '📋', color: '#6B7280', label: 'Organisation' },
  autre:      { emoji: '✨', color: '#6B7280', label: 'Autre'       },
};
function cat(key?: string | null) { return CAT[key ?? ''] ?? CAT.autre; }

/* ─── Status config ───────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  validated: { label: 'Validée',   color: '#16A34A', bg: '#DCFCE7' },
  pending:   { label: 'En attente', color: '#D97706', bg: '#FEF3C7' },
  debate:    { label: 'En débat',  color: '#DC2626', bg: '#FEE2E2' },
  archived:  { label: 'Archivée', color: '#6B7280', bg: '#F3F4F6' },
};

/* ─── Budget/Duration labels ─────────────────────────────────── */
const BUDGET_LABEL: Record<string, string> = {
  free: 'Gratuit', '€': '€', '€€': '€€', '€€€': '€€€',
};
const DURATION_LABEL: Record<string, string> = {
  '30min': '30 min', '1h': '1h', '2h': '2h', 'half-day': 'Demi-journée', 'day': 'Journée',
};

/* ─── Date helpers ───────────────────────────────────────────── */
const DAYS_FR   = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function formatDayFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':');
  return `${h}h${m && m !== '00' ? m : ''}`;
}

/* ─── Navigation helpers ─────────────────────────────────────── */
function openInMaps(lat: number, lng: number, label: string) {
  const url = Platform.select({
    ios:     `maps:?q=${encodeURIComponent(label)}&ll=${lat},${lng}`,
    android: `geo:${lat},${lng}?q=${encodeURIComponent(label)}`,
  });
  if (url) Linking.openURL(url);
}

function openInGoogleMaps(lat: number, lng: number, label: string) {
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  Linking.openURL(url);
}

/* ─── Time helpers ───────────────────────────────────────────── */
const START_HOUR = 7;
const END_HOUR   = 23;

function stepTime(h: number, m: number, deltaMin: number): [number, number] {
  let total = h * 60 + m + deltaMin;
  const minTotal = START_HOUR * 60;
  const maxTotal = END_HOUR * 60;
  total = Math.max(minTotal, Math.min(maxTotal, total));
  return [Math.floor(total / 60), total % 60];
}

function formatTimePicker(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
}

function calcDuration(sh: number, sm: number, eh: number, em: number): string {
  const total = (eh * 60 + em) - (sh * 60 + sm);
  if (total <= 0) return '';
  const h = Math.floor(total / 60);
  const mn = total % 60;
  if (h === 0) return `${mn}min`;
  if (mn === 0) return `${h}h`;
  return `${h}h${mn}`;
}

/* ─── Component ──────────────────────────────────────────────── */
export default function PlanningDetailScreen() {
  const { id: tripId, itemId } = useLocalSearchParams<{ id: string; itemId: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [item,    setItem]    = useState<PlanningItemDetail | null>(null);
  const [loading, setLoading] = useState(true);

  /* Edit schedule state */
  const [editVisible, setEditVisible] = useState(false);
  const [editStartH,  setEditStartH]  = useState(9);
  const [editStartM,  setEditStartM]  = useState(0);
  const [editEndH,    setEditEndH]    = useState(10);
  const [editEndM,    setEditEndM]    = useState(0);
  const [saving,      setSaving]      = useState(false);

  /* ── Load data ── */
  const loadItem = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('planning_items')
      .select('*, wish:wish_id(*)')
      .eq('id', itemId)
      .single();
    if (data) setItem(data as PlanningItemDetail);
    setLoading(false);
  }, [itemId]);

  useEffect(() => { loadItem(); }, [loadItem]);

  /* ── Init edit time from item ── */
  useEffect(() => {
    if (!item) return;
    if (item.start_time) {
      const parts = item.start_time.split(':');
      setEditStartH(parseInt(parts[0] ?? '9', 10));
      setEditStartM(parseInt(parts[1] ?? '0', 10));
    }
    if (item.end_time) {
      const parts = item.end_time.split(':');
      setEditEndH(parseInt(parts[0] ?? '10', 10));
      setEditEndM(parseInt(parts[1] ?? '0', 10));
    }
  }, [item]);

  /* ── Save schedule ── */
  const saveSchedule = async () => {
    if (!item) return;
    const startTotal = editStartH * 60 + editStartM;
    const endTotal   = editEndH   * 60 + editEndM;
    if (endTotal <= startTotal + 14) {
      Alert.alert('Horaire invalide', 'La durée minimum est de 15 minutes.');
      return;
    }
    const fmt = (h: number, m: number) =>
      `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setSaving(true);
    const { error } = await supabase
      .from('planning_items')
      .update({ start_time: fmt(editStartH, editStartM), end_time: fmt(editEndH, editEndM) })
      .eq('id', item.id);
    setSaving(false);
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      setEditVisible(false);
      loadItem();
    }
  };

  /* ── Remove from planning ── */
  const removeFromPlanning = () => {
    if (!item) return;
    Alert.alert(
      'Retirer du planning',
      `"${item.title}" sera retiré du planning et retournera dans le réservoir d'envies.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('planning_items').delete().eq('id', item.id);
            router.back();
          },
        },
      ],
    );
  };

  /* ── Loading state ── */
  if (loading) {
    return (
      <View style={[s.root, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.textPrimary} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[s.root, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={s.errorTxt}>Activité introuvable.</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnTxt}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const wish        = item.wish;
  const catInfo     = cat(wish?.category ?? item.category);
  const statusMeta  = STATUS_META[wish?.status ?? 'pending'] ?? STATUS_META.pending;
  const imageUri    = wish?.image_url ?? wish?.cover_url ?? null;
  const hasCoords   = !!(wish?.latitude && wish?.longitude);
  const hasLinks    = (wish?.links?.length ?? 0) > 0 || !!wish?.link_url;
  const GRAD_COLORS: readonly [string, string] = [catInfo.color + 'CC', catInfo.color + '66'];

  const scheduleStr = item.start_time && item.end_time
    ? `${fmtTime(item.start_time)} – ${fmtTime(item.end_time)}`
    : null;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero image ── */}
        {imageUri ? (
          <View style={s.heroWrap}>
            <Image source={{ uri: imageUri }} style={s.heroImg} resizeMode="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.35)']}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ) : (
          <LinearGradient colors={GRAD_COLORS} style={s.heroFallback}>
            <Text style={s.heroEmoji}>{catInfo.emoji}</Text>
          </LinearGradient>
        )}

        {/* ── Back button (flottant sur l'image) ── */}
        <TouchableOpacity
          style={[s.backFab, { top: 12 }]}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>

        {/* ── Content ── */}
        <View style={s.content}>

          {/* ── Titre ── */}
          <Text style={s.title}>{item.title}</Text>

          {/* ── Badges ── */}
          <View style={s.badgeRow}>
            <View style={[s.badge, { backgroundColor: catInfo.color + '18' }]}>
              <Text style={[s.badgeTxt, { color: catInfo.color }]}>
                {catInfo.emoji} {catInfo.label}
              </Text>
            </View>
            {wish && (
              <View style={[s.badge, { backgroundColor: statusMeta.bg }]}>
                <Text style={[s.badgeTxt, { color: statusMeta.color }]}>{statusMeta.label}</Text>
              </View>
            )}
            {item.is_locked && (
              <View style={[s.badge, { backgroundColor: '#F0F0F0' }]}>
                <Text style={[s.badgeTxt, { color: '#444' }]}>🔒 Réservation fixe</Text>
              </View>
            )}
          </View>

          {/* ── Horaire ── */}
          <View style={s.scheduleCard}>
            <View style={s.scheduleLeft}>
              <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
              <View>
                {item.day_date && (
                  <Text style={s.scheduleDay}>{formatDayFull(item.day_date)}</Text>
                )}
                {item.start_time && item.end_time && (
                  <Text style={s.scheduleTime}>
                    {fmtTime(item.start_time)} → {fmtTime(item.end_time)}
                    {'  '}
                    <Text style={s.scheduleDuration}>
                      ({calcDuration(
                        parseInt(item.start_time.split(':')[0], 10),
                        parseInt(item.start_time.split(':')[1] ?? '0', 10),
                        parseInt(item.end_time.split(':')[0], 10),
                        parseInt(item.end_time.split(':')[1] ?? '0', 10),
                      )})
                    </Text>
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={s.scheduleEditBtn}
              onPress={() => setEditVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={s.scheduleEditTxt}>Modifier</Text>
            </TouchableOpacity>
          </View>

          {/* ── Adresse ── */}
          {wish?.address && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Adresse</Text>
              <View style={s.infoRow}>
                <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
                <Text style={s.infoTxt}>{wish.address}</Text>
              </View>

              {/* Mini carte */}
              {hasCoords && (
                <View style={s.mapWrap}>
                  <MapView
                    style={s.mapPreview}
                    provider={PROVIDER_DEFAULT}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    initialRegion={{
                      latitude:      wish.latitude!,
                      longitude:     wish.longitude!,
                      latitudeDelta:  0.008,
                      longitudeDelta: 0.008,
                    }}
                    pointerEvents="none"
                  >
                    <Marker
                      coordinate={{ latitude: wish.latitude!, longitude: wish.longitude! }}
                      title={item.title}
                    />
                  </MapView>
                </View>
              )}

              {/* Boutons navigation */}
              {hasCoords && (
                <View style={s.navBtnRow}>
                  <TouchableOpacity
                    style={s.navBtn}
                    onPress={() => openInMaps(wish.latitude!, wish.longitude!, item.title)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="map-outline" size={16} color={Colors.textPrimary} />
                    <Text style={s.navBtnTxt}>Plans</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.navBtn}
                    onPress={() => openInGoogleMaps(wish.latitude!, wish.longitude!, item.title)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="navigate-outline" size={16} color={Colors.textPrimary} />
                    <Text style={s.navBtnTxt}>Google Maps</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ── Infos Google ── */}
          {wish && (wish.google_rating || wish.budget || wish.duration) && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Informations</Text>
              <View style={s.infoGrid}>
                {wish.google_rating != null && (
                  <View style={s.infoCell}>
                    <Text style={s.infoCellLabel}>Note Google</Text>
                    <Text style={s.infoCellValue}>⭐ {wish.google_rating.toFixed(1)}/5</Text>
                  </View>
                )}
                {wish.budget && (
                  <View style={s.infoCell}>
                    <Text style={s.infoCellLabel}>Budget</Text>
                    <Text style={s.infoCellValue}>💰 {BUDGET_LABEL[wish.budget] ?? wish.budget}</Text>
                  </View>
                )}
                {wish.duration && (
                  <View style={s.infoCell}>
                    <Text style={s.infoCellLabel}>Durée estimée</Text>
                    <Text style={s.infoCellValue}>⏱ {DURATION_LABEL[wish.duration] ?? wish.duration}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── Lien source (TikTok, site, etc.) ── */}
          {wish?.link_url && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Lien source</Text>
              <TouchableOpacity
                style={s.linkCard}
                onPress={() => WebBrowser.openBrowserAsync(wish.link_url!)}
                activeOpacity={0.8}
              >
                <Ionicons name="link-outline" size={16} color="#3B82F6" />
                <Text style={s.linkTxt} numberOfLines={1}>{wish.link_url}</Text>
                <Ionicons name="open-outline" size={14} color="#888" />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Liens multiples (carrousel) ── */}
          {wish?.links && wish.links.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Liens associés</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.linksRow}
              >
                {wish.links.map((lk, i) => (
                  <TouchableOpacity
                    key={i}
                    style={s.linkThumbCard}
                    onPress={() => WebBrowser.openBrowserAsync(lk.url)}
                    activeOpacity={0.85}
                  >
                    {lk.thumbnail ? (
                      <Image source={{ uri: lk.thumbnail }} style={s.linkThumb} resizeMode="cover" />
                    ) : (
                      <View style={[s.linkThumb, s.linkThumbFallback]}>
                        <Ionicons name="link-outline" size={22} color="#888" />
                      </View>
                    )}
                    {lk.title && (
                      <Text style={s.linkThumbTitle} numberOfLines={2}>{lk.title}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Notes du planning_item ── */}
          {item.notes && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Notes</Text>
              <View style={s.notesBox}>
                <Text style={s.notesTxt}>{item.notes}</Text>
              </View>
            </View>
          )}

          {/* ── Description de l'envie ── */}
          {wish?.description && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Description</Text>
              <Text style={s.descTxt}>{wish.description}</Text>
            </View>
          )}

        </View>
      </ScrollView>

      {/* ── Bouton sticky en bas ── */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={s.footerBtnDanger}
          onPress={removeFromPlanning}
          activeOpacity={0.85}
        >
          <Ionicons name="trash-outline" size={17} color="#DC2626" />
          <Text style={s.footerBtnDangerTxt}>Retirer du planning</Text>
        </TouchableOpacity>
      </View>

      {/* ── Edit schedule overlay ── */}
      {editVisible && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <TouchableOpacity
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
            activeOpacity={1}
            onPress={() => setEditVisible(false)}
          />
          <View style={[s.editSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.editHandle} />
            <Text style={s.editTitle}>Modifier l'horaire</Text>

            {/* Durée calculée */}
            {calcDuration(editStartH, editStartM, editEndH, editEndM) !== '' && (
              <View style={s.durationBadge}>
                <Text style={s.durationBadgeTxt}>
                  ⏱ {calcDuration(editStartH, editStartM, editEndH, editEndM)}
                </Text>
              </View>
            )}

            <View style={s.timeRow}>
              {/* Début */}
              <View style={s.timeBlock}>
                <Text style={s.timeLabel}>Début</Text>
                <View style={s.timePicker}>
                  <TouchableOpacity
                    style={s.timeArrow}
                    onPress={() => {
                      const [nh, nm] = stepTime(editStartH, editStartM, -15);
                      setEditStartH(nh);
                      setEditStartM(nm);
                    }}
                  >
                    <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={s.timeVal}>{formatTimePicker(editStartH, editStartM)}</Text>
                  <TouchableOpacity
                    style={s.timeArrow}
                    onPress={() => {
                      const [nh, nm] = stepTime(editStartH, editStartM, 15);
                      setEditStartH(nh);
                      setEditStartM(nm);
                      /* Garantit que fin > début + 15min */
                      const newTotal = nh * 60 + nm;
                      const endTotal = editEndH * 60 + editEndM;
                      if (endTotal <= newTotal + 14) {
                        const [eh, em] = stepTime(nh, nm, 15);
                        setEditEndH(eh);
                        setEditEndM(em);
                      }
                    }}
                  >
                    <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              <Ionicons name="arrow-forward" size={18} color={Colors.textTertiary} style={{ marginTop: 34 }} />

              {/* Fin */}
              <View style={s.timeBlock}>
                <Text style={s.timeLabel}>Fin</Text>
                <View style={s.timePicker}>
                  <TouchableOpacity
                    style={s.timeArrow}
                    onPress={() => {
                      const minEnd = editStartH * 60 + editStartM + 15;
                      const [nh, nm] = stepTime(editEndH, editEndM, -15);
                      const newTotal = nh * 60 + nm;
                      if (newTotal >= minEnd) { setEditEndH(nh); setEditEndM(nm); }
                    }}
                  >
                    <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={s.timeVal}>{formatTimePicker(editEndH, editEndM)}</Text>
                  <TouchableOpacity
                    style={s.timeArrow}
                    onPress={() => {
                      const [nh, nm] = stepTime(editEndH, editEndM, 15);
                      setEditEndH(nh);
                      setEditEndM(nm);
                    }}
                  >
                    <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={s.editActions}>
              <TouchableOpacity style={s.editCancel} onPress={() => setEditVisible(false)} activeOpacity={0.75}>
                <Text style={s.editCancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.editConfirm, saving && { opacity: 0.55 }]}
                onPress={saveSchedule}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.editConfirmTxt}>Confirmer</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  /* Error */
  errorTxt: { fontSize: 16, color: Colors.textSecondary, marginBottom: 16 },
  backBtn:  { paddingHorizontal: 24, paddingVertical: 14, backgroundColor: '#1A1A1A', borderRadius: 14 },
  backBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },

  /* Hero */
  heroWrap: {
    width: '100%',
    height: 250,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  heroFallback: {
    width: '100%',
    height: 250,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: {
    fontSize: 64,
  },

  /* Back FAB */
  backFab: {
    position: 'absolute',
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },

  /* Content */
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
    marginBottom: 12,
  },

  /* Badges */
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
  },
  badgeTxt: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Info row */
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  infoTxt: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  /* Schedule card */
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 4,
    gap: 12,
  },
  scheduleLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scheduleDay: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
    marginBottom: 2,
  },
  scheduleTime: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  scheduleDuration: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textTertiary,
  },
  scheduleEditBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
  },
  scheduleEditTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  /* Duration badge in edit sheet */
  durationBadge: {
    alignSelf: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: Radii.full,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 20,
  },
  durationBadgeTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  /* Sections */
  section: {
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },

  /* Map */
  mapWrap: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    ...Shadows.sm,
  },
  mapPreview: {
    flex: 1,
  },

  /* Nav buttons */
  navBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    ...Shadows.sm,
  },
  navBtnTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  /* Info grid */
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoCell: {
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: '44%',
    flex: 1,
  },
  infoCellLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  infoCellValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  /* Link card */
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  linkTxt: {
    flex: 1,
    fontSize: 13,
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },

  /* Links carousel */
  linksRow: {
    gap: 12,
    paddingRight: 4,
  },
  linkThumbCard: {
    width: 140,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
    ...Shadows.sm,
  },
  linkThumb: {
    width: '100%',
    height: 100,
  },
  linkThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBEBEB',
  },
  linkThumbTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1A1A1A',
    padding: 8,
    lineHeight: 15,
  },

  /* Notes */
  notesBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  notesTxt: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },

  /* Description */
  descTxt: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  footerBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
  },
  footerBtnSecondaryTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  footerBtnDanger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(220,38,38,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.25)',
  },
  footerBtnDangerTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },

  /* Edit schedule sheet */
  editSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    ...Shadows.lg,
  },
  editHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 20,
  },
  editTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.3,
    marginBottom: 24,
  },

  /* Time pickers */
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: 24,
  },
  timeBlock: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    overflow: 'hidden',
  },
  timeArrow: {
    width: 40,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeVal: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },

  /* Edit actions */
  editActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  editCancel: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  editCancelTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
  },
  editConfirm: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editConfirmTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
