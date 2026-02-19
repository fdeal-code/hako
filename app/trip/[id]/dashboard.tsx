import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { NavButton } from '@/components/ui/NavButton';


/* ─── Mock data ─────────────────────────────────────────────── */
const COVER_URL =
  'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800&q=80';
const ENVIE_IMG =
  'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=400&q=60';

const AVATARS = [
  { bg: '#E8C5A5' },
  { bg: '#A5B8E0' },
  { bg: '#A8D5B5' },
];

const DOC_ITEMS = ["Passeport", "Billets d'avion", "Réservation"];

/* ─── Main screen ────────────────────────────────────────────── */
export default function DashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>

      <Stack.Screen options={{ animation: 'fade', headerShown: false }} />

      {/* ── Background photo ── */}
      <Image
        source={{ uri: COVER_URL }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <View style={styles.bgDim} />

      {/* ── Foreground layout ── */}
      <View style={[styles.fg, { paddingTop: insets.top }]}>

        {/* ── HEADER — fade in ── */}
        <Animated.View entering={FadeIn.duration(350).delay(180)} style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Destination name — huge outline-style text */}
          <Text style={styles.destText}>ITALIE</Text>

          {/* Badge date + avatars */}
          <View style={styles.headerMeta}>
            <BlurView intensity={50} tint="dark" style={styles.dateBadge}>
              <Text style={styles.dateBadgeText}>Juin 2026</Text>
            </BlurView>

            <View style={styles.avatarsRow}>
              {AVATARS.map((a, i) => (
                <View
                  key={i}
                  style={[
                    styles.avatar,
                    { backgroundColor: a.bg, marginLeft: i > 0 ? -9 : 0, zIndex: 10 - i },
                  ]}
                />
              ))}
              <TouchableOpacity style={styles.addMemberBtn} activeOpacity={0.8}>
                <Ionicons name="add" size={13} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* ── BENTO GRID — slide up + fade in ── */}
        <Animated.View entering={FadeInUp.duration(500).delay(300)} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 110 },
          ]}
        >
          {/* ── Row 1 : Documents + Planning ── */}
          <View style={styles.row}>

            {/* Documents */}
            <GlassCard
              flex={1.5}
              minHeight={140}
              onPress={() => router.push(`/trip/${id}/documents`)}
            >
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

            {/* Planning */}
            <GlassCard
              flex={1}
              minHeight={140}
              onPress={() => router.push(`/trip/${id}/planning`)}
            >
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>PLANNING</Text>
                <Ionicons name="calendar-outline" size={15} color="rgba(255,255,255,0.7)" />
              </View>
              <Text style={styles.planningInfo}>{'02/06\nDépart de Lyon'}</Text>
            </GlassCard>

          </View>

          {/* ── Row 2 : Map (full width) ── */}
          <TouchableOpacity
            style={styles.mapCard}
            onPress={() => router.push(`/trip/${id}/map`)}
            activeOpacity={0.85}
          >
            <BlurView intensity={35} tint="light" style={StyleSheet.absoluteFill} />
            <View style={styles.cardGlassOverlay} />

            {/* Map placeholder – tiled grid to evoke a map */}
            <View style={styles.mapGrid}>
              {[...Array(4)].map((_, i) => (
                <View
                  key={`h${i}`}
                  style={[styles.mapLine, { top: `${25 * (i + 1)}%` as any, width: '100%', height: 1 }]}
                />
              ))}
              {[...Array(5)].map((_, i) => (
                <View
                  key={`v${i}`}
                  style={[styles.mapLine, { left: `${20 * (i + 1)}%` as any, height: '100%', width: 1 }]}
                />
              ))}
              {/* Roads hint */}
              <View style={styles.mapRoad1} />
              <View style={styles.mapRoad2} />
            </View>

            {/* Pin */}
            <View style={styles.mapPinWrap}>
              <View style={styles.mapPinShadow} />
              <Ionicons name="location" size={30} color="#E8453C" />
            </View>

            {/* Label */}
            <View style={styles.mapLabelWrap}>
              <Ionicons name="map-outline" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={styles.mapLabel}>Rome, Italie</Text>
            </View>
          </TouchableOpacity>

          {/* ── Row 3 : Envies + Budget ── */}
          <View style={styles.row}>

            {/* Envies – with photo background */}
            <TouchableOpacity
              style={[styles.glassWrap, { flex: 1, minHeight: 115 }]}
              onPress={() => router.push(`/trip/${id}/envies`)}
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

            {/* Budget */}
            <GlassCard
              flex={1}
              minHeight={115}
              onPress={() => router.push(`/trip/${id}/budget`)}
            >
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

      {/* ── BOTTOM NAV ── */}
      <View
        style={[styles.bottomNav, { bottom: Math.max(insets.bottom, 10) + 16 }]}
        pointerEvents="box-none"
      >
        <NavButton icon="arrow-back-outline" onPress={() => router.back()} />
        <NavButton icon="add" iconSize={28} onPress={() => router.push('/trip/create')} />
        <NavButton icon="options-outline" />
      </View>

    </View>
  );
}

/* ─── Reusable glass card ────────────────────────────────────── */
function GlassCard({
  children,
  onPress,
  flex = 1,
  minHeight = 130,
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

/* ─── Styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D1B2A',
  },

  /* Background */
  bgDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,15,30,0.25)',
  },
  fg: {
    flex: 1,
  },

  /* ── Header ── */
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
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
    borderRadius: Radii.full,
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
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
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

  /* ── Scroll ── */
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },

  /* ── Glass card base ── */
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
  cardContent: {
    padding: Spacing.md,
    flex: 1,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  /* ── Documents ── */
  docList: {
    gap: 7,
    marginTop: Spacing.sm,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  docText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '500',
  },

  /* ── Planning ── */
  planningInfo: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
    fontWeight: '600',
    lineHeight: 20,
    marginTop: Spacing.sm,
  },

  /* ── Map ── */
  mapCard: {
    height: 145,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    ...Shadows.md,
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(140,185,170,0.30)',
  },
  mapLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  mapRoad1: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
  },
  mapRoad2: {
    position: 'absolute',
    left: '38%',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius: 2,
  },
  mapPinWrap: {
    position: 'absolute',
    top: '28%',
    left: '40%',
    alignItems: 'center',
  },
  mapPinShadow: {
    position: 'absolute',
    bottom: -2,
    width: 10,
    height: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  mapLabelWrap: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  mapLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
  },

  /* ── Envies ── */
  enviesEmpty: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },

  /* ── Budget ── */
  addCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 2,
  },
  budgetSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.60)',
    textAlign: 'center',
    fontWeight: '500',
  },

  /* ── Bottom nav ── */
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    // ancien placeholder supprimé — styles inutilisés ci-dessous conservés pour TS
  },
  tabBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tabCenter: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    ...Shadows.md,
  },
});
