import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '@/components/ui/Chip';
import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';

export type TripFilter = 'all' | 'future' | 'past';
export type SortBy = 'recent' | 'departure';

interface FilterTabsProps {
  active: TripFilter;
  onChange: (filter: TripFilter) => void;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  showSortMenu: boolean;
  onToggleSortMenu: () => void;
  style?: ViewStyle;
}

const FILTERS: { key: TripFilter; label: string }[] = [
  { key: 'all',    label: 'Tous'   },
  { key: 'future', label: 'Future' },
  { key: 'past',   label: 'Passé'  },
];

const SORT_OPTIONS: { key: SortBy; label: string; icon: string }[] = [
  { key: 'recent',    label: 'Plus récent',    icon: 'time-outline'     },
  { key: 'departure', label: 'Prochain départ', icon: 'airplane-outline' },
];

export function FilterTabs({
  active, onChange,
  sortBy, onSortChange,
  showSortMenu, onToggleSortMenu,
  style,
}: FilterTabsProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.chipsRow}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            active={active === f.key}
            onPress={() => onChange(f.key)}
            style={styles.chipFlex}
          />
        ))}
      </View>

      {/* Bouton tri */}
      <View>
        <TouchableOpacity
          style={[styles.sortBtn, showSortMenu && styles.sortBtnActive]}
          onPress={onToggleSortMenu}
          activeOpacity={0.7}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={showSortMenu ? Colors.white : Colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Menu glassmorphisme */}
        {showSortMenu && (
          <View style={styles.sortMenu}>
            <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
            <View style={styles.sortMenuInner}>
              {SORT_OPTIONS.map((opt, i) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.sortOption,
                    i < SORT_OPTIONS.length - 1 && styles.sortOptionBorder,
                  ]}
                  onPress={() => { onSortChange(opt.key); onToggleSortMenu(); }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={16}
                    color={sortBy === opt.key ? Colors.primary : Colors.textSecondary}
                  />
                  <Text style={[styles.sortLabel, sortBy === opt.key && styles.sortLabelActive]}>
                    {opt.label}
                  </Text>
                  {sortBy === opt.key && (
                    <Ionicons name="checkmark" size={16} color={Colors.primary} style={styles.checkmark} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  chipsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chipFlex: {
    flex: 1,
    alignItems: 'center',
  },
  sortBtn: {
    width: 44,
    height: 44,
    borderRadius: Radii.full,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortBtnActive: {
    backgroundColor: Colors.primary,
  },

  /* Menu déroulant */
  sortMenu: {
    position: 'absolute',
    top: 52,
    right: 0,
    width: 200,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    ...Shadows.md,
    zIndex: 99,
  },
  sortMenuInner: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: Spacing.sm,
  },
  sortOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  sortLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  sortLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  checkmark: {
    marginLeft: 'auto',
  },
});
