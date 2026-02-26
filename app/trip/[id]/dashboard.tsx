import React, { useRef, useState, useCallback } from 'react';
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
import MapView, { Marker } from "react-native-maps";

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { ExpandedMapView, CardLayout } from '@/components/map/ExpandedMapView';
import { GlassCard } from '@/components/ui/GlassCard';
import { NavButton } from '@/components/ui/NavButton';


/* ─── Mock data ─────────────────────────────────────────────── */
const COVER_URL =
  'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800&q=80';
const ENVIE_IMG =
  'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=400&q=60';

const AVATARS = [
  { bg: '#E8C5A5', photo: 'https://i.pravatar.cc/64?img=5' },
  { bg: '#A5B8E0', photo: 'https://i.pravatar.cc/64?img=12' },
  { bg: '#A8D5B5', photo: 'https://i.pravatar.cc/64?img=23' },
];

const DOC_ITEMS = ["Passeport", "Billets d'avion", "Réservation"];

/* ─── Main screen ────────────────────────────────────────────── */
export default function DashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const mapCardRef = useRef<View>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mapCardLayout, setMapCardLayout] = useState<CardLayout>({ x: 0, y: 0, width: 0, height: 145 });

  const handleMapPress = useCallback(() => {
    mapCardRef.current?.measureInWindow((x, y, width, height) => {
      setMapCardLayout({ x, y, width, height });
      setIsMapExpanded(true);
    });
  }, []);

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
                >
                  <Image source={{ uri: a.photo }} style={styles.avatarImg} />
                </View>
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
              flex={1}
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
          <View ref={mapCardRef} collapsable={false}>
            <GlassCard height={145} noPadding onPress={handleMapPress}>
              <MapView
                style={StyleSheet.absoluteFill}
                initialRegion={{
                  latitude: 41.9028,
                  longitude: 12.4964,
                  latitudeDelta: 0.5,
                  longitudeDelta: 0.5,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <Marker coordinate={{ latitude: 41.9028, longitude: 12.4964 }} />
              </MapView>
              <View style={styles.mapLabelWrap}>
                <Ionicons name="map-outline" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.mapLabel}>Rome, Italie</Text>
              </View>
            </GlassCard>
          </View>

          {/* ── Row 3 : Envies + Budget ── */}
          <View style={styles.row}>

            {/* Envies – with photo background */}
            <GlassCard
              flex={1}
              minHeight={115}
              backgroundImageUri={ENVIE_IMG}
              onPress={() => router.push(`/trip/${id}/envies`)}
            >
              <Text style={styles.cardTitle}>VOS ENVIES</Text>
              <Text style={styles.enviesEmpty}>Espace vide</Text>
            </GlassCard>

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

      {isMapExpanded && (
        <ExpandedMapView
          cardLayout={mapCardLayout}
          onClose={() => setIsMapExpanded(false)}
          tripId={id}
        />
      )}

    </View>
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
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
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

  /* ── Card text styles ── */
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    fontWeight: '500',
  },

  /* ── Planning ── */
  planningInfo: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    lineHeight: 20,
    marginTop: Spacing.sm,
  },

  /* ── Map ── */
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
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },

  /* ── Envies ── */
  enviesEmpty: {
    fontSize: 12,
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
