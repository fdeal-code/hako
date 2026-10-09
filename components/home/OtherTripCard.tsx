// HAKO — Accueil : petite carte « Tes autres voyages » (maquette « Accueil · Actif »)

import { useRef } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Fonts, Radii, Spacing } from '@/constants/theme';
import { Trip } from '@/constants/types';
import { localDayIso } from '@/utils/tripStops';
import { CardLayout } from '@/components/home/ExpandedDashboard';

const CARD_HEIGHT = 100;
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function monthYear(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1] ?? ''} ${y ?? ''}`;
}

export function OtherTripCard({ trip, onExpand }: { trip: Trip; onExpand: (layout: CardLayout) => void }) {
  const ref = useRef<View>(null);
  const today = localDayIso(new Date());
  const tag = trip.end_date < today ? 'Terminé' : trip.start_date <= today ? 'En cours' : null;

  return (
    <View ref={ref} collapsable={false} style={styles.wrap}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => ref.current?.measureInWindow((x, y, width, height) => onExpand({ x, y, width, height }))}
        activeOpacity={0.9}
      >
        {trip.cover_url
          ? <Image source={{ uri: trip.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, styles.coverEmpty]} />}
        <View style={styles.dim} />
        <View style={styles.top}>
          {tag && <View style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>}
        </View>
        <View>
          <Text style={styles.name} numberOfLines={1}>{trip.name}</Text>
          <Text style={styles.sub}>{monthYear(trip.start_date)}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexBasis: 0 },
  card: {
    height: CARD_HEIGHT, borderRadius: Radii.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.primary, padding: Spacing.sm2, justifyContent: 'space-between',
  },
  coverEmpty: { backgroundColor: Colors.primary },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  top: { flexDirection: 'row' },
  tag: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radii.full, backgroundColor: Colors.accent },
  tagText: { fontSize: 11, fontWeight: '600', color: Colors.white },
  name: { fontFamily: Fonts.displayBold, fontSize: 20, color: Colors.white },
  sub: { fontSize: 11, fontWeight: '500', color: Colors.white },
});
