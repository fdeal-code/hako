import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from "react-native-maps";

import { Spacing } from '@/constants/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { NavButton } from '@/components/ui/NavButton';
import { Trip } from '@/constants/types';

/* ─── Constants ──────────────────────────────────────────────── */
const ENVIE_IMG =
  'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=400&q=60';
const DOC_ITEMS = ["Passeport", "Billets d'avion", "Réservation"];
const AVATAR_BG = ['#E8C5A5', '#A5B8E0', '#A8D5B5', '#F0B0B0'];
const EASE_OUT = Easing.out(Easing.cubic);
const EASE_IN = Easing.in(Easing.cubic);

/* ─── Helpers ────────────────────────────────────────────────── */
function formatDateLabel(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const M = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${M[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${M[s.getMonth()]} – ${M[e.getMonth()]} ${e.getFullYear()}`;
}

/* ─── TripDashboardOverlay ───────────────────────────────────── */
export function TripDashboardOverlay({
  trip,
  onClose,
}: {
  trip: Trip;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const headerProgress = useSharedValue(0);
  const bentoProgress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 480, easing: EASE_OUT });
    headerProgress.value = withDelay(180, withTiming(1, { duration: 300 }));
    bentoProgress.value = withDelay(340, withTiming(1, { duration: 350 }));
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.90, 1]) }],
  }));

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerProgress.value,
    transform: [{ translateY: interpolate(headerProgress.value, [0, 1], [-10, 0]) }],
  }));

  const bentoStyle = useAnimatedStyle(() => ({
    opacity: bentoProgress.value,
    transform: [{ translateY: interpolate(bentoProgress.value, [0, 1], [28, 0]) }],
  }));

  const handleClose = () => {
    bentoProgress.value = withTiming(0, { duration: 120 });
    headerProgress.value = withTiming(0, { duration: 180 });
    progress.value = withTiming(
      0,
      { duration: 380, easing: EASE_IN },
      (finished) => {
        if (finished) runOnJS(onClose)();
      }
    );
  };

  const dateLabel = formatDateLabel(trip.start_date, trip.end_date);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.root, containerStyle]}>

        {/* Background image — même photo que la card */}
        <Image
          source={
            trip.cover_url
              ? { uri: trip.cover_url }
              : require('@/assets/images/icon.png')
          }
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <View style={styles.bgDim} />

        {/* Foreground */}
        <View style={[styles.fg, { paddingTop: insets.top }]}>

          {/* ── Header ── */}
          <Animated.View style={[styles.header, headerStyle]}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.destText}>{trip.destination.toUpperCase()}</Text>

            <View style={styles.headerMeta}>
              <BlurView intensity={50} tint="dark" style={styles.dateBadge}>
                <Text style={styles.dateBadgeText}>{dateLabel}</Text>
              </BlurView>

              <View style={styles.avatarsRow}>
                {trip.members.slice(0, 3).map((m, i) => (
                  <View
                    key={m.user_id}
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: AVATAR_BG[i % AVATAR_BG.length],
                        marginLeft: i > 0 ? -9 : 0,
                        zIndex: 10 - i,
                      },
                    ]}
                  >
                    {m.user.avatar_url && (
                      <Image source={{ uri: m.user.avatar_url }} style={styles.avatarImg} />
                    )}
                  </View>
                ))}
                <TouchableOpacity style={styles.addMemberBtn} activeOpacity={0.8}>
                  <Ionicons name="add" size={13} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* ── Bento grid ── */}
          <Animated.View style={[{ flex: 1 }, bentoStyle]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.scroll,
                { paddingBottom: insets.bottom + 110 },
              ]}
            >

              {/* Row 1 : Documents + Planning */}
              <View style={styles.row}>
                <GlassCard
                  flex={1}
                  minHeight={140}
                  onPress={() => router.push(`/trip/${trip.id}/documents`)}
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

                <GlassCard
                  flex={1}
                  minHeight={140}
                  onPress={() => router.push(`/trip/${trip.id}/planning`)}
                >
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>PLANNING</Text>
                    <Ionicons name="calendar-outline" size={15} color="rgba(255,255,255,0.7)" />
                  </View>
                  <Text style={styles.planningInfo}>{'02/06\nDépart de Lyon'}</Text>
                </GlassCard>
              </View>

              {/* Row 2 : Map */}
              <GlassCard height={145} noPadding onPress={() => router.push(`/trip/${trip.id}/map`)}>
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

              {/* Row 3 : Envies + Budget */}
              <View style={styles.row}>
                <GlassCard
                  flex={1}
                  minHeight={115}
                  backgroundImageUri={ENVIE_IMG}
                  onPress={() => router.push(`/trip/${trip.id}/envies`)}
                >
                  <Text style={styles.cardTitle}>VOS ENVIES</Text>
                  <Text style={styles.enviesEmpty}>Espace vide</Text>
                </GlassCard>

                <GlassCard
                  flex={1}
                  minHeight={115}
                  onPress={() => router.push(`/trip/${trip.id}/budget`)}
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

        {/* Bottom nav */}
        <View
          style={[styles.bottomNav, { bottom: Math.max(insets.bottom, 10) + 16 }]}
          pointerEvents="box-none"
        >
          <NavButton icon="arrow-back-outline" onPress={handleClose} />
          <NavButton icon="add" iconSize={28} onPress={() => router.push('/trip/create')} />
          <NavButton icon="options-outline" />
        </View>

      </Animated.View>
    </Modal>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D1B2A',
  },
  bgDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,15,30,0.25)',
  },
  fg: {
    flex: 1,
  },

  /* Header */
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

  /* Scroll / Bento */
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },

  /* Card text styles */
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

  /* Documents */
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

  /* Planning */
  planningInfo: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    lineHeight: 20,
    marginTop: Spacing.sm,
  },

  /* Map */
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
    borderRadius: 9999,
  },
  mapLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },

  /* Envies */
  enviesEmpty: {
    fontSize: 12,
    color: '#FFFFFF',
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },

  /* Budget */
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

  /* Bottom nav */
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
});
