/**
 * Planning screen — Réservoir d'envies, drag & drop, timeline fixe, swipe-to-delete
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { NavButton } from '@/components/ui/NavButton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { AddToPlanningSheet } from '@/components/planning/AddToPlanningSheet';

/* ─── Constants ──────────────────────────────────────────────── */
const HOUR_H      = 64;   // pixels per hour
const START_HOUR  = 8;
const END_HOUR    = 23;
const TOTAL_HOURS = END_HOUR - START_HOUR;  // 15
const TIMELINE_H  = TOTAL_HOURS * HOUR_H;   // 960
const MIN_CARD_H  = 60;
const TIME_COL_W  = 52;   // left time label column
const OVERLAY_W   = 210;
const OVERLAY_H   = 56;

/* ─── Category config ────────────────────────────────────────── */
const CAT: Record<string, { emoji: string; color: string; label: string }> = {
  restaurant: { emoji: '🍽️', color: '#F97316', label: 'Restaurant' },
  monument:   { emoji: '🏛️', color: '#8B5CF6', label: 'Monument' },
  cafe:       { emoji: '☕',  color: '#A16207', label: 'Café' },
  hotel:      { emoji: '🏨', color: '#0EA5E9', label: 'Hôtel' },
  activity:   { emoji: '🎭', color: '#22C55E', label: 'Activité' },
  photo_spot: { emoji: '📸', color: '#EC4899', label: 'Photo spot' },
  bar:        { emoji: '🍺', color: '#EAB308', label: 'Bar' },
  transport:  { emoji: '🚗', color: '#3B82F6', label: 'Transport' },
  orga:       { emoji: '📋', color: '#6B7280', label: 'Organisation' },
  autre:      { emoji: '✨', color: '#6B7280', label: 'Autre' },
};
function cat(key?: string | null) { return CAT[key ?? ''] ?? CAT.autre; }

/* ─── Types ──────────────────────────────────────────────────── */
interface Trip {
  id: string; name: string; destination?: string;
  start_date: string; end_date: string;
}
interface Wish {
  id: string; title: string; category?: string; image_url?: string;
}
interface PlanningItem {
  id: string; trip_id: string; wish_id?: string | null;
  title: string; day_date: string;
  start_time?: string | null; end_time?: string | null;
  sort_order?: number; is_locked?: boolean;
  notes?: string | null; added_by?: string | null;
  category?: string | null; wish?: Wish;
}
type AddMode =
  | null
  | { type: 'list' }
  | { type: 'wish'; wish: Wish }
  | { type: 'manual' };

