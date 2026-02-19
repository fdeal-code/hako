import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { Expense, ExpenseCategory } from '@/constants/types';

const CATEGORY_META: Record<ExpenseCategory, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  transport: { icon: 'airplane-outline', color: '#5C6BC0', label: 'Transport' },
  accommodation: { icon: 'bed-outline', color: '#26A69A', label: 'Hébergement' },
  food: { icon: 'restaurant-outline', color: '#FFA726', label: 'Restauration' },
  activity: { icon: 'ticket-outline', color: '#FF4B6E', label: 'Activité' },
  other: { icon: 'ellipsis-horizontal-circle-outline', color: Colors.textSecondary, label: 'Autre' },
};

const MOCK_EXPENSES: Expense[] = [
  { id: 'x1', trip_id: '1', paid_by: 'u1', title: 'Vols Paris-Rome', amount: 680, currency: '€', category: 'transport', split_between: ['u1', 'u2', 'u3', 'u4'], created_at: '' },
  { id: 'x2', trip_id: '1', paid_by: 'u2', title: 'Airbnb Roma 3 nuits', amount: 420, currency: '€', category: 'accommodation', split_between: ['u1', 'u2', 'u3', 'u4'], created_at: '' },
  { id: 'x3', trip_id: '1', paid_by: 'u3', title: 'Dîner Trastevere', amount: 96, currency: '€', category: 'food', split_between: ['u1', 'u2', 'u3', 'u4'], created_at: '' },
  { id: 'x4', trip_id: '1', paid_by: 'u1', title: 'Colisée billets', amount: 60, currency: '€', category: 'activity', split_between: ['u1', 'u2'], created_at: '' },
];

export default function BudgetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const total = MOCK_EXPENSES.reduce((sum, e) => sum + e.amount, 0);
  const myShare = (total / 4).toFixed(0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Budget</Text>
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.8}>
          <Ionicons name="add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { flex: 2 }]}>
          <Text style={styles.summaryLabel}>Total dépensé</Text>
          <Text style={styles.summaryAmount}>{total} €</Text>
        </View>
        <View style={[styles.summaryCard, { flex: 1 }]}>
          <Text style={styles.summaryLabel}>Ma part</Text>
          <Text style={[styles.summaryAmount, { color: Colors.vote.debate }]}>{myShare} €</Text>
        </View>
      </View>

      <FlatList
        data={MOCK_EXPENSES}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const meta = CATEGORY_META[item.category];
          const perPerson = (item.amount / item.split_between.length).toFixed(0);
          return (
            <View style={styles.card}>
              <View style={[styles.iconBox, { backgroundColor: meta.color + '20' }]}>
                <Ionicons name={meta.icon} size={20} color={meta.color} />
              </View>
              <View style={styles.info}>
                <Text style={styles.expenseTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.expenseMeta}>
                  {meta.label} · payé par{' '}
                  <Text style={{ fontWeight: '600' }}>
                    {item.paid_by === 'u1' ? 'toi' : 'un membre'}
                  </Text>
                </Text>
              </View>
              <View style={styles.amountCol}>
                <Text style={styles.amount}>{item.amount} {item.currency}</Text>
                <Text style={styles.perPerson}>{perPerson} {item.currency}/pers.</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  backBtn: { padding: 4 },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    gap: 4,
    ...Shadows.sm,
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.white,
  },
  list: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  expenseTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  expenseMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  amountCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  perPerson: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
});
