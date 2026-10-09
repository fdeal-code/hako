// HAKO — Proposition « Album imprimé » (album photo, récap)

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { PRINT_FORMATS } from '@/types/printAlbum';
import { plural } from '@/utils/dashboardSummary';

const ICON_SIZE = 44;

export function PrintAlbumBanner({ tripId, photoCount }: { tripId: string; photoCount: number }) {
  if (photoCount === 0) return null;
  const from = Math.min(...PRINT_FORMATS.map(f => f.priceFrom));
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/trip/[id]/print-album', params: { id: tripId } })}
      activeOpacity={0.88}
      accessibilityRole="button"
    >
      <View style={styles.icon}>
        <Ionicons name="book" size={22} color={Colors.white} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Faites-en un album imprimé</Text>
        <Text style={styles.sub}>{plural(photoCount, 'photo')} · couverture rigide · dès {from} €</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.white} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2,
    padding: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.primary, ...Shadows.md,
  },
  icon: {
    width: ICON_SIZE, height: ICON_SIZE, borderRadius: Radii.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent,
  },
  text: { flex: 1, gap: 2 },
  title: { ...Typography.rowTitle, color: Colors.white },
  sub: { ...Typography.bodySmall, color: Colors.textOnDark },
});
