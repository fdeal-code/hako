// HAKO — Filtres des envies (page plein écran, remplace la feuille FilterMenu)
// Type, catégorie, ambiance (tags d'ambiance) et tri. La liste derrière se
// met à jour en direct (useWishFilters) ; le bouton du bas dit combien
// d'envies correspondent.

import { ComponentProps, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, SectionLabel, StepActions, StepTitle } from '@/components/createTrip/CreateTripChrome';
import { useWishFilters } from '@/hooks/useWishFilters';
import { getWishFacets, WishFacet } from '@/services/wishService';
import { WISH_VIBES, WishCategory, WishKind } from '@/types/wishDraft';
import { activeFilterCount, matchesWishFilters, toggleValue, WishSort } from '@/utils/wishFilters';

type IconName = ComponentProps<typeof Ionicons>['name'];

const CHECK = 22;

const TYPES: { key: WishKind; label: string; icon: IconName }[] = [
  { key: 'place', label: 'Lieux', icon: 'location' },
  { key: 'inspiration', label: 'Inspirations', icon: 'sparkles' },
];

const CATEGORIES: { key: WishCategory; label: string; icon: IconName }[] = [
  { key: 'restaurant', label: 'Restaurant', icon: 'restaurant-outline' },
  { key: 'cafe', label: 'Café', icon: 'cafe-outline' },
  { key: 'bar', label: 'Bar', icon: 'beer-outline' },
  { key: 'monument', label: 'Monument', icon: 'business-outline' },
  { key: 'activity', label: 'Activité', icon: 'ticket-outline' },
  { key: 'photo_spot', label: 'Photo spot', icon: 'camera-outline' },
  { key: 'hotel', label: 'Hôtel', icon: 'bed-outline' },
  { key: 'other', label: 'Autre', icon: 'cube-outline' },
];

const SORTS: { key: WishSort; label: string; icon: IconName }[] = [
  { key: 'recent', label: 'Plus récentes', icon: 'time-outline' },
  { key: 'oldest', label: 'Plus anciennes', icon: 'hourglass-outline' },
  { key: 'most_voted', label: 'Les plus votées', icon: 'flame-outline' },
];

