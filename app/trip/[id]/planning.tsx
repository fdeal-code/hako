import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';

const MOCK_DAYS = [
  {
    id: 'd1', date: '10 Juin', label: 'J+1',
    items: [
      { id: 'i1', time: '14h00', title: 'Arrivée à Rome', description: 'Fiumicino → centre-ville' },
      { id: 'i2', time: '20h00', title: 'Dîner Trastevere', description: 'Restaurant La Taverna' },
    ],
  },
  {
    id: 'd2', date: '11 Juin', label: 'J+2',
    items: [
      { id: 'i3', time: '09h00', title: 'Colisée & Forum', description: 'Billet coupe-file réservé' },
      { id: 'i4', time: '14h00', title: 'Vatican', description: 'Musées + Chapelle Sixtine' },
    ],
  },
  {
    id: 'd3', date: '12 Juin', label: 'J+3',
    items: [],
  },
];

export default function PlanningScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Planning</Text>
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.8}>
          <Ionicons name="add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {MOCK_DAYS.map((day, dayIdx) => (
          <View key={day.id} style={styles.dayBlock}>
            {/* Day header */}
            <View style={styles.dayHeader}>
              <View style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>{day.label}</Text>
              </View>
              <Text style={styles.dayDate}>{day.date}</Text>
            </View>

            {/* Timeline */}
            <View style={styles.timeline}>
              {day.items.length === 0 ? (
                <TouchableOpacity style={styles.emptyDay} activeOpacity={0.8}>
                  <Ionicons name="add-circle-outline" size={18} color={Colors.textTertiary} />
                  <Text style={styles.emptyDayText}>Ajouter une activité</Text>
                </TouchableOpacity>
              ) : (
                day.items.map((item, itemIdx) => (
                  <View key={item.id} style={styles.timelineItem}>
                    {/* Vertical line */}
                    <View style={styles.lineCol}>
                      <View style={styles.dot} />
                      {itemIdx < day.items.length - 1 && <View style={styles.line} />}
                    </View>
                    {/* Content */}
                    <View style={styles.itemCard}>
                      <Text style={styles.itemTime}>{item.time}</Text>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      {item.description && (
                        <Text style={styles.itemDesc}>{item.description}</Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        ))}
      </ScrollView>
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
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  dayBlock: {
    gap: Spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dayBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  dayBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  dayDate: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  timeline: {
    paddingLeft: Spacing.sm,
    gap: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  lineCol: {
    alignItems: 'center',
    width: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginTop: 14,
  },
  line: {
    width: 1.5,
    flex: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
    minHeight: 20,
  },
  itemCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  itemTime: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  itemDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyDay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    marginLeft: Spacing.xl,
  },
  emptyDayText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
});
