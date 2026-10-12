// HAKO — Itinéraire : gérer les villes d'un voyage après sa création
// Réordonner, ajouter, retirer une étape et répartir les nuits. Les dates
// sont toujours recalculées depuis le début du voyage (le total ne bouge pas).
// Spec : docs/FEATURES.md → « Voyages multi-étapes ».

import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { NightsSplit } from '@/components/createTrip/NightsSplit';
import { BACK_ICON, NavButton, floatingNavSpace } from '@/components/ui/NavButton';
import { useTripOverview } from '@/hooks/useTripOverview';
import { useTripStops } from '@/hooks/useTripStops';
import { CitySuggestion, geocodeDestination, searchCities } from '@/services/placesService';
import { StopLayoutEntry } from '@/services/tripStopService';
import { StopDraft, TripStop } from '@/types/tripStops';
import {
  addDays,
  adjustNights,
  nightsAfterAppend,
  nightsAfterRemoval,
  nightsBetween,
  stopColor,
} from '@/utils/tripStops';

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const BADGE_SIZE = 28;

function shortDate(day: string): string {
  const [, m, d] = day.split('-');
  return `${d}/${m}`;
}

function toDraft(stop: TripStop): StopDraft {
  return {
    place_name: stop.place_name,
    description: stop.place_name,
    secondary_text: '',
    place_id: stop.place_id,
    country_code: stop.country_code,
    nights: nightsBetween(stop.start_date, stop.end_date),
  };
}

