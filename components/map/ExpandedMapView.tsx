import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Modal,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '@/services/supabase';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  interpolate,
  Easing,

} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavButton } from '@/components/ui/NavButton';

/* ─── Types ──────────────────────────────────────────────────── */
export interface CardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  cardLayout: CardLayout;
  onClose: () => void;
  tripId?: string;
  destination?: string;
  region?: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
}

/* ─── Category → emoji ───────────────────────────────────────── */
const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: '🍽️',
  monument:   '🏛️',
  hotel:      '🏨',
  photo_spot: '📸',
  activity:   '🎯',
  bar:        '🍸',
  shop:       '🛍️',
  transport:  '✈️',
  autre:      '📍',
};

/* ─── Filter definitions ─────────────────────────────────────── */
type CategoryKey = 'restaurant' | 'monument' | 'photo' | 'cafe' | 'hotel';
type StatusKey   = 'validated' | 'debate' | 'pending';

const CATEGORY_FILTERS: { key: CategoryKey; icon: string; label: string; emoji: string }[] = [
  { key: 'restaurant', icon: '🍽️', label: 'Restaurants', emoji: '🍽️' },
  { key: 'monument',   icon: '🏛️', label: 'Monuments',   emoji: '🏛️' },
  { key: 'photo',      icon: '📸', label: 'Photo spots',  emoji: '📸' },
  { key: 'cafe',       icon: '☕', label: 'Cafés',        emoji: '☕' },
  { key: 'hotel',      icon: '🏨', label: 'Hôtels',       emoji: '🏨' },
];

const STATUS_FILTERS: { key: StatusKey; icon: string; label: string }[] = [
  { key: 'validated', icon: '🟢', label: 'Validées'   },
  { key: 'debate',    icon: '🟠', label: 'En débat'   },
  { key: 'pending',   icon: '⚪', label: 'En attente' },
];


const EASE_OUT = Easing.out(Easing.cubic);
const EASE_IN  = Easing.in(Easing.cubic);

