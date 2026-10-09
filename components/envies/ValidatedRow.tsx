// HAKO — Envies : ligne d'envie validée (maquette « Envies · Validées »)
// Vignette + titre + type, et un statut cliquable :
// Réservé · date planifiée · + Planifier · Réserver ↗ · Écartée.

import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type ValidatedStatusKind = 'booked' | 'planned' | 'plan' | 'book' | 'rejected';

interface ValidatedRowProps {
  title: string;
  subtitle: string;
  imageUri: string | null;
  status: { kind: ValidatedStatusKind; label: string };
  onPress: () => void;
  onStatusPress?: () => void;
}

const THUMB = 52;

const STATUS_STYLE: Record<ValidatedStatusKind, { icon: IoniconName; iconRight?: boolean; filled: string | null; color: string }> = {
  booked:   { icon: 'checkmark',     filled: Colors.accent,  color: Colors.textInverted },
  planned:  { icon: 'calendar-outline', filled: Colors.primary, color: Colors.textInverted },
  plan:     { icon: 'add',           filled: null,           color: Colors.accent },
  book:     { icon: 'open-outline',  iconRight: true, filled: null, color: Colors.accent },
  rejected: { icon: 'close',         filled: null,           color: Colors.textMuted },
};

export function ValidatedRow({ title, subtitle, imageUri, status, onPress, onStatusPress }: ValidatedRowProps) {
  const st = STATUS_STYLE[status.kind];
  const pill = (
    <View style={[
      styles.pill,
      st.filled ? { backgroundColor: st.filled } : { borderWidth: 1, borderColor: st.color, backgroundColor: Colors.background },
    ]}>
      {!st.iconRight && <Ionicons name={st.icon} size={13} color={st.color} />}
      <Text style={[styles.pillText, { color: st.color }]}>{status.label}</Text>
      {st.iconRight && <Ionicons name={st.icon} size={12} color={st.color} />}
    </View>
  );

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.9}>
      {imageUri
        ? <Image source={{ uri: imageUri }} style={styles.thumb} />
        : <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name="sparkles-outline" size={18} color={Colors.textMuted} /></View>}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      {onStatusPress
        ? <TouchableOpacity onPress={onStatusPress} hitSlop={8}>{pill}</TouchableOpacity>
        : pill}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2,
    paddingLeft: Spacing.sm2 - 2, paddingRight: Spacing.sm2, paddingVertical: Spacing.sm2 - 2,
    borderRadius: Radii.lg, backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  thumb: { width: THUMB, height: THUMB, borderRadius: Radii.sm, borderWidth: 1, borderColor: Colors.primary },
  thumbEmpty: { backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '600', color: Colors.textInk },
  subtitle: { ...Typography.bodySmall, color: Colors.textMuted },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.sm2, paddingVertical: 6, borderRadius: Radii.full,
  },
  pillText: { fontSize: 12, fontWeight: '600' },
});
