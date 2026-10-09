// HAKO — Accueil : grande carte d'un voyage (maquette « Accueil · Actif »)
// Sert au voyage en vedette et à la liste « Tout voir » (à venir, en cours,
// terminé).
// Photo, compte à rebours J-x, avatars, nom en Bricolage, itinéraire, et
// LA prochaine action (« 3 envies attendent ton vote → »).

import { useRef } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Colors, Fonts, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { Trip } from '@/constants/types';
import { useTripCardMeta } from '@/hooks/useTripCardMeta';
import { localDayIso, nightsBetween } from '@/utils/tripStops';
import { CardLayout } from '@/components/home/ExpandedDashboard';

interface NextTripCardProps {
  trip: Trip;
  onExpand: (layout: CardLayout) => void;
}

const CARD_HEIGHT = 236;
const AVATAR = 32;
const GRADIENT: [string, string] = ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.65)'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function shortDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${String(d ?? '').padStart(2, '0')} ${MONTHS_SHORT[(m ?? 1) - 1] ?? ''}`;
}

export function NextTripCard({ trip, onExpand }: NextTripCardProps) {
  const ref = useRef<View>(null);
  const { members, toVoteCount } = useTripCardMeta(trip.id, true);
  const today = localDayIso(new Date());
  const past = trip.end_date < today;
  const ongoing = !past && trip.start_date <= today;
  const countdown = past ? 'Terminé' : ongoing ? 'En cours' : `J-${nightsBetween(today, trip.start_date)}`;
  const showVotes = !past && toVoteCount > 0;

  const expand = () => {
    ref.current?.measureInWindow((x, y, width, height) => onExpand({ x, y, width, height }));
  };

  return (
    <View ref={ref} collapsable={false}>
      <TouchableOpacity style={styles.card} onPress={expand} activeOpacity={0.92}>
        {trip.cover_url
          ? <Image source={{ uri: trip.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, styles.coverEmpty]} />}
        <LinearGradient colors={GRADIENT} style={StyleSheet.absoluteFill} />

        <View style={styles.top}>
          <View style={[styles.countdown, past && styles.countdownPast]}>
            <Text style={[styles.countdownText, past && styles.countdownTextPast]}>{countdown}</Text>
          </View>
          <View style={styles.avatars}>
            {members.map((m, i) => (
              <View key={m.user_id} style={[styles.avatar, i > 0 && styles.avatarOverlap]}>
                {m.avatar_url
                  ? <Image source={{ uri: m.avatar_url }} style={styles.avatarImg} />
                  : <Text style={styles.avatarInitial}>{(m.nickname ?? '?')[0]?.toUpperCase()}</Text>}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.name} adjustsFontSizeToFit numberOfLines={1}>{trip.name.toUpperCase()}</Text>
          <Text style={styles.route} numberOfLines={1}>
            {shortDay(trip.start_date)} → {shortDay(trip.end_date)} · {trip.destination}
          </Text>
          <TouchableOpacity
            style={styles.action}
            onPress={() => router.push(showVotes ? `/trip/${trip.id}/envies` : `/trip/${trip.id}/dashboard`)}
            activeOpacity={0.85}
          >
            {showVotes && (
              <View style={styles.actionIcon}>
                <Ionicons name="thumbs-up" size={13} color={Colors.textInverted} />
              </View>
            )}
            <Text style={styles.actionText} numberOfLines={1}>
              {showVotes
                ? `${toVoteCount} envie${toVoteCount > 1 ? 's' : ''} attend${toVoteCount > 1 ? 'ent' : ''} ton vote`
                : past ? 'Revoir les souvenirs' : 'Ouvrir le voyage'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT, borderRadius: Radii.pill, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.primary, padding: Spacing.md,
    justifyContent: 'space-between', ...Shadows.md,
  },
  coverEmpty: { backgroundColor: Colors.primary },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countdown: { paddingHorizontal: Spacing.md - 2, paddingVertical: Spacing.sm, borderRadius: Radii.full, backgroundColor: Colors.accent },
  countdownPast: { backgroundColor: Colors.glassLight },
  countdownText: { ...Typography.body, fontWeight: '600', color: Colors.white },
  countdownTextPast: { color: Colors.textPrimary },
  avatars: { flexDirection: 'row' },
  avatar: {
    width: AVATAR, height: AVATAR, borderRadius: Radii.full, overflow: 'hidden',
    borderWidth: 1.5, borderColor: Colors.white, backgroundColor: Colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarOverlap: { marginLeft: -8 },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  bottom: { gap: Spacing.sm2 - 2 },
  name: { fontFamily: Fonts.displayBold, fontSize: 56, color: Colors.white },
  route: { fontSize: 13, fontWeight: '600', color: Colors.white },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2 - 2,
    paddingHorizontal: Spacing.sm2, paddingVertical: Spacing.sm2 - 2,
    borderRadius: Radii.full, backgroundColor: Colors.background,
  },
  actionIcon: { width: 24, height: 24, borderRadius: Radii.full, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1, ...Typography.body, fontWeight: '600', color: Colors.textPrimary },
});
