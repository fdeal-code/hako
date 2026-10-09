// HAKO — Page « Ajouter » : tuiles de raccourcis (style dashboard V2)
// Grandes tuiles (envie, document) + petites tuiles en grille 2 colonnes.

import { ComponentProps } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const HERO_HEIGHT = 150;
const TILE_HEIGHT = 112;
const ICON_CIRCLE = 40;
const HERO_ICON = 28;

export type HeroTone = 'accent' | 'dark';

// ─── Grande tuile (« Une envie », « Un document ») ──────────────────────────
export function HeroShortcut({ icon, title, subtitle, tone, onPress }: {
  icon: IoniconName; title: string; subtitle: string; tone: HeroTone; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.hero, tone === 'accent' ? styles.heroAccent : styles.heroDark]}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.heroTop}>
        <Text style={styles.heroTitle}>{title.toUpperCase()}</Text>
        <Ionicons name={icon} size={HERO_ICON} color={Colors.white} />
      </View>
      <View style={styles.heroBottom}>
        <Text style={styles.heroSub} numberOfLines={2}>{subtitle}</Text>
        <View style={styles.heroPlus}>
          <Ionicons name="add" size={20} color={tone === 'accent' ? Colors.accent : Colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Petite tuile de la grille ───────────────────────────────────────────────
export function ShortcutTile({ icon, title, subtitle, onPress }: {
  icon: IoniconName; title: string; subtitle: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={title}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={20} color={Colors.textInk} />
      </View>
      <View style={styles.tileText}>
        <Text style={styles.tileTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.tileSub} numberOfLines={1}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

/** Range des tuiles par paires (grille 2 colonnes, dernière ligne complétée). */
export function TileGrid({ children }: { children: React.ReactNode[] }) {
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < children.length; i += 2) rows.push(children.slice(i, i + 2));
  return (
    <View style={styles.grid}>
      {rows.map((row, i) => (
        <View key={i} style={styles.gridRow}>
          {row}
          {row.length === 1 && <View style={styles.gridSpacer} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1, height: HERO_HEIGHT, padding: Spacing.md2,
    borderRadius: Radii.pill, justifyContent: 'space-between', ...Shadows.md,
  },
  heroAccent: { backgroundColor: Colors.accent },
  heroDark: { backgroundColor: Colors.primary },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm },
  heroTitle: { flex: 1, ...Typography.displayLabel, color: Colors.white },
  heroBottom: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  heroSub: { flex: 1, ...Typography.bodySmall, color: Colors.white },
  heroPlus: {
    width: 32, height: 32, borderRadius: Radii.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white,
  },
  grid: { gap: Spacing.sm2 - 2 },
  gridRow: { flexDirection: 'row', gap: Spacing.sm2 - 2 },
  gridSpacer: { flex: 1 },
  tile: {
    flex: 1, height: TILE_HEIGHT, padding: Spacing.md,
    borderRadius: Radii.lg, backgroundColor: Colors.surface,
    justifyContent: 'space-between', ...Shadows.card,
  },
  iconCircle: {
    width: ICON_CIRCLE, height: ICON_CIRCLE, borderRadius: Radii.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background,
  },
  tileText: { gap: 2 },
  tileTitle: { ...Typography.rowTitle, color: Colors.textInk },
  tileSub: { ...Typography.bodySmall, color: Colors.textMuted },
});
