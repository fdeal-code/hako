// HAKO — Équilibre du budget (page dédiée, ouverte depuis le Budget)
// Qui doit quoi à qui, le solde de chacun, les dépenses par ville et le
// total par catégorie (repas, transport, logement…).

import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader } from '@/components/createTrip/CreateTripChrome';
import { Avatar } from '@/components/ui/Avatar';
import { useBudgetSummary } from '@/hooks/useBudgetSummary';
import { BudgetMember, categoryMeta } from '@/types/budget';
import { formatEuros, plural } from '@/utils/dashboardSummary';
import { stopColor } from '@/utils/tripStops';
import { formatStopRange } from '@/utils/wishLinks';

const EPSILON = 0.01;
const BAR_HEIGHT = 8;
const ICON_CIRCLE = 36;

export default function BalanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const b = useBudgetSummary(id);

  const member = (userId: string): BudgetMember =>
    b.members.find(m => m.id === userId) ?? { id: userId, nickname: 'Ancien membre', avatarUrl: null };
  const name = (userId: string) => (userId === b.userId ? 'Toi' : member(userId).nickname);
  const perPerson = b.members.length > 0 ? b.total / b.members.length : b.total;
  const maxStop = Math.max(...b.byStop.map(s => s.total), 1);
  const myBalance = b.userId ? b.balances[b.userId] ?? 0 : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader title="Équilibre" onClose={() => router.back()} />

      {!b.loaded ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]} showsVerticalScrollIndicator={false}>
          {/* Résumé */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>TOTAL DU GROUPE</Text>
            <Text style={styles.heroAmount}>{formatEuros(b.total)}</Text>
            <Text style={styles.heroSub}>
              ≈ {formatEuros(perPerson)} par personne · {plural(b.members.length, 'voyageur')}
            </Text>
            <View style={styles.heroDivider} />
            <Text style={[styles.heroMine, myBalance < -EPSILON && styles.owe, myBalance > EPSILON && styles.owed]}>
              {Math.abs(myBalance) < EPSILON ? 'Tu es à jour 👌'
                : myBalance > 0 ? `On te doit ${formatEuros(myBalance)}` : `Tu dois ${formatEuros(-myBalance)}`}
            </Text>
          </View>

          {/* Qui doit quoi */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>QUI DOIT QUOI</Text>
            <View style={styles.card}>
              {b.debts.length === 0 ? (
                <Text style={styles.muted}>Tout le monde est à jour, rien à rembourser.</Text>
              ) : b.debts.map((d, i) => (
                <View key={`${d.from}-${d.to}`} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <Avatar name={member(d.from).nickname} uri={member(d.from).avatarUrl ?? undefined} size={32} />
                  <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
                  <Avatar name={member(d.to).nickname} uri={member(d.to).avatarUrl ?? undefined} size={32} />
                  <Text style={styles.rowText} numberOfLines={2}>
                    <Text style={styles.strong}>{name(d.from)}</Text>
                    {d.from === b.userId ? ' rembourses ' : ' rembourse '}
                    <Text style={styles.strong}>{d.to === b.userId ? 'toi' : name(d.to)}</Text>
                  </Text>
                  <Text style={[styles.amount, d.from === b.userId && styles.owe]}>{formatEuros(d.amount)}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Soldes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>LES SOLDES</Text>
            <View style={styles.card}>
              {[...b.members]
                .sort((x, y) => (b.balances[y.id] ?? 0) - (b.balances[x.id] ?? 0))
                .map((m, i) => {
                  const v = b.balances[m.id] ?? 0;
                  return (
                    <View key={m.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                      <Avatar name={m.nickname} uri={m.avatarUrl ?? undefined} size={36} />
                      <View style={styles.flex}>
                        <Text style={styles.rowTitle}>{m.id === b.userId ? `${m.nickname} (toi)` : m.nickname}</Text>
                        <Text style={styles.muted}>
                          {Math.abs(v) < EPSILON ? 'À jour' : v > 0 ? 'A avancé plus que sa part' : 'Doit encore sa part'}
                        </Text>
                      </View>
                      <Text style={[styles.amount, v < -EPSILON && styles.owe, v > EPSILON && styles.owed]}>
                        {Math.abs(v) < EPSILON ? '0 €' : `${v > 0 ? '+' : '–'} ${formatEuros(Math.abs(v))}`}
                      </Text>
                    </View>
                  );
                })}
            </View>
          </View>

          {/* Par catégorie */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PAR CATÉGORIE</Text>
            <View style={styles.card}>
              {b.categories.length === 0 ? <Text style={styles.muted}>Aucune dépense pour l’instant.</Text> : b.categories.map((c, i) => {
                const meta = categoryMeta(c.category);
                return (
                  <View key={c.category} style={[styles.catRow, i > 0 && styles.rowBorder]}>
                    <View style={styles.iconCircle}><Ionicons name={meta.icon} size={18} color={Colors.textInk} /></View>
                    <View style={styles.flex}>
                      <View style={styles.catHead}>
                        <Text style={styles.rowTitle}>{meta.label}</Text>
                        <Text style={styles.amount}>{formatEuros(c.total)}</Text>
                      </View>
                      <View style={styles.bar}>
                        <View style={[styles.barFill, { width: `${Math.max(c.share * 100, 2)}%` }]} />
                      </View>
                      <Text style={styles.muted}>
                        {Math.round(c.share * 100)} % · {plural(c.count, 'dépense')} · ≈ {formatEuros(c.total / Math.max(b.members.length, 1))}/pers.
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Par ville */}
          {b.stops.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PAR VILLE</Text>
              <View style={styles.card}>
                {b.byStop.map((row, i) => {
                  const stop = b.stops.find(s => s.id === row.stopId) ?? null;
                  const color = stop ? stopColor(stop.position, Colors.stopPalette) : Colors.textMuted;
                  return (
                    <View key={row.stopId ?? 'none'} style={[styles.catRow, i > 0 && styles.rowBorder]}>
                      <View style={[styles.stopBadge, { backgroundColor: color }]}>
                        {stop ? <Text style={styles.stopNumber}>{stop.position + 1}</Text> : <Ionicons name="globe-outline" size={14} color={Colors.white} />}
                      </View>
                      <View style={styles.flex}>
                        <View style={styles.catHead}>
                          <Text style={styles.rowTitle}>{stop ? stop.place_name : 'Tout le voyage'}</Text>
                          <Text style={styles.amount}>{formatEuros(row.total)}</Text>
                        </View>
                        <View style={styles.bar}>
                          <View style={[styles.barFill, { width: `${Math.max((row.total / maxStop) * 100, 2)}%`, backgroundColor: color }]} />
                        </View>
                        <Text style={styles.muted}>
                          {stop ? `${formatStopRange(stop.start_date, stop.end_date)} · ` : 'Vols, voiture… · '}{plural(row.count, 'dépense')}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  loader: { marginTop: Spacing.xxl },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.lg, gap: Spacing.lg },
  hero: { padding: Spacing.md2, borderRadius: Radii.pill, backgroundColor: Colors.primary, gap: Spacing.xs, ...Shadows.md },
  heroLabel: { ...Typography.displayLabel, color: Colors.textOnDark },
  heroAmount: { ...Typography.displayTitle, fontSize: 40, color: Colors.white },
  heroSub: { ...Typography.body, color: Colors.textOnDark },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.textOnDark, marginVertical: Spacing.sm },
  heroMine: { ...Typography.rowTitle, color: Colors.white },
  section: { gap: Spacing.sm2 },
  sectionTitle: { ...Typography.displayLabel, color: Colors.textPrimary },
  card: { padding: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm2 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.line },
  rowText: { flex: 1, ...Typography.body, color: Colors.textInk },
  rowTitle: { ...Typography.rowTitle, color: Colors.textInk },
  strong: { fontWeight: '700' },
  muted: { ...Typography.bodySmall, color: Colors.textMuted },
  amount: { ...Typography.rowTitle, color: Colors.textPrimary },
  owe: { color: Colors.accent },
  owed: { color: Colors.positive },
  catRow: { flexDirection: 'row', gap: Spacing.sm2, paddingVertical: Spacing.sm2 },
  catHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconCircle: {
    width: ICON_CIRCLE, height: ICON_CIRCLE, borderRadius: Radii.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background,
  },
  bar: { height: BAR_HEIGHT, borderRadius: Radii.full, backgroundColor: Colors.line, marginVertical: Spacing.xs, overflow: 'hidden' },
  barFill: { height: BAR_HEIGHT, borderRadius: Radii.full, backgroundColor: Colors.accent },
  stopBadge: {
    width: 28, height: 28, borderRadius: Radii.full, alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  stopNumber: { ...Typography.chip, color: Colors.white },
});
