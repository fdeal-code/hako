import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Spacing, Radii, Shadows } from '@/constants/theme';
import { Trip } from '@/constants/types';

/* ─── Constants ──────────────────────────────────────────────── */
const ENVIE_IMG =
  'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=400&q=60';
const DOC_ITEMS = ["Passeport", "Billets d'avion", "Réservation"];
const AVATAR_BG = ['#E8C5A5', '#A5B8E0', '#A8D5B5', '#F0B0B0'];

function formatDateLabel(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const M = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${M[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${M[s.getMonth()]} – ${M[e.getMonth()]} ${e.getFullYear()}`;
}

/* ─── GlassCard ──────────────────────────────────────────────── */
function GlassCard({
  children, onPress, flex = 1, minHeight = 130,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  flex?: number;
  minHeight?: number;
}) {
  return (
    <TouchableOpacity
      style={[styles.glassWrap, { flex, minHeight }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <BlurView intensity={45} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.cardGlassOverlay} />
      <View style={styles.cardContent}>{children}</View>
    </TouchableOpacity>
  );
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
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();

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
          <Text style={styles.destText}>{trip.destination.toUpperCase()}</Text>

          <View style={styles.headerMeta}>
            <BlurView intensity={50} tint="dark" style={styles.dateBadge}>
              <Text style={styles.dateBadgeText}>{dateLabel}</Text>
            </BlurView>
            <View style={styles.avatarsRow}>
              {trip.members.slice(0, 3).map((m, i) => (
                <View
                  key={m.user_id}
                  style={[styles.avatar, {
                    backgroundColor: AVATAR_BG[i % AVATAR_BG.length],
                    marginLeft: i > 0 ? -9 : 0,
                    zIndex: 10 - i,
                  }]}
                />
              ))}
              <TouchableOpacity style={styles.addMemberBtn} activeOpacity={0.8}>
                <Ionicons name="add" size={13} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Bento grid */}
        <Animated.View style={[{ flex: 1 }, bentoStyle]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
          >
            {/* Row 1 : Documents + Planning */}
            <View style={styles.row}>
              <GlassCard flex={1.5} minHeight={140} onPress={() => router.push(`/trip/${trip.id}/documents`)}>
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
            <TouchableOpacity
              style={styles.mapCard}
              onPress={() => router.push(`/trip/${trip.id}/map`)}
              activeOpacity={0.85}
            >
              <BlurView intensity={35} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.cardGlassOverlay} />
              <View style={styles.mapGrid}>
                {[...Array(4)].map((_, i) => (
                  <View key={`h${i}`} style={[styles.mapLine, { top: `${25*(i+1)}%` as any, width: '100%', height: 1 }]} />
                ))}
                {[...Array(5)].map((_, i) => (
                  <View key={`v${i}`} style={[styles.mapLine, { left: `${20*(i+1)}%` as any, height: '100%', width: 1 }]} />
                ))}
                <View style={styles.mapRoad1} />
                <View style={styles.mapRoad2} />
              </View>
              <View style={styles.mapPinWrap}>
                <View style={styles.mapPinShadow} />
                <Ionicons name="location" size={30} color="#E8453C" />
              </View>
              <View style={styles.mapLabelWrap}>
                <Ionicons name="map-outline" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.mapLabel}>Rome, Italie</Text>
              </View>
            </TouchableOpacity>

            {/* Row 3 : Envies + Budget */}
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.glassWrap, { flex: 1, minHeight: 115 }]}
                onPress={() => router.push(`/trip/${trip.id}/envies`)}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: ENVIE_IMG }}
                  style={[StyleSheet.absoluteFill, { borderRadius: Radii.lg, opacity: 0.45 }]}
                  resizeMode="cover"
                />
                <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                <View style={[styles.cardGlassOverlay, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>VOS ENVIES</Text>
                  <Text style={styles.enviesEmpty}>Espace vide</Text>
                </View>
              </TouchableOpacity>

              <GlassCard flex={1} minHeight={115} onPress={() => router.push(`/trip/${trip.id}/budget`)}>
                <Text style={styles.cardTitle}>BUDGET</Text>
                <View style={styles.addCircle}>
                  <Ionicons name="add" size={20} color="#fff" />
                </View>
                <Text style={styles.budgetSub}>Créer un tricount</Text>
              </GlassCard>
            </View>
          </ScrollView>
        </Animated.View>

      </View>

    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
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
  destText: {
    fontSize: 68,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.90)',
    letterSpacing: 4,
    lineHeight: 72,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  dateBadge: {
    overflow: 'hidden',
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  dateBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  avatarsRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
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

  /* Scroll / Bento */
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  row: { flexDirection: 'row', gap: Spacing.sm },

  /* Glass card */
  glassWrap: {
    borderRadius: Radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    ...Shadows.md,
  },
  cardGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  cardContent: { padding: Spacing.md, flex: 1, justifyContent: 'space-between' },
  cardTitle: { fontSize: 12, fontWeight: '800', color: '#fff', letterSpacing: 0.8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  /* Documents */
  docList: { gap: 7, marginTop: Spacing.sm },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.65)' },
  docText: { fontSize: 12, color: 'rgba(255,255,255,0.82)', fontWeight: '500' },

  /* Planning */
  planningInfo: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
    fontWeight: '600',
    lineHeight: 20,
    marginTop: Spacing.sm,
  },

  /* Map */
  mapCard: {
    height: 145,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    ...Shadows.md,
  },
  mapGrid: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(140,185,170,0.30)' },
  mapLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.18)' },
  mapRoad1: { position: 'absolute', top: '45%', left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2 },
  mapRoad2: { position: 'absolute', left: '38%', top: 0, bottom: 0, width: 3, backgroundColor: 'rgba(255,255,255,0.20)', borderRadius: 2 },
  mapPinWrap: { position: 'absolute', top: '28%', left: '40%', alignItems: 'center' },
  mapPinShadow: { position: 'absolute', bottom: -2, width: 10, height: 5, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.25)' },
  mapLabelWrap: { position: 'absolute', bottom: 10, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.28)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999 },
  mapLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },

  /* Envies */
  enviesEmpty: { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', marginTop: Spacing.xs },

  /* Budget */
  addCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginVertical: 2 },
  budgetSub: { fontSize: 10, color: 'rgba(255,255,255,0.60)', textAlign: 'center', fontWeight: '500' },
});