/* ─── Helpers ────────────────────────────────────────────────── */
const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function generateDays(start: string, end: string): string[] {
  const result: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const cur = new Date(s);
  while (cur <= e) {
    result.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}
function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}`;
}
function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0];
}
function tH(t: string) { return parseInt(t.split(':')[0] ?? '0', 10); }
function tM(t: string) { return parseInt(t.split(':')[1] ?? '0', 10); }
function fmtTime(h: number, m = 0): string {
  return `${String(h).padStart(2, '0')}h${m ? String(m).padStart(2, '0') : ''}`;
}
function hourToStr(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

/* ─── ReservoirCard ──────────────────────────────────────────── */
interface ReservoirCardProps {
  wish:          Wish;
  isGhost:       boolean;
  dragX:         SharedValue<number>;
  dragY:         SharedValue<number>;
  isDragging:    SharedValue<number>;
  onDragStart:   (w: Wish) => void;
  onDragEnd:     (x: number, y: number) => void;
  onHover:       (y: number) => void;
  onTap:         (w: Wish) => void;
}
function ReservoirCard({
  wish, isGhost, dragX, dragY, isDragging, onDragStart, onDragEnd, onHover, onTap,
}: ReservoirCardProps) {
  const c = cat(wish.category);
  const liftScale = useSharedValue(1);

  const gesture = Gesture.Pan()
    .activateAfterLongPress(420)
    .onStart((e) => {
      liftScale.value = withSpring(1.06);
      isDragging.value = withTiming(1, { duration: 120 });
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      runOnJS(onDragStart)(wish);
    })
    .onChange((e) => {
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      runOnJS(onHover)(e.absoluteY);
    })
    .onEnd((e) => {
      runOnJS(onDragEnd)(e.absoluteX, e.absoluteY);
    })
    .onFinalize((_e, success) => {
      liftScale.value = withSpring(1);
      isDragging.value = withTiming(0, { duration: 150 });
      if (!success) {
        runOnJS(onDragEnd)(-1, -1);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    opacity: isGhost ? 0.25 : 1,
    transform: [{ scale: isGhost ? 1 : liftScale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[rc.card, cardStyle]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={() => onTap(wish)}
          activeOpacity={0.85}
        />
        {wish.image_url ? (
          <Image
            source={{ uri: wish.image_url }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, rc.fallback, { backgroundColor: c.color + '33' }]}>
            <Text style={rc.fallbackEmoji}>{c.emoji}</Text>
          </View>
        )}
        <View style={rc.bottom}>
          <Text style={rc.title} numberOfLines={2}>{wish.title}</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/* ─── TimelineItemCard ───────────────────────────────────────── */
interface TimelineItemCardProps {
  item:        PlanningItem;
  isNew:       boolean;
  dragX:       SharedValue<number>;
  dragY:       SharedValue<number>;
  isDragging:  SharedValue<number>;
  onDragStart: (item: PlanningItem) => void;
  onDragEnd:   (x: number, y: number) => void;
  onHover:     (y: number) => void;
  onDelete:    (item: PlanningItem) => void;
  onPress:     (item: PlanningItem) => void;
}
function TimelineItemCard({
  item, isNew, dragX, dragY, isDragging, onDragStart, onDragEnd, onHover, onDelete, onPress,
}: TimelineItemCardProps) {
  const c = cat(item.wish?.category ?? item.category);
  const img = item.wish?.image_url;

  const sh = tH(item.start_time ?? '08:00');
  const sm = tM(item.start_time ?? '08:00');
  const eh = tH(item.end_time ?? '09:00');
  const em = tM(item.end_time ?? '09:00');

  const topOffset  = (sh - START_HOUR + sm / 60) * HOUR_H + 2;
  const durMins    = (eh * 60 + em) - (sh * 60 + sm);
  const cardH      = Math.max(MIN_CARD_H, (durMins / 60) * HOUR_H);
  const timeStr    = `${fmtTime(sh, sm)} - ${fmtTime(eh, em)}`;

  /* Flash for new item */
  const flashAnim = useSharedValue(1);
  useEffect(() => {
    if (!isNew) return;
    flashAnim.value = withTiming(0.35, { duration: 220 }, (ok) => {
      if (!ok) return;
      flashAnim.value = withTiming(1, { duration: 220 }, (ok2) => {
        if (!ok2) return;
        flashAnim.value = withTiming(0.35, { duration: 220 }, (ok3) => {
          if (!ok3) return;
          flashAnim.value = withTiming(1, { duration: 300 });
        });
      });
    });
  }, [isNew]);

  /* Tap → ouvre la fiche détail */
  const tapGesture = Gesture.Tap()
    .maxDuration(200)
    .onEnd((_e, success) => {
      if (success) runOnJS(onPress)(item);
    });

  /* Swipe-to-delete */
  const swipeX = useSharedValue(0);
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-8, 8])
    .onChange((e) => {
      swipeX.value = Math.max(-84, Math.min(0, swipeX.value + e.changeX));
    })
    .onEnd(() => {
      swipeX.value = swipeX.value < -42 ? withSpring(-84) : withSpring(0);
    });

  /* Drag long-press (désactivé si locked) */
  const dragGesture = Gesture.Pan()
    .activateAfterLongPress(350)
    .onStart((e) => {
      isDragging.value = withTiming(1, { duration: 120 });
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      runOnJS(onDragStart)(item);
    })
    .onChange((e) => {
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      runOnJS(onHover)(e.absoluteY);
    })
    .onEnd((e) => {
      runOnJS(onDragEnd)(e.absoluteX, e.absoluteY);
    })
    .onFinalize((_e, success) => {
      isDragging.value = withTiming(0, { duration: 150 });
      if (!success) {
        runOnJS(onDragEnd)(-1, -1);
      }
    });

  /* Race : le premier geste qui s'active gagne */
  const composed = item.is_locked
    ? Gesture.Race(tapGesture, swipeGesture)
    : Gesture.Race(tapGesture, swipeGesture, dragGesture);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: flashAnim.value,
    transform: [{ translateX: swipeX.value }],
  }));

  return (
    <View style={[tic.container, { top: topOffset }]}>
      {/* Icône ✕ révélée au swipe gauche */}
      <TouchableOpacity
        style={tic.deleteZone}
        onPress={() => onDelete(item)}
        activeOpacity={0.85}
      >
        <Ionicons name="close-circle" size={28} color="#EF4444" />
      </TouchableOpacity>

      <GestureDetector gesture={composed}>
        <Animated.View style={[tic.card, { height: cardH }, cardStyle]}>

          {/* Image de fond (ou couleur catégorie) */}
          {img ? (
            <Image source={{ uri: img }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, tic.fallbackBg, { backgroundColor: c.color + '30' }]}>
              <Text style={tic.fallbackEmoji}>{c.emoji}</Text>
            </View>
          )}

          {/* Overlay sombre pour lisibilité */}
          <View style={tic.overlay} />

          {/* Barre couleur gauche */}
          <View style={[tic.border, { backgroundColor: c.color }]} />

          {/* Texte */}
          <View style={tic.textWrap}>
            <Text style={tic.itemTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={tic.itemTime}>{timeStr}</Text>
          </View>

          {/* Cadenas */}
          {item.is_locked && (
            <Ionicons name="lock-closed" size={13} color="rgba(255,255,255,0.8)" style={tic.lock} />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/* ─── PlanningScreen ─────────────────────────────────────────── */
export default function PlanningScreen() {
  const { id: tripId, highlightDay, highlightId } = useLocalSearchParams<{
    id: string; highlightDay?: string; highlightId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  /* Data */
  const [trip,      setTrip]      = useState<Trip | null>(null);
  const [days,      setDays]      = useState<string[]>([]);
  const [selDayIdx, setSelDayIdx] = useState(0);
  const [wishes,    setWishes]    = useState<Wish[]>([]);
  const [items,     setItems]     = useState<PlanningItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newItemId, setNewItemId] = useState<string | null>(null);

  /* UI */
  const [showReservoir, setShowReservoir] = useState(false);
  const [addMode,       setAddMode]       = useState<AddMode>(null);
  const [hoveredHour,   setHoveredHour]   = useState<number | null>(null);

  /* Drag */
  type DragPayload = { type: 'wish'; wish: Wish } | { type: 'item'; item: PlanningItem } | null;
  const [dragPayload, setDragPayload] = useState<DragPayload>(null);
  const dragX     = useSharedValue(0);
  const dragY     = useSharedValue(0);
  const isDragging = useSharedValue(0);

  /* Layout measurement */
  const timelineRef       = useRef<any>(null);
  const timelineTopRef    = useRef(0);
  const timelineScrollRef = useRef(0);

  const selectedDay = days[selDayIdx] ?? '';

  /* ── Load trip ── */
  const loadTrip = useCallback(async () => {
    if (!tripId) return;
    const { data } = await supabase
      .from('trips')
      .select('id, name, destination, start_date, end_date')
      .eq('id', tripId)
      .single();
    if (data?.start_date && data?.end_date) {
      setTrip(data);
      const d = generateDays(data.start_date, data.end_date);
      setDays(d);
      if (highlightDay) {
        const idx = d.indexOf(highlightDay as string);
        if (idx >= 0) setSelDayIdx(idx);
      }
    }
  }, [tripId, highlightDay]);

  /* ── Load items ── */
  const loadItems = useCallback(async (dayDate: string) => {
    if (!tripId || !dayDate) return;
    const { data: rawItems } = await supabase
      .from('planning_items')
      .select('*')
      .eq('trip_id', tripId)
      .eq('day_date', dayDate)
      .order('start_time', { ascending: true });

    const wishIds = (rawItems ?? []).map((i: any) => i.wish_id).filter((id: any): id is string => !!id);
    let wishMap: Record<string, Wish> = {};
    if (wishIds.length > 0) {
      const { data: ws } = await supabase
        .from('wishes')
        .select('id, title, category, image_url')
        .in('id', wishIds);
      (ws ?? []).forEach((w: Wish) => { wishMap[w.id] = w; });
    }
    const enriched = (rawItems ?? []).map((it: any) => ({
      ...it,
      wish: it.wish_id ? wishMap[it.wish_id] : undefined,
    }));
    setItems(enriched);

    if (highlightId && enriched.some((it: PlanningItem) => it.id === highlightId)) {
      setNewItemId(highlightId as string);
      setTimeout(() => setNewItemId(null), 2500);
    }
  }, [tripId, highlightId]);

  /* ── Load unplanned wishes ── */
  const loadWishes = useCallback(async () => {
    if (!tripId) return;
    const { data: planned } = await supabase
      .from('planning_items').select('wish_id').eq('trip_id', tripId);
    const plannedIds = (planned ?? []).map((p: any) => p.wish_id).filter(Boolean) as string[];
    const { data: allValidated } = await supabase
      .from('wishes')
      .select('id, title, category, image_url')
      .eq('trip_id', tripId)
      .eq('status', 'validated');
    setWishes((allValidated ?? []).filter((w: Wish) => !plannedIds.includes(w.id)));
  }, [tripId]);

  /* ── Mount ── */
  useEffect(() => {
    setIsLoading(true);
    loadTrip().finally(() => setIsLoading(false));
  }, [loadTrip]);

  useEffect(() => {
    if (days.length > 0) {
      loadItems(days[selDayIdx]);
      loadWishes();
    }
  }, [days, selDayIdx, loadItems, loadWishes]);

  /* ── Refresh au retour (ex: depuis la fiche détail) ── */
  useFocusEffect(
    useCallback(() => {
      if (days.length > 0 && days[selDayIdx]) {
        loadItems(days[selDayIdx]);
        loadWishes();
      }
    }, [days, selDayIdx, loadItems, loadWishes]),
  );

  /* ── Measure timeline absolute Y ── */
  const measureTimeline = useCallback(() => {
    timelineRef.current?.measure(
      (_x: number, _y: number, _w: number, _h: number, _px: number, pageY: number) => {
        timelineTopRef.current = pageY;
      },
    );
  }, []);

  /* ── Drag handlers (called via runOnJS from worklet) ── */
  const handleWishDragStart = useCallback((wish: Wish) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDragPayload({ type: 'wish', wish });
  }, []);

  const handleItemDragStart = useCallback((item: PlanningItem) => {
    if (item.is_locked) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDragPayload({ type: 'item', item });
  }, []);

  const calcHour = useCallback((dropY: number): number => {
    const relY = dropY - timelineTopRef.current + timelineScrollRef.current;
    return START_HOUR + Math.floor(relY / HOUR_H);
  }, []);

  const handleDragEnd = useCallback(async (dropX: number, dropY: number) => {
    const payload = dragPayload;
    setDragPayload(null);
    setHoveredHour(null);

    if (dropX < 0 || !payload) return;

    const hour = calcHour(dropY);
    if (hour < START_HOUR || hour >= END_HOUR - 1) return;

    const startTime = hourToStr(hour);
    const endTime   = hourToStr(hour + 1);

    if (payload.type === 'wish') {
      const { error } = await supabase.from('planning_items').insert({
        trip_id:    tripId,
        wish_id:    payload.wish.id,
        title:      payload.wish.title,
        day_date:   selectedDay,
        start_time: startTime,
        end_time:   endTime,
        sort_order: 0,
        added_by:   user?.id ?? null,
      });
      if (!error) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        loadItems(selectedDay);
        loadWishes();
      }
    } else if (payload.type === 'item') {
      const oh    = tH(payload.item.start_time ?? '08:00');
      const om    = tM(payload.item.start_time ?? '08:00');
      const oeh   = tH(payload.item.end_time ?? '09:00');
      const oem   = tM(payload.item.end_time ?? '09:00');
      const durMins = (oeh * 60 + oem) - (oh * 60 + om);
      const newEh   = hour + Math.floor(durMins / 60);
      const newEm   = durMins % 60;
      await supabase.from('planning_items').update({
        day_date:   selectedDay,
        start_time: startTime,
        end_time:   `${String(newEh).padStart(2, '0')}:${String(newEm).padStart(2, '0')}`,
      }).eq('id', payload.item.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      loadItems(selectedDay);
    }
  }, [dragPayload, selectedDay, tripId, user?.id, calcHour, loadItems, loadWishes]);

  const updateHoveredHour = useCallback((y: number) => {
    const h = calcHour(y);
    setHoveredHour(h >= START_HOUR && h < END_HOUR ? h : null);
  }, [calcHour]);

  /* ── Delete ── */
  const handleDelete = useCallback((item: PlanningItem) => {
    Alert.alert('Retirer du planning', `Retirer "${item.title}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer', style: 'destructive',
        onPress: async () => {
          await supabase.from('planning_items').delete().eq('id', item.id);
          loadItems(selectedDay);
          loadWishes();
        },
      },
    ]);
  }, [selectedDay, loadItems, loadWishes]);

  /* ── Drag overlay style ── */
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: isDragging.value,
    transform: [
      { translateX: dragX.value - OVERLAY_W / 2 },
      { translateY: dragY.value - OVERLAY_H / 2 },
      { scale: 1.06 },
    ],
  }));

  if (isLoading) {
    return (
      <View style={[s.root, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const navBottom = Math.max(insets.bottom, 10) + 16;
  const navH      = 64;
  const bottomPad = navBottom + navH + 20;

  const dragCat    = dragPayload?.type === 'wish'
    ? cat(dragPayload.wish.category)
    : cat((dragPayload as any)?.item?.wish?.category ?? (dragPayload as any)?.item?.category);
  const dragImg    = dragPayload?.type === 'wish'
    ? dragPayload.wish.image_url
    : (dragPayload as any)?.item?.wish?.image_url;
  const dragTitle  = dragPayload?.type === 'wish'
    ? dragPayload.wish.title
    : (dragPayload as any)?.item?.title ?? '';

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.title}>Planning</Text>
      </View>

      {/* ── Carrousel de jours ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.dayRow}
        style={s.dayStrip}
      >
        {days.map((d, i) => (
          <TouchableOpacity
            key={d}
            style={[s.dayChip, selDayIdx === i && s.dayChipOn]}
            onPress={() => setSelDayIdx(i)}
            activeOpacity={0.75}
          >
            <Text style={[s.dayChipTxt, selDayIdx === i && s.dayChipTxtOn]}>
              {formatDayLabel(d)}
            </Text>
            {isToday(d) && <View style={[s.todayDot, selDayIdx === i && s.todayDotOn]} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Timeline ── */}
      <ScrollView
        ref={timelineRef}
        style={s.timelineScroll}
        contentContainerStyle={{ height: TIMELINE_H + bottomPad }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!dragPayload}
        onScroll={(e) => { timelineScrollRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        onLayout={measureTimeline}
      >
        {/* Hour lines */}
        {Array.from({ length: TOTAL_HOURS }, (_, i) => {
          const hour    = START_HOUR + i;
          const isHover = hoveredHour === hour;
          return (
            <View
              key={hour}
              style={[s.hourSlot, { top: i * HOUR_H }, isHover && s.hourSlotHover]}
            >
              <Text style={s.hourLabel}>{String(hour).padStart(2, '0')}:00</Text>
              <View style={[s.hourLine, isHover && s.hourLineHover]} />
            </View>
          );
        })}

        {/* Items */}
        {items.map(item => (
          <TimelineItemCard
            key={item.id}
            item={item}
            isNew={item.id === newItemId}
            dragX={dragX}
            dragY={dragY}
            isDragging={isDragging}
            onDragStart={handleItemDragStart}
            onDragEnd={handleDragEnd}
            onHover={updateHoveredHour}
            onDelete={handleDelete}
            onPress={(it) => router.push(`/trip/${tripId}/planning-detail?itemId=${it.id}`)}
          />
        ))}

        {/* Empty state */}
        {items.length === 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyEmoji}>📅</Text>
            <Text style={s.emptyTitle}>Rien de planifié</Text>
            <Text style={s.emptySub}>
              {wishes.length > 0
                ? 'Appuie sur "+" pour ouvrir le réservoir et glisser une envie'
                : 'Ajoute des envies validées pour les planifier ici'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Réservoir d'envies (bas, toggle) ── */}
      {showReservoir && <View style={[s.reservoir, { paddingBottom: navBottom + navH + 4 }]}>
        <View style={s.reservoirHead}>
          <Text style={s.reservoirLabel}>
            Envies à placer{wishes.length > 0 ? ` (${wishes.length})` : ''}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.reservoirScroll}
        >
          {wishes.length === 0 && (
            <View style={s.reservoirEmpty}>
              <Text style={s.reservoirEmptyTxt}>Toutes les envies sont planifiées 🎉</Text>
            </View>
          )}
          {wishes.map(w => (
            <ReservoirCard
              key={w.id}
              wish={w}
              isGhost={dragPayload?.type === 'wish' && dragPayload.wish.id === w.id}
              dragX={dragX}
              dragY={dragY}
              isDragging={isDragging}
              onDragStart={handleWishDragStart}
              onDragEnd={handleDragEnd}
              onHover={updateHoveredHour}
              onTap={(wish) => setAddMode({ type: 'wish', wish })}
            />
          ))}
        </ScrollView>
      </View>}

      {/* ── Bottom nav ── */}
      <View style={[s.bottomNav, { bottom: navBottom }]} pointerEvents="box-none">
        <NavButton icon="arrow-back-outline" onPress={() => router.back()} />
        <NavButton
          icon={showReservoir ? 'close' : 'add'}
          iconSize={28}
          onPress={() => setShowReservoir(v => !v)}
        />
        <NavButton icon="create-outline" onPress={() => setAddMode({ type: 'manual' })} />
      </View>

      {/* ── Drag overlay (flottant au-dessus de tout) ── */}
      <Animated.View
        style={[s.overlay, overlayStyle]}
        pointerEvents="none"
      >
        {dragImg ? (
          <Image source={{ uri: dragImg }} style={s.overlayThumb} resizeMode="cover" />
        ) : (
          <View style={[s.overlayThumb, s.overlayThumbFallback, { backgroundColor: dragCat.color + '33' }]}>
            <Text style={s.overlayEmoji}>{dragCat.emoji}</Text>
          </View>
        )}
        <Text style={s.overlayTitle} numberOfLines={1}>{dragTitle}</Text>
      </Animated.View>

      {/* ── AddToPlanningSheet ── */}
      <AddToPlanningSheet
        visible={addMode !== null}
        onClose={() => setAddMode(null)}
        onAdded={(day, itemId) => {
          setAddMode(null);
          if (day === selectedDay) {
            loadItems(selectedDay);
          }
          loadWishes();
        }}
        tripId={tripId ?? ''}
        userId={user?.id}
        defaultWish={addMode?.type === 'wish' ? addMode.wish : null}
        forceManual={addMode?.type === 'manual'}
        defaultDay={selectedDay}
      />
    </View>
  );
}

/* ─── ReservoirCard styles (rc) ─────────────────────────────── */
const rc = StyleSheet.create({
  card: {
    width: 120,
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: Colors.surface,
    position: 'relative',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackEmoji: {
    fontSize: 36,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 9,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  title: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
  },
  manualBtn: {
    width: 80,
    height: 110,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginRight: 10,
  },
  manualEmoji: {
    fontSize: 22,
  },
  manualTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 13,
  },
});

/* ─── TimelineItemCard styles (tic) ─────────────────────────── */
const tic = StyleSheet.create({
  container: {
    position: 'absolute',
    left: TIME_COL_W + 8,
    right: 12,
  },
  deleteZone: {
    position: 'absolute',
    right: -84,
    top: 0,
    bottom: 0,
    width: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    overflow: 'hidden',
    paddingRight: 10,
    gap: 10,
    ...Shadows.sm,
  },
  fallbackBg: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackEmoji: {
    fontSize: 28,
    opacity: 0.45,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  border: {
    width: 4,
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    gap: 2,
    paddingVertical: 8,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  itemTime: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.72)',
  },
  lock: {
    flexShrink: 0,
  },
});

/* ─── Main styles (s) ────────────────────────────────────────── */
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1,
  },

  /* Reservoir */
  reservoir: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 10,
    backgroundColor: Colors.background,
  },
  reservoirHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: 8,
    paddingBottom: 8,
  },
  reservoirLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reservoirScroll: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 4,
  },
  reservoirEmpty: {
    paddingVertical: 30,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  reservoirEmptyTxt: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  /* Day carousel */
  dayStrip: {
    maxHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dayRow: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 3,
  },
  dayChipOn: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  dayChipTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  dayChipTxtOn: {
    color: Colors.white,
    fontWeight: '700',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  todayDotOn: {
    backgroundColor: 'rgba(255,255,255,0.7)',
  },

  /* Timeline */
  timelineScroll: {
    flex: 1,
  },
  hourSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: HOUR_H,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 0,
  },
  hourSlotHover: {
    backgroundColor: 'rgba(99,102,241,0.06)',
  },
  hourLabel: {
    width: TIME_COL_W,
    paddingLeft: 14,
    paddingTop: 6,
    fontSize: 10,
    fontWeight: '600',
    color: '#CBD5E1',
    letterSpacing: 0.2,
  },
  hourLine: {
    flex: 1,
    height: 1,
    marginTop: 10,
    backgroundColor: '#F1F5F9',
  },
  hourLineHover: {
    backgroundColor: '#C7D2FE',
  },

  /* Empty state */
  emptyState: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },

  /* Bottom nav */
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    zIndex: 10,
  },

  /* Drag overlay */
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: OVERLAY_W,
    height: OVERLAY_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 12,
    zIndex: 9999,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  overlayThumb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    flexShrink: 0,
  },
  overlayThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayEmoji: {
    fontSize: 16,
  },
  overlayTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
