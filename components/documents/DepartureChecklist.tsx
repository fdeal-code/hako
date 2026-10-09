// HAKO — Documents : carte « Prêt pour le départ ? »
// Checklist partagée par le groupe. Tant que l'eSIM ou l'assurance ne sont
// pas cochées, un lien partenaire est proposé (affiliation au bon moment,
// jamais une pub). Repliable pour ne pas manger l'écran.

import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { useTripChecklist } from '@/hooks/useTripChecklist';
import { CHECKLIST_ITEMS } from '@/types/checklist';
import { checklistPartnerUrl } from '@/utils/affiliateLinks';

interface DepartureChecklistProps {
  tripId: string;
  /** Jours avant le départ (null si inconnu) — affiché « J-7 ». */
  daysUntilStart: number | null;
}

const CHECK_SIZE = 22;
const SEGMENT_HEIGHT = 5;
const DARK_SEGMENT = 'rgba(255,255,255,0.15)';

export function DepartureChecklist({ tripId, daysUntilStart }: DepartureChecklistProps) {
  const { done, toggle } = useTripChecklist(tripId);
  const [expanded, setExpanded] = useState(false);
  const total = CHECKLIST_ITEMS.length;
  const count = CHECKLIST_ITEMS.filter(i => done.has(i.key)).length;
  const missing = CHECKLIST_ITEMS.filter(i => !done.has(i.key));
  const visible = expanded ? CHECKLIST_ITEMS : missing.slice(0, 2);

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(v => !v)} activeOpacity={0.8}>
        <Text style={styles.title}>
          PRÊT POUR LE DÉPART ?{daysUntilStart !== null && daysUntilStart >= 0 ? ` · J-${daysUntilStart}` : ''}
        </Text>
        <View style={styles.headerRight}>
          <Text style={styles.count}>{count} / {total}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textInverted} />
        </View>
      </TouchableOpacity>

      <View style={styles.segments}>
        {CHECKLIST_ITEMS.map((item, i) => (
          <View key={item.key} style={[styles.segment, { backgroundColor: i < count ? Colors.accent : DARK_SEGMENT }]} />
        ))}
      </View>

      {count === total && !expanded && (
        <Text style={styles.allDone}>Tout est prêt, bon voyage !</Text>
      )}

      {visible.map(item => {
        const isDone = done.has(item.key);
        return (
          <View key={item.key} style={styles.row}>
            <TouchableOpacity
              onPress={() => { void toggle(item.key); }}
              style={[styles.check, isDone && styles.checkDone]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isDone }}
              accessibilityLabel={item.label}
            >
              {isDone && <Ionicons name="checkmark" size={14} color={Colors.textInverted} />}
            </TouchableOpacity>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, isDone && styles.rowTitleDone]}>{item.label}</Text>
              <Text style={styles.rowHint}>{item.hint}</Text>
            </View>
            {!isDone && item.partner && (
              <TouchableOpacity
                style={item.partner === 'esim' ? styles.partnerFilled : styles.partnerGhost}
                onPress={() => { void WebBrowser.openBrowserAsync(checklistPartnerUrl(item.partner!)); }}
                activeOpacity={0.85}
              >
                <Text style={styles.partnerText}>{item.partner === 'esim' ? 'Voir les eSIM' : 'Comparer'}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm2,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm2,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    backgroundColor: Colors.primary,
    ...Shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    ...Typography.bodySmall,
    fontWeight: '800',
    color: Colors.textInverted,
    letterSpacing: 0.4,
  },
  count: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.accent,
  },
  segments: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  segment: {
    flex: 1,
    height: SEGMENT_HEIGHT,
    borderRadius: Radii.full,
  },
  allDone: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.textInverted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm2,
  },
  check: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: Colors.textSecondary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
    borderStyle: 'solid',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.textInverted,
  },
  rowTitleDone: {
    textDecorationLine: 'line-through',
    color: Colors.textSecondary,
  },
  rowHint: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  partnerFilled: {
    paddingHorizontal: Spacing.sm2,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.full,
    backgroundColor: Colors.accent,
  },
  partnerGhost: {
    paddingHorizontal: Spacing.sm2,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.textInverted,
  },
  partnerText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.textInverted,
  },
});