export default function ItineraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { overview } = useTripOverview(id);
  const { stops, loading, addStop, removeStop, saveLayout, syncLabel } = useTripStops(id);

  const [editingNights, setEditingNights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tripStart = overview?.start_date ?? stops[0]?.start_date ?? null;
  const nights = stops.map(s => nightsBetween(s.start_date, s.end_date));
  const totalNights = nights.reduce((a, b) => a + b, 0);

  const report = (error: string | null) => {
    if (error) Alert.alert('Oups', error);
  };

  const persist = async (ordered: readonly TripStop[], newNights: readonly number[]) => {
    if (!tripStart) return;
    setBusy(true);
    const layout: StopLayoutEntry[] = ordered.map((s, i) => ({ id: s.id, nights: newNights[i] ?? 1 }));
    report(await saveLayout(tripStart, layout));
    report(await syncLabel(ordered.map(s => s.place_name)));
    setBusy(false);
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    const a = stops[index];
    const b = stops[target];
    if (!a || !b) return;
    const ordered = [...stops];
    ordered[index] = b;
    ordered[target] = a;
    const reNights = [...nights];
    const na = reNights[index] ?? 1;
    reNights[index] = reNights[target] ?? 1;
    reNights[target] = na;
    void persist(ordered, reNights);
  };

  const handleAdjust = (index: number, delta: 1 | -1) => {
    void persist(stops, adjustNights(nights, index, delta));
  };

  const handleRemove = (stop: TripStop, index: number) => {
    if (stops.length <= 1) {
      Alert.alert('Dernière ville', 'Un voyage garde au moins une ville.');
      return;
    }
    Alert.alert(
      `Retirer ${stop.place_name} ?`,
      'Ses nuits passent à la ville voisine. Les envies et dépenses liées restent dans le voyage.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const remaining = stops.filter(s => s.id !== stop.id);
              const remainingNights = nightsAfterRemoval(nights, index);
              report(await removeStop(stop.id));
              setBusy(false);
              await persist(remaining, remainingNights);
            })();
          },
        },
      ],
    );
  };

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < MIN_QUERY_LENGTH) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(() => {
      void searchCities(text).then(setSuggestions);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleAddCity = async (city: CitySuggestion) => {
    if (!tripStart) return;
    const newNights = nightsAfterAppend(nights);
    if (!newNights) {
      Alert.alert(
        'Plus de nuit disponible',
        'La dernière ville n’a qu’une nuit. Réduis une autre étape avant d’ajouter une ville.',
      );
      return;
    }
    setBusy(true);
    setQuery('');
    setSuggestions([]);
    // 1. La dernière étape cède une nuit
    const layout: StopLayoutEntry[] = stops.map((s, i) => ({ id: s.id, nights: newNights[i] ?? 1 }));
    report(await saveLayout(tripStart, layout));
    // 2. La nouvelle ville prend la fin du voyage
    const nightsBefore = newNights.slice(0, -1).reduce((a, b) => a + b, 0);
    const start = addDays(tripStart, nightsBefore);
    const coords = await geocodeDestination(city.description);
    report(await addStop({
      place_name: city.structured_formatting.main_text,
      place_id: city.place_id,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      country_code: null,
      start_date: start,
      end_date: addDays(start, 1),
    }));
    report(await syncLabel([...stops.map(s => s.place_name), city.structured_formatting.main_text]));
    setBusy(false);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: floatingNavSpace(insets.bottom) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>Itinéraire</Text>
          {busy && <ActivityIndicator color={Colors.primary} />}
        </View>
        {tripStart && stops.length > 0 && (
          <Text style={styles.summary}>
            {shortDate(tripStart)} → {shortDate(addDays(tripStart, totalNights))} · {stops.length} étape
            {stops.length > 1 ? 's' : ''} · {totalNights} nuit{totalNights > 1 ? 's' : ''}
          </Text>
        )}

        {loading && <ActivityIndicator color={Colors.primary} style={styles.loader} />}

        {!editingNights && stops.map((stop, index) => (
          <View key={stop.id} style={styles.card}>
            <View style={[styles.badge, { backgroundColor: stopColor(index, Colors.stopPalette) }]}>
              <Text style={styles.badgeText}>{index + 1}</Text>
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle} numberOfLines={1}>{stop.place_name}</Text>
              <Text style={styles.cardSub}>
                {shortDate(stop.start_date)} → {shortDate(stop.end_date)} · {nights[index]} nuit{(nights[index] ?? 0) > 1 ? 's' : ''}
              </Text>
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/trip/[id]/help', params: { id: id ?? '', tab: 'lodging' } })}
                style={styles.lodgingLink}
              >
                <Ionicons name="bed-outline" size={14} color={Colors.accent} />
                <Text style={styles.lodgingText}>Trouver un logement</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => handleMove(index, -1)} disabled={busy || index === 0} accessibilityLabel={`Monter ${stop.place_name}`}>
                <Ionicons name="chevron-up" size={20} color={index === 0 ? Colors.textTertiary : Colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleMove(index, 1)} disabled={busy || index === stops.length - 1} accessibilityLabel={`Descendre ${stop.place_name}`}>
                <Ionicons name="chevron-down" size={20} color={index === stops.length - 1 ? Colors.textTertiary : Colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleRemove(stop, index)} disabled={busy} accessibilityLabel={`Retirer ${stop.place_name}`}>
                <Ionicons name="trash-outline" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {editingNights && tripStart && (
          <NightsSplit
            stops={stops.map(toDraft)}
            tripStartDate={tripStart}
            totalNights={totalNights}
            onAdjust={handleAdjust}
          />
        )}

        {stops.length > 1 && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setEditingNights(v => !v)} activeOpacity={0.8}>
            <Ionicons name={editingNights ? 'checkmark' : 'moon-outline'} size={16} color={Colors.textPrimary} />
            <Text style={styles.secondaryText}>{editingNights ? 'Terminé' : 'Répartir les nuits'}</Text>
          </TouchableOpacity>
        )}

        {/* Ajouter une ville */}
        <Text style={styles.label}>Ajouter une ville</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Florence, Lisbonne, Porto…"
            placeholderTextColor={Colors.textTertiary}
            value={query}
            onChangeText={handleQueryChange}
            autoCorrect={false}
          />
        </View>
        {suggestions.map(city => (
          <TouchableOpacity
            key={city.place_id}
            style={styles.suggestion}
            onPress={() => { void handleAddCity(city); }}
            disabled={busy}
          >
            <Ionicons name="location-outline" size={18} color={Colors.textSecondary} />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{city.structured_formatting.main_text}</Text>
              <Text style={styles.cardSub}>{city.structured_formatting.secondary_text}</Text>
            </View>
            <Ionicons name="add-circle" size={22} color={Colors.accent} />
          </TouchableOpacity>
        ))}
        <Text style={styles.hint}>La nouvelle ville prend la dernière nuit du voyage.</Text>
      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <NavButton icon={BACK_ICON} onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.md2,
    gap: Spacing.sm2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  title: {
    ...Typography.titlePage,
    color: Colors.textPrimary,
  },
  summary: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  loader: {
    marginTop: Spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm2,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.textInverted,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardSub: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  lodgingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  lodgingText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.accent,
  },
  actions: {
    gap: Spacing.sm,
    alignItems: 'center',
  },
  secondaryBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondaryText: {
    ...Typography.filter,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  label: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: Spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm2,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm2,
    paddingVertical: Spacing.sm2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  hint: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  bottomNav: {
    position: 'absolute',
    left: Spacing.md2,
    bottom: 0,
  },
});
