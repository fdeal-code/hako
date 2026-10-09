// HAKO — Dashboard : tuile « On t'aide » (logements + activités)
// Point d'entrée des suggestions partenaires — utile, jamais une pub.

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { GlassCard } from '@/components/ui/GlassCard';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type HelpTab = 'lodging' | 'activities';

interface HelpTileProps {
  stopCount: number;
  onOpen: (tab: HelpTab) => void;
  flex?: number;
  height?: number;
}

const TILE_HEIGHT = 150;   // maquette « V2 · Dashboard »
const COMPACT_BELOW = 146; // tuile réduite (petit écran) : lignes resserrées
const ROW_RADIUS = 14;

function HelpRow({ icon, title, subtitle, compact, onPress }: {
  icon: IoniconName; title: string; subtitle: string; compact: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.row, compact && styles.rowCompact]} onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
      <Ionicons name={icon} size={18} color={Colors.textPrimary} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={Colors.textPrimary} />
    </TouchableOpacity>
  );
}

export function HelpTile({ stopCount, onOpen, flex = 2, height = TILE_HEIGHT }: HelpTileProps) {
  const cities = Math.max(stopCount, 1);
  const compact = height < COMPACT_BELOW;
  return (
    <GlassCard flex={flex} height={height} variant="accent" noPadding>
      <View style={[styles.inner, compact && styles.innerCompact]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>ON T’AIDE</Text>
          <Ionicons name="sparkles" size={12} color={Colors.textInverted} />
        </View>
        <View style={styles.rows}>
          <HelpRow
            icon="bed-outline"
            title="Logements"
            subtitle={`${cities} ville${cities > 1 ? 's' : ''}`}
            compact={compact}
            onPress={() => onOpen('lodging')}
          />
          <HelpRow
            icon="ticket-outline"
            title="Activités"
            subtitle="Idées à tes dates"
            compact={compact}
            onPress={() => onOpen('activities')}
          />
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  inner: {
    flex: 1,
    padding: Spacing.md2,
    justifyContent: 'space-between',
  },
  innerCompact: {
    padding: Spacing.md,
  },
  title: {
    ...Typography.displayLabel,
    color: Colors.textInverted,
  },
  rows: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: ROW_RADIUS,
    paddingLeft: 10,
    paddingRight: Spacing.sm,
    paddingVertical: 7,
  },
  rowCompact: {
    paddingVertical: Spacing.xs,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textInk,
  },
  rowSub: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.accent,
  },
});
