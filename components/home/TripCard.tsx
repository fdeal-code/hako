import { useRef, useState, useEffect } from 'react';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Radii, Spacing } from '@/constants/theme';
import { Trip } from '@/constants/types';
import { supabase } from '@/services/supabase';
import { CardLayout } from './ExpandedDashboard';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { Ionicons } from '@expo/vector-icons';
import { nightsBetween } from '@/utils/tripStops';

interface MemberDisplay {
  user_id: string;
  name: string;
  avatar_url?: string;
}

/* ─── Tokens ─────────────────────────────────────────────────── */
const DEST_GRADIENT: [string, string] = [
  'rgba(255,255,255,1.0)',
  'rgba(255,255,255,0.10)',
];
const PRESS_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

/* ─── Helpers ────────────────────────────────────────────────── */
function formatDateLabel(start: string): string {
  const monthYear = new Date(start).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
  return monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
}

/* ─── Badge — DA V2 : pills opaques ──────────────────────────── */
type BadgeVariant = 'next' | 'future' | 'ongoing' | 'past';

const BADGE_STYLES: Record<BadgeVariant, { pill: object; text: object }> = {
  next:    { pill: { backgroundColor: Colors.accent },     text: { color: Colors.white } },
  future:  { pill: { backgroundColor: Colors.background }, text: { color: Colors.textPrimary } },
  ongoing: { pill: { backgroundColor: 'rgba(34,197,94,0.90)' }, text: { color: Colors.white } },
  past:    { pill: { backgroundColor: 'rgba(110,110,110,0.85)' }, text: { color: Colors.white, opacity: 0.85 } },
};

function Badge({ label, variant = 'future' }: { label: string; variant?: BadgeVariant }) {
  const v = BADGE_STYLES[variant];
  return (
    <View style={[styles.badge, v.pill]}>
      <Text style={[styles.badgeText, v.text]}>{label}</Text>
    </View>
  );
}

/* ─── Helpers statut ─────────────────────────────────────────── */
function getTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateBadgeVariant(trip: Trip): BadgeVariant {
  if (!trip.start_date || !trip.end_date) return 'future';
  const today = getTodayISO();
  if (trip.end_date < today) return 'past';
  if (trip.start_date <= today) return 'ongoing';
  return 'future';
}

/* ─── TripCard ───────────────────────────────────────────────── */
export function TripCard({
  trip,
  onExpand,
  isNextTrip = false,
}: {
  trip: Trip;
  onExpand: (layout: CardLayout) => void;
  isNextTrip?: boolean;
}) {
  const dateLabel        = formatDateLabel(trip.start_date);
  const isNext           = isNextTrip;
  const dateBadgeVariant = getDateBadgeVariant(trip);
  const isPast           = dateBadgeVariant === 'past';
  const isFuture         = dateBadgeVariant === 'future';
  const daysLeft         = isFuture && trip.start_date ? nightsBetween(getTodayISO(), trip.start_date) : null;

  /* Prochaine action : envies qui attendent un vote */
  const [toVoteCount, setToVoteCount] = useState(0);
  useEffect(() => {
    if (isPast) return;
    supabase.from('wishes').select('id', { count: 'exact', head: true })
      .eq('trip_id', trip.id).in('status', ['pending', 'debate'])
      .then(({ count }) => setToVoteCount(count ?? 0));
  }, [trip.id, isPast]);

  /* Fetch real members */
  const [localMembers, setLocalMembers] = useState<MemberDisplay[]>([]);
  useEffect(() => {
    const loadMembers = async () => {
      const { data: membersList } = await supabase
        .from('trip_members')
        .select('user_id')
        .eq('trip_id', trip.id)
        .limit(4);
      if (!membersList) return;
      const display: MemberDisplay[] = [];
      for (const m of membersList) {
        const { data } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_url')
          .eq('id', m.user_id)
          .single();
        display.push({
          user_id:    m.user_id,
          name:       data?.nickname ?? 'Membre',
          avatar_url: data?.avatar_url ?? undefined,
        });
      }
      setLocalMembers(display);
    };
    loadMembers();
  }, [trip.id]);

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
    <View ref={cardRef} style={isPast ? { opacity: 0.6 } : undefined}>
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
                {isNext && (
                  <Badge
                    label={daysLeft !== null ? `Prochain voyage · J-${daysLeft}` : 'Prochain voyage'}
                    variant="next"
                  />
                )}
                <View style={{ flex: 1 }} />
                <Badge label={dateLabel} variant={dateBadgeVariant} />
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
                  {trip.name.toUpperCase()}
                </Text>
              </MaskedView>

              <View style={styles.bottomRow}>
                <View style={styles.avatarsRow}>
                  {localMembers.slice(0, 3).map((m, i) => (
                    <MemberAvatar
                      key={m.user_id}
                      member={{ avatar_url: m.avatar_url, nickname: m.name }}
                      size={36}
                      index={i}
                    />
                  ))}
                </View>
                {toVoteCount > 0 && (
                  <View style={styles.nextAction}>
                    <Ionicons name="thumbs-up" size={13} color={Colors.accent} />
                    <Text style={styles.nextActionText}>
                      {toVoteCount} envie{toVoteCount > 1 ? 's' : ''} à voter
                    </Text>
                  </View>
                )}
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
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  content: { flex: 1, padding: 20 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  badge: {
    overflow: 'hidden',
    borderRadius: 99,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  badgeText: { fontSize: 14, fontWeight: '600' },
  destinationMask: { alignSelf: 'stretch', marginBottom: 16 },
  destination: {
    fontSize: 100,
    fontWeight: '900',
    color: Colors.white,
    textAlign: 'center',
    letterSpacing: 3,
  },
  avatarsRow: { flexDirection: 'row', alignItems: 'center' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm2,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    backgroundColor: Colors.background,
  },
  nextActionText: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.white,
    overflow: 'hidden',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