/* ─── Component ──────────────────────────────────────────────── */
export function ExpandedMapView({ cardLayout, onClose, tripId, destination, region }: Props) {
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const mapRef = useRef<MapView>(null);

  const progress        = useSharedValue(0);
  const navProgress     = useSharedValue(0);
  const sheetProgress   = useSharedValue(0);
  const sheetTranslateY = useSharedValue(0);

  const [wishes,       setWishes]       = useState<any[]>([]);
  const [selectedWish, setSelectedWish] = useState<any | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<Record<CategoryKey, boolean>>({
    restaurant: true, monument: true, photo: true, cafe: true, hotel: true,
  });
  const [statusFilters, setStatusFilters] = useState<Record<StatusKey, boolean>>({
    validated: true, debate: true, pending: true,
  });

  useEffect(() => {
    progress.value    = withTiming(1, { duration: 400, easing: EASE_OUT });
    navProgress.value = withDelay(260, withTiming(1, { duration: 280 }));
  }, []);

  /* ── Load wishes with coordinates from Supabase (type='place' only) ── */
  const loadWishes = async () => {
    const { data, error } = await supabase
      .from('wishes')
      .select('*')
      .eq('trip_id', tripId)
      .eq('type', 'place')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);
    if (error) console.warn('[MAP] loadWishes error:', JSON.stringify(error));
    if (data) setWishes(data);
  };

  useEffect(() => {
    if (tripId) loadWishes();
  }, [tripId]);

  /* ── Centre la carte sur les markers ── */
  useEffect(() => {
    if (wishes.length === 0) return;
    const coords = wishes.map(w => ({ latitude: w.latitude, longitude: w.longitude }));
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
        animated: true,
      });
    }, 600);
  }, [wishes]);

  /* ── Animated styles ── */
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

  const bottomNavStyle = useAnimatedStyle(() => ({
    opacity:   navProgress.value,
    transform: [{ translateY: interpolate(navProgress.value, [0, 1], [20, 0]) }],
  }));

  const sheetStyle = useAnimatedStyle(() => {
    'worklet';
    const slideBase = interpolate(sheetProgress.value, [0, 1], [500, 0]);
    const swipeOffset = sheetTranslateY.value > 0 ? sheetTranslateY.value : 0;
    return {
      transform: [{ translateY: slideBase + swipeOffset }],
    };
  });

  /* ── Handlers ── */
  const handleMarkerPress = (wish: any) => {
    setSelectedWish(wish);
    sheetTranslateY.value = 0;
    sheetProgress.value = withTiming(1, { duration: 320, easing: EASE_OUT });
  };

  const dismissSheet = () => {
    sheetProgress.value = withTiming(0, { duration: 220, easing: EASE_IN });
    setTimeout(() => {
      sheetTranslateY.value = 0;
      setSelectedWish(null);
    }, 230);
  };

  const handleClose = () => {
    setShowFilters(false);
    sheetProgress.value = withTiming(0, { duration: 150 });
    navProgress.value   = withTiming(0, { duration: 180 });
    progress.value      = withTiming(0, { duration: 360, easing: EASE_IN });
    setTimeout(onClose, 370);
  };

  /* ── Swipe-to-dismiss (PanResponder — works inside Modal without GestureHandlerRootView) ── */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 4 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) sheetTranslateY.value = gs.dy;
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.8) {
          dismissSheet();
        } else {
          sheetTranslateY.value = withTiming(0, { duration: 200 });
        }
      },
    })
  ).current;

  /* ── Filter helpers ── */
  const toggleCategory = (key: CategoryKey) =>
    setCategories(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleStatus = (key: StatusKey) =>
    setStatusFilters(prev => ({ ...prev, [key]: !prev[key] }));

  const filteredWishes = wishes.filter(w => {
    const statusMatch =
      (w.status === 'validated' && statusFilters.validated) ||
      (w.status === 'debate'    && statusFilters.debate)    ||
      (w.status === 'pending'   && statusFilters.pending);
    return statusMatch;
  });

  const BOTTOM = Math.max(insets.bottom, 10) + 16;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.hero, heroStyle]}>

        {/* ── Label destination (top-center) ── */}
        <Animated.View style={[styles.destLabel, { top: insets.top + 16 }, bottomNavStyle]} pointerEvents="none">
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <Text style={styles.destLabelText}>{destination}</Text>
        </Animated.View>

        {/* ── Map ── */}
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude:      region?.latitude  ?? 48.8566,
            longitude:     region?.longitude ?? 2.3522,
            latitudeDelta:  0.3,
            longitudeDelta: 0.3,
          }}
          scrollEnabled
          zoomEnabled
          rotateEnabled
          pitchEnabled
        >
          {filteredWishes.map(wish => {
            const borderColor =
              wish.status === 'validated' ? '#22C55E' :
              wish.status === 'debate'    ? '#F97316' : '#9CA3AF';
            const emoji =
              wish.category === 'restaurant' ? '🍽️' :
              wish.category === 'monument'   ? '🏛️' :
              wish.category === 'cafe'       ? '☕'  :
              wish.category === 'hotel'      ? '🏨' :
              wish.category === 'activity'   ? '🎭' :
              wish.category === 'photo_spot' ? '📸' :
              wish.category === 'bar'        ? '🍺' : '📍';
            return (
              <Marker
                key={wish.id}
                coordinate={{ latitude: wish.latitude, longitude: wish.longitude }}
                onPress={() => handleMarkerPress(wish)}
                tracksViewChanges={false}
              >
                <View style={{ alignItems: 'center' }}>
                  <View style={{
                    width: 52, height: 52, borderRadius: 26,
                    borderWidth: 4, borderColor,
                    overflow: 'hidden', backgroundColor: '#E5E7EB',
                  }}>
                    {wish.image_url ? (
                      <Image source={{ uri: wish.image_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 20 }}>{emoji}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{
                    backgroundColor: 'white', paddingHorizontal: 8, paddingVertical: 3,
                    borderRadius: 10, marginTop: 4,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.2, shadowRadius: 2,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '600' }} numberOfLines={1}>{wish.title}</Text>
                  </View>
                </View>
              </Marker>
            );
          })}
        </MapView>

        {/* ── Tap-outside to close filters ── */}
        {showFilters && (
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowFilters(false)}
          />
        )}

        {/* ── Filter panel (glassmorphism) ── */}
        {showFilters && (
          <View style={[styles.filterPanel, { bottom: BOTTOM + 64 + 12 }]}>
            <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.30)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Section : Catégories */}
            <Text style={styles.filterSectionTitle}>Catégories</Text>
            <View style={styles.filterChipsWrap}>
              {CATEGORY_FILTERS.map(({ key, icon, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.filterChip, categories[key] && styles.filterChipActive]}
                  onPress={() => toggleCategory(key)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.filterChipText, categories[key] && styles.filterChipTextActive]}>
                    {icon} {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Séparateur */}
            <View style={styles.filterSep} />

            {/* Section : Statut */}
            <Text style={styles.filterSectionTitle}>Statut</Text>
            <View style={styles.filterChipsWrap}>
              {STATUS_FILTERS.map(({ key, icon, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.filterChip, statusFilters[key] && styles.filterChipActive]}
                  onPress={() => toggleStatus(key)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.filterChipText, statusFilters[key] && styles.filterChipTextActive]}>
                    {icon} {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Bottom sheet ── */}
        {selectedWish != null && (
          <Animated.View
            style={[styles.sheet, { paddingBottom: insets.bottom + 16 }, sheetStyle]}
            {...panResponder.panHandlers}
          >
            <View style={styles.sheetHandle} />
            {(selectedWish.image_url ?? selectedWish.cover_url) ? (
              <Image
                source={{ uri: selectedWish.image_url ?? selectedWish.cover_url }}
                style={styles.sheetImage}
                resizeMode="cover"
              />
            ) : null}
            <View style={styles.sheetBody}>
              <Text style={styles.sheetEmoji}>
                {CATEGORY_EMOJI[selectedWish.category ?? ''] ?? '📍'}
              </Text>
              <View style={styles.sheetInfo}>
                <Text style={styles.sheetName}>{selectedWish.title}</Text>
                <Text style={styles.sheetStatus}>
                  {selectedWish.status === 'validated' ? '🟢 Validée' :
                   selectedWish.status === 'debate'    ? '🟠 En débat' : '⚪ En attente'}
                </Text>
                {selectedWish.address ? (
                  <Text style={[styles.sheetStatus, { marginTop: 2 }]} numberOfLines={1}>
                    📍 {selectedWish.address}
                  </Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity style={styles.sheetActionBtn} onPress={dismissSheet} activeOpacity={0.85}>
              <Text style={styles.sheetActionText}>Fermer</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Bottom nav — même layout que le Dashboard ── */}
        {/*    gap: 92 = 14 + 64 + 14 → back et filtre aux mêmes x que Dashboard */}
        <Animated.View
          style={[styles.bottomNav, { bottom: BOTTOM }, bottomNavStyle]}
          pointerEvents="box-none"
        >
          <NavButton icon="arrow-back-outline" onPress={handleClose} />

          {/* Spacer invisible — même slot que le bouton add du Dashboard */}
          <View style={styles.navSpacer} />

          <NavButton icon="options-outline" onPress={() => setShowFilters(v => !v)} />
        </Animated.View>

      </Animated.View>
    </Modal>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  hero: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: '#1C2B3A',
  },

  /* ── Label destination ── */
  destLabel: {
    position: 'absolute',
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 99,
    paddingHorizontal: 20,
    paddingVertical: 8,
    zIndex: 20,
  },
  destLabelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* ── Markers ── */
  markerWrapper: {
    alignItems: 'center',
  },
  markerPhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 4,
  },
  markerEmoji: {
    fontSize: 14,
    marginTop: 2,
  },

  /* ── Bottom sheet ── */
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    zIndex: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  sheetImage: {
    width: '100%',
    height: 150,
  },
  sheetBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 12,
  },
  sheetEmoji: {
    fontSize: 28,
  },
  sheetInfo: {
    flex: 1,
  },
  sheetName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A2E',
    letterSpacing: -0.3,
  },
  sheetStatus: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  sheetActionBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },

  /* ── Bottom nav ── */
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    zIndex: 10,
  },
  navSpacer: {
    width: 116,
  },


  /* ── Filter panel ── */
  filterPanel: {
    position: 'absolute',
    right: 16,
    width: 260,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    padding: 16,
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 14,
  },
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  filterChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderColor: 'rgba(255,255,255,0.95)',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  filterChipTextActive: {
    color: '#1A1A2E',
  },
  filterSep: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginVertical: 12,
  },
});
