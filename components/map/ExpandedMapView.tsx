import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Modal,
  useWindowDimensions,
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
import MapView, { Marker } from "react-native-maps";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

/* ─── Types ──────────────────────────────────────────────────── */
type ActivityStatus = 'validated' | 'debate' | 'pending';

interface Activity {
  id: number;
  name: string;
  category: string;
  lat: number;
  lng: number;
  status: ActivityStatus;
  image: string;
}

export interface CardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  cardLayout: CardLayout;
  onClose: () => void;
}

/* ─── Mock data ──────────────────────────────────────────────── */
const MOCK_ACTIVITIES: Activity[] = [
  { id: 1, name: 'Colisée',             category: '🏛️', lat: 41.8902, lng: 12.4922, status: 'validated', image: 'https://picsum.photos/200/200?random=1' },
  { id: 2, name: 'Trattoria Da Enzo',   category: '🍽️', lat: 41.8898, lng: 12.4767, status: 'validated', image: 'https://picsum.photos/200/200?random=2' },
  { id: 3, name: 'Fontaine de Trevi',   category: '📸', lat: 41.9009, lng: 12.4833, status: 'validated', image: 'https://picsum.photos/200/200?random=3' },
  { id: 4, name: 'Café Sant Eustachio', category: '☕',  lat: 41.8986, lng: 12.4768, status: 'debate',    image: 'https://picsum.photos/200/200?random=4' },
  { id: 5, name: 'Vatican',             category: '🏛️', lat: 41.9029, lng: 12.4534, status: 'pending',   image: 'https://picsum.photos/200/200?random=5' },
];

const STATUS_COLOR: Record<ActivityStatus, string> = {
  validated: '#22C55E',
  debate:    '#F97316',
  pending:   '#9CA3AF',
};

const STATUS_LABEL: Record<ActivityStatus, string> = {
  validated: '🟢 Validé',
  debate:    '🟠 En débat',
  pending:   '⚪ En attente',
};

const EASE_OUT = Easing.out(Easing.cubic);
const EASE_IN  = Easing.in(Easing.cubic);

/* ─── Component ──────────────────────────────────────────────── */
export function ExpandedMapView({ cardLayout, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();

  const progress       = useSharedValue(0);
  const headerProgress = useSharedValue(0);
  const sheetProgress  = useSharedValue(0);

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [filters, setFilters] = useState({ validated: true, debate: false, pending: false });

  useEffect(() => {
    progress.value       = withTiming(1, { duration: 400, easing: EASE_OUT });
    headerProgress.value = withDelay(260, withTiming(1, { duration: 280 }));
  }, []);

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

  const headerStyle = useAnimatedStyle(() => ({
    opacity:   headerProgress.value,
    transform: [{ translateY: interpolate(headerProgress.value, [0, 1], [-14, 0]) }],
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(sheetProgress.value, [0, 1], [400, 0]) }],
  }));

  /* ── Handlers ── */
  const clearSelectedActivity = () => setSelectedActivity(null);

  const handleMarkerPress = (activity: Activity) => {
    setSelectedActivity(activity);
    sheetProgress.value = withTiming(1, { duration: 320, easing: EASE_OUT });
  };

  const handleSheetClose = () => {
    sheetProgress.value = withTiming(0, { duration: 220, easing: EASE_IN }, () => {
      runOnJS(clearSelectedActivity)();
    });
  };

  const handleClose = () => {
    sheetProgress.value  = withTiming(0, { duration: 150 });
    headerProgress.value = withTiming(0, { duration: 180 });
    progress.value = withTiming(0, { duration: 360, easing: EASE_IN }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredActivities = MOCK_ACTIVITIES.filter(a =>
    a.status === 'validated' ? filters.validated :
    a.status === 'debate'    ? filters.debate    : filters.pending
  );

  const FILTER_BUTTONS: { key: keyof typeof filters; icon: string }[] = [
    { key: 'validated', icon: '🟢' },
    { key: 'debate',    icon: '🟠' },
    { key: 'pending',   icon: '⚪' },
  ];

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.hero, heroStyle]}>

        {/* ── Map ── */}
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={{ latitude: 41.9028, longitude: 12.4964, latitudeDelta: 0.3, longitudeDelta: 0.3 }}
          scrollEnabled
          zoomEnabled
          rotateEnabled
          pitchEnabled
        >
          {filteredActivities.map(activity => (
            <Marker
              key={activity.id}
              coordinate={{ latitude: activity.lat, longitude: activity.lng }}
              onPress={() => handleMarkerPress(activity)}
              tracksViewChanges={false}
            >
              <View style={styles.markerWrapper}>
                <Image
                  source={{ uri: activity.image }}
                  style={[styles.markerPhoto, { borderColor: STATUS_COLOR[activity.status] }]}
                />
                <Text style={styles.markerEmoji}>{activity.category}</Text>
              </View>
            </Marker>
          ))}
        </MapView>

        {/* ── Header ── */}
        <Animated.View style={[styles.header, { paddingTop: insets.top + 8 }, headerStyle]}>
          <TouchableOpacity style={styles.backBtn} onPress={handleClose} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={styles.filtersRow}>
            {FILTER_BUTTONS.map(({ key, icon }) => (
              <TouchableOpacity
                key={key}
                style={[styles.filterBtn, filters[key] && styles.filterBtnActive]}
                onPress={() => toggleFilter(key)}
                activeOpacity={0.8}
              >
                <Text style={styles.filterBtnIcon}>{icon}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* ── Bottom sheet ── */}
        {selectedActivity !== null && (
          <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }, sheetStyle]}>
            <View style={styles.sheetHandle} />
            <Image
              source={{ uri: selectedActivity.image }}
              style={styles.sheetImage}
              resizeMode="cover"
            />
            <View style={styles.sheetBody}>
              <Text style={styles.sheetEmoji}>{selectedActivity.category}</Text>
              <View style={styles.sheetInfo}>
                <Text style={styles.sheetName}>{selectedActivity.name}</Text>
                <Text style={styles.sheetStatus}>{STATUS_LABEL[selectedActivity.status]}</Text>
              </View>
              <TouchableOpacity style={styles.sheetCloseBtn} onPress={handleSheetClose} activeOpacity={0.8}>
                <Ionicons name="close" size={16} color="#666" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.sheetActionBtn} activeOpacity={0.85}>
              <Text style={styles.sheetActionText}>Voir dans le planning</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

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

  /* Header */
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderColor: 'rgba(255,255,255,0.55)',
  },
  filterBtnIcon: {
    fontSize: 18,
  },

  /* Markers */
  markerWrapper: {
    alignItems: 'center',
  },
  markerPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
  },
  markerEmoji: {
    fontSize: 14,
    marginTop: 2,
  },

  /* Bottom sheet */
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
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
  sheetCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
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
});
