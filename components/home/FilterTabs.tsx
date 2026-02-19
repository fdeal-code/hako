import { View, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '@/components/ui/Chip';
import { Colors, Spacing } from '@/constants/theme';

export type TripFilter = 'all' | 'future' | 'past';

interface FilterTabsProps {
  active: TripFilter;
  onChange: (filter: TripFilter) => void;
  style?: ViewStyle;
}

const FILTERS: { key: TripFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'future', label: 'Future' },
  { key: 'past', label: 'Passé' },
];

export function FilterTabs({ active, onChange, style }: FilterTabsProps) {
  return (
    <View style={[styles.row, style]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            active={active === f.key}
            onPress={() => onChange(f.key)}
            style={styles.chip}
          />
        ))}
      </ScrollView>
      <Ionicons name="options-outline" size={22} color={Colors.textSecondary} style={styles.filterIcon} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scroll: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  chip: {
    marginRight: 0,
  },
  filterIcon: {
    marginLeft: Spacing.sm,
    paddingRight: 4,
  },
});