export default function WishFiltersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = id ?? '';
  const insets = useSafeAreaInsets();
  const { filters, update, reset } = useWishFilters(tripId);
  const [facets, setFacets] = useState<WishFacet[] | null>(null);

  useEffect(() => {
    if (tripId) void getWishFacets(tripId).then(({ data }) => setFacets(data ?? []));
  }, [tripId]);

  const count = (patch: Partial<typeof filters>) =>
    (facets ?? []).filter(w => matchesWishFilters({ ...w, upVotes: 0 }, { ...filters, ...patch })).length;
  const results = useMemo(
    () => (facets ?? []).filter(w => matchesWishFilters({ ...w, upVotes: 0 }, filters)).length,
    [facets, filters],
  );
  const active = activeFilterCount(filters);

  // Compteur d'une option = résultats si on ne gardait qu'elle dans sa section
  const typeCount = (k: string) => count({ types: [k] });
  const catCount = (k: string) => count({ categories: [k] });
  const vibeCount = (k: string) => count({ vibes: [k] });

  const label = facets === null ? 'Voir les envies'
    : results === 0 ? 'Aucune envie' : `Voir ${results} envie${results > 1 ? 's' : ''}`;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader title="Filtres" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <View style={styles.flex}><StepTitle title="On cherche quoi ?" /></View>
          {active > 0 && (
            <TouchableOpacity onPress={reset} hitSlop={10} style={styles.reset}>
              <Text style={styles.resetText}>Tout effacer</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Type */}
        <View style={styles.section}>
          <SectionLabel>Type</SectionLabel>
          <View style={styles.types}>
            {TYPES.map(t => {
              const on = filters.types.includes(t.key);
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeTile, on && styles.tileOn]}
                  onPress={() => update({ types: toggleValue(filters.types, t.key) })}
                  activeOpacity={0.85}
                  accessibilityState={{ selected: on }}
                >
                  <Ionicons name={t.icon} size={22} color={on ? Colors.white : Colors.textPrimary} />
                  <Text style={[styles.tileLabel, on && styles.labelOn]}>{t.label}</Text>
                  {facets && <Text style={[styles.tileCount, on && styles.countOn]}>{typeCount(t.key)}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Catégories */}
        <View style={styles.section}>
          <SectionLabel>Catégorie</SectionLabel>
          <View style={styles.chips}>
            {CATEGORIES.map(c => {
              const on = filters.categories.includes(c.key);
              const n = facets ? catCount(c.key) : null;
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.chip, on && styles.tileOn, n === 0 && !on && styles.chipEmpty]}
                  onPress={() => update({ categories: toggleValue(filters.categories, c.key) })}
                  activeOpacity={0.85}
                  accessibilityState={{ selected: on }}
                >
                  <Ionicons name={c.icon} size={16} color={on ? Colors.white : Colors.textPrimary} />
                  <Text style={[styles.chipLabel, on && styles.labelOn]}>{c.label}</Text>
                  {n !== null && n > 0 ? <Text style={[styles.chipCount, on && styles.countOn]}>{n}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Ambiance */}
        <View style={styles.section}>
          <SectionLabel>Ambiance</SectionLabel>
          <View style={styles.chips}>
            {WISH_VIBES.map(v => {
              const on = filters.vibes.includes(v.id);
              const n = facets ? vibeCount(v.id) : null;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.chip, on && styles.vibeOn, n === 0 && !on && styles.chipEmpty]}
                  onPress={() => update({ vibes: toggleValue(filters.vibes, v.id) })}
                  activeOpacity={0.85}
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipLabel, on && styles.labelOn]}>{v.label}</Text>
                  {n !== null && n > 0 ? <Text style={[styles.chipCount, on && styles.countOn]}>{n}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Tri */}
        <View style={styles.section}>
          <SectionLabel>Trier par</SectionLabel>
          <View style={styles.sortCard}>
            {SORTS.map((s, i) => {
              const on = filters.sort === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.sortRow, i > 0 && styles.rowBorder]}
                  onPress={() => update({ sort: s.key })}
                  activeOpacity={0.85}
                  accessibilityState={{ selected: on }}
                >
                  <Ionicons name={s.icon} size={18} color={Colors.textMuted} />
                  <Text style={styles.sortLabel}>{s.label}</Text>
                  <View style={[styles.radio, on && styles.radioOn]}>
                    {on && <Animated.View entering={ZoomIn.duration(150)} style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <StepActions
        onBack={() => router.back()}
        onNext={() => router.back()}
        label={label}
        icon="checkmark"
        variant="accent"
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  reset: { paddingTop: Spacing.sm2 },
  resetText: { ...Typography.chip, color: Colors.accent },
  section: { gap: 0 },

  types: { flexDirection: 'row', gap: Spacing.sm },
  typeTile: {
    flex: 1, alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md,
    borderRadius: Radii.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderDark,
  },
  tileOn: { backgroundColor: Colors.primary, borderColor: Colors.primary, ...Shadows.md },
  vibeOn: { backgroundColor: Colors.accent, borderColor: Colors.accent, ...Shadows.md },
  tileLabel: { ...Typography.chip, color: Colors.textPrimary },
  tileCount: { ...Typography.bodySmall, color: Colors.textMuted },
  labelOn: { color: Colors.white },
  countOn: { color: Colors.textOnDark },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm2 + 2, paddingVertical: Spacing.sm + 1,
    borderRadius: Radii.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderDark,
  },
  chipEmpty: { opacity: 0.45 },
  chipLabel: { ...Typography.chip, color: Colors.textPrimary },
  chipCount: { ...Typography.bodySmall, color: Colors.textMuted },

  sortCard: { backgroundColor: Colors.surface, borderRadius: Radii.lg, paddingHorizontal: Spacing.md, ...Shadows.card },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, paddingVertical: Spacing.md },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  sortLabel: { flex: 1, ...Typography.rowTitle, color: Colors.textInk },
  radio: { width: CHECK, height: CHECK, borderRadius: Radii.full, borderWidth: 2, borderColor: Colors.borderDark, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: Colors.accent },
  radioDot: { width: CHECK / 2, height: CHECK / 2, borderRadius: Radii.full, backgroundColor: Colors.accent },
});
