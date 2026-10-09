// HAKO — Accueil : invitation en attente (maquette « Accueil · Actif »)

import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { PendingInvitation } from '@/types/inbox';

const LEAD = 40;
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function shortDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d ?? ''} ${MONTHS_SHORT[(m ?? 1) - 1] ?? ''}`;
}

interface InvitationBannerProps {
  invitation: PendingInvitation;
  busy: boolean;
  onJoin: () => void;
  onDecline: () => void;
}

export function InvitationBanner({ invitation, busy, onJoin, onDecline }: InvitationBannerProps) {
  const trip = invitation.trips;
  return (
    <View style={styles.card}>
      {trip.cover_image_url
        ? <Image source={{ uri: trip.cover_image_url }} style={styles.lead} />
        : <View style={[styles.lead, styles.leadEmpty]}><Ionicons name="airplane" size={18} color={Colors.textInverted} /></View>}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>{trip.name}</Text>
        <Text style={styles.sub} numberOfLines={1}>Invitation · {shortDay(trip.start_date)} → {shortDay(trip.end_date)}</Text>
      </View>
      <TouchableOpacity style={styles.join} onPress={onJoin} disabled={busy} activeOpacity={0.85}>
        <Text style={styles.joinText}>{busy ? '…' : 'Rejoindre'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.decline} onPress={onDecline} disabled={busy} accessibilityLabel="Refuser l’invitation">
        <Ionicons name="close" size={14} color={Colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2,
    padding: Spacing.sm2, borderRadius: Radii.lg,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.accent, backgroundColor: Colors.background,
  },
  lead: { width: LEAD, height: LEAD, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.primary },
  leadEmpty: { backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '600', color: Colors.textInk },
  sub: { ...Typography.bodySmall, color: Colors.textMuted },
  join: { paddingHorizontal: Spacing.sm2, paddingVertical: Spacing.sm, borderRadius: Radii.full, backgroundColor: Colors.accent },
  joinText: { fontSize: 13, fontWeight: '600', color: Colors.white },
  decline: {
    width: 32, height: 32, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});
