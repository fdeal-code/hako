// HAKO — Carte noire « en ce moment » (dashboard pendant le voyage)
// Posée au-dessus des tuiles habituelles : l'activité en cours ou la
// prochaine (heure, compte à rebours, adresse ou billet). Un tap ouvre
// directement la ressource : le billet, sinon la page de l'activité ;
// quand plus rien n'est prévu, une envie à faire dans la ville du jour.
// « Y aller » lance l'itinéraire.

import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { OngoingTripState } from '@/hooks/useOngoingTrip';
import { countdown, Destination, directionsUrl, shortTime, toMinutes } from '@/utils/ongoingTrip';

export const NOW_CARD_HEIGHT = 92;
const GO_SIZE = 44;
const OS: 'ios' | 'android' | 'other' = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other';

export function NowCard({ tripId, ongoing: o }: { tripId: string; ongoing: OngoingTripState }) {
  const focus = o.focus;
  const current = o.schedule.current;
  const idea = focus ? null : o.ideas[0] ?? null;
  const ticket = focus ? o.focusTicket : null;

  const dest: Destination | null = focus
    ? { label: focus.title, address: focus.wish?.address ?? null, latitude: focus.wish?.latitude ?? null, longitude: focus.wish?.longitude ?? null }
    : idea ? { label: idea.title, address: idea.address, latitude: idea.latitude, longitude: idea.longitude } : null;
  const goUrl = dest ? directionsUrl(dest, OS) : null;

  const kicker = focus
    ? current
      ? `EN CE MOMENT${current.end_time ? ` · jusqu’à ${shortTime(current.end_time)}` : ''}`
      : `${shortTime(focus.start_time)} · ${countdown(o.now, toMinutes(focus.start_time) ?? o.now)}`
    : idea ? 'PLUS RIEN DE PRÉVU · DANS LE COIN' : 'QUARTIER LIBRE';
  const title = focus?.title ?? idea?.title ?? `Profitez de ${o.stop?.place_name ?? 'la journée'} !`;
  const sub = ticket
    ? [ticket.details?.from && ticket.details?.to ? `${ticket.details.from} → ${ticket.details.to}` : null, ticket.details?.seat]
      .filter(Boolean).join(' · ') || ticket.title
    : focus ? focus.wish?.address ?? o.stop?.place_name ?? ''
      : idea ? (idea.status === 'validated' ? 'Envie validée par le groupe' : 'Envie encore à voter')
        : 'Touche pour voir les idées Hako';

  const open = () => {
    if (ticket) router.push({ pathname: '/trip/[id]/document/[docId]', params: { id: tripId, docId: ticket.id } });
    else if (focus) router.push({ pathname: '/trip/[id]/planning-detail', params: { id: tripId, itemId: focus.id } });
    else if (idea) router.push({ pathname: '/trip/[id]/envies', params: { id: tripId, wish: idea.id } });
    else router.push({ pathname: '/trip/[id]/help', params: { id: tripId, tab: 'activities' } });
  };

  return (
    <TouchableOpacity style={styles.card} onPress={open} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={`${kicker}, ${title}`}>
      {!o.data ? <ActivityIndicator color={Colors.white} style={styles.loader} /> : (
        <>
          <View style={styles.text}>
            <View style={styles.kickerRow}>
              <Text style={styles.kicker} numberOfLines={1}>{kicker}</Text>
              <View style={styles.dayPill}><Text style={styles.dayPillText}>J{o.day.day}/{o.day.total}</Text></View>
            </View>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <View style={styles.subRow}>
              <Ionicons name={ticket ? 'ticket-outline' : 'location-outline'} size={12} color={Colors.textOnDark} />
              <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
            </View>
          </View>
          {goUrl ? (
            <TouchableOpacity style={styles.go} onPress={() => { void Linking.openURL(goUrl); }} accessibilityLabel="Y aller" hitSlop={6}>
              <Ionicons name="navigate" size={18} color={Colors.white} />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-forward" size={20} color={Colors.textOnDark} />
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    height: NOW_CARD_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2,
    paddingHorizontal: Spacing.md2, borderRadius: Radii.lg, backgroundColor: Colors.primary, ...Shadows.md,
  },
  loader: { flex: 1 },
  text: { flex: 1, gap: 2 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  kicker: { flex: 1, ...Typography.bodySmall, fontWeight: '700', color: Colors.accent },
  dayPill: { paddingHorizontal: Spacing.sm, paddingVertical: 1, borderRadius: Radii.full, backgroundColor: Colors.accent },
  dayPillText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  title: { ...Typography.cardTitle, color: Colors.white },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sub: { flex: 1, ...Typography.bodySmall, color: Colors.textOnDark },
  go: {
    width: GO_SIZE, height: GO_SIZE, borderRadius: Radii.full, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
});
