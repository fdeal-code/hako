import { useRef } from 'react';
import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { Trip } from '@/constants/types';
import { CardLayout } from './ExpandedDashboard';

/* ─── Tokens ─────────────────────────────────────────────────── */
const BADGE_COLORS: [string, string] = [
  'rgba(255,255,255,0.50)',
  'rgba(255,255,255,0.15)',
];
const DEST_GRADIENT: [string, string] = [
  'rgba(255,255,255,1.0)',
  'rgba(255,255,255,0.10)',
];
const AVATAR_BG = ['#E8C5A5', '#A5B8E0', '#A8D5B5', '#F0B0B0'];
const PRESS_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

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

/* ─── Badge ──────────────────────────────────────────────────── */
function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={BADGE_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

/* ─── TripCard ───────────────────────────────────────────────── */
export function TripCard({
  trip,
  onExpand,
}: {
  trip: Trip;
  onExpand: (layout: CardLayout) => void;
}) {
  const dateLabel = formatDateLabel(trip.start_date, trip.end_date);
  const isNext    = trip.status === 'future';
  const members   = trip.members.slice(0, 3);

  /* ref sur la View native pour mesurer la position écran */
  const cardRef = useRef<View>(null);

  const cardScale       = useSharedValue(1);
  const elementsOpacity = useSharedValue(1);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));
  const elementsStyle = useAnimatedStyle(() => ({
    opacity: elementsOpacity.value,
  }));

  const handlePress = () => {
    /* Feedback tactile : légère scale + fade des badges */
    elementsOpacity.value = withTiming(0, { duration: 180 });
    cardScale.value = withTiming(1.04, { duration: 220, easing: PRESS_EASING });

    /* Mesure la position de la card sur l'écran puis ouvre l'overlay */
    cardRef.current?.measureInWindow((x, y, width, height) => {
      onExpand({ x, y, width, height });
      /* Reset après que l'overlay couvre la card */
      setTimeout(() => {
        cardScale.value       = 1;
        elementsOpacity.value = 1;
      }, 300);
    });
  };

  return (
    /* View native pour measureInWindow */
    <View ref={cardRef}>
      <Animated.View style={[styles.card, cardStyle]}>
        <TouchableOpacity onPress={handlePress} activeOpacity={1} style={StyleSheet.absoluteFill}>

          {/* Cover image */}
          <Image
            source={
              trip.cover_url
                ? { uri: trip.cover_url }
                : require('@/assets/images/icon.png')
            }
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />

          {/* Badges, destination, avatars — fondent lors du press */}
          <Animated.View style={[StyleSheet.absoluteFill, elementsStyle]}>
            <View style={styles.overlay} />
            <View style={styles.content}>
              <View style={styles.topRow}>
                {isNext && <Badge label="Prochain voyage" />}
                <View style={{ flex: 1 }} />
                <Badge label={dateLabel} />
              </View>

              <View style={{ flex: 1 }} />

              <MaskedView
                style={styles.destinationMask}
                maskElement={
                  <LinearGradient
                    colors={DEST_GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                }
              >
                <Text style={styles.destination} adjustsFontSizeToFit numberOfLines={1}>
                  {trip.destination.toUpperCase()}
                </Text>
              </MaskedView>

              <View style={styles.avatarsRow}>
                {members.map((m, i) => (
                  <View
                    key={m.user_id}
                    style={[
                      styles.avatar,
                      {
                        marginLeft: i > 0 ? -10 : 0,
                        zIndex: members.length - i,
                        backgroundColor: AVATAR_BG[i % AVATAR_BG.length],
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          </Animated.View>

        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  card: {
    height: 400,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  content: { flex: 1, padding: 20 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  badge: {
    overflow: 'hidden',
    borderRadius: 99,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,1)',
  },
  badgeText: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  destinationMask: { alignSelf: 'stretch', marginBottom: 16 },
  destination: {
    fontSize: 100,
    fontWeight: '900',
    color: Colors.white,
    textAlign: 'center',
    letterSpacing: 3,
  },
  avatarsRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.white,
  },
});
