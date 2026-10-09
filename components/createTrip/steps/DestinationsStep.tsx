// HAKO — Création · étape 1 « Où part-on ? » (maquette « V2 · 1 Destinations »)

import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing } from '@/constants/theme';
import { CreateTripForm } from '@/hooks/useCreateTripForm';
import { SectionLabel, StepTitle, createCardStyles as card } from '@/components/createTrip/CreateTripChrome';
import { StopList } from '@/components/createTrip/StopList';

const FIELD_HEIGHT = 60;
const ROW_HEIGHT = 64;
const ICON_SIZE = 20;

const POPULAR = [
  { name: 'Rome',      country: 'Italie' },
  { name: 'Barcelone', country: 'Espagne' },
  { name: 'Lisbonne',  country: 'Portugal' },
  { name: 'Amsterdam', country: 'Pays-Bas' },
  { name: 'Marrakech', country: 'Maroc' },
  { name: 'Tokyo',     country: 'Japon' },
] as const;

const MIN_QUERY_LENGTH = 2;

export function DestinationsStep({ form }: { form: CreateTripForm }) {
  const showResults = form.query.trim().length >= MIN_QUERY_LENGTH;
  const hasStops = form.stops.length > 0;

  return (
    <View>
      <StepTitle title="Où part-on ?" subtitle="Ta première ville, puis les suivantes si vous bougez." />

      <View style={[card.whiteCard, styles.field]}>
        {form.searching
          ? <ActivityIndicator size="small" color={Colors.textMuted} />
          : <Ionicons name="search" size={ICON_SIZE} color={Colors.textInk} />}
        <TextInput
          style={styles.input}
          placeholder={hasStops ? 'Ajoute une étape…' : 'Une ville, un pays, une région…'}
          placeholderTextColor={Colors.textMuted}
          value={form.query}
          onChangeText={form.handleQueryChange}
          autoCorrect={false}
          selectionColor={Colors.accent}
          clearButtonMode="while-editing"
        />
      </View>

      {showResults ? (
        <View style={styles.section}>
          <SectionLabel>Résultats</SectionLabel>
          {form.suggestions.length === 0 && !form.searching && (
            <Text style={styles.empty}>Aucune ville trouvée</Text>
          )}
          {form.suggestions.map(city => (
            <TouchableOpacity
              key={city.place_id}
              style={[card.whiteCard, styles.row]}
              onPress={() => form.addStopFromSuggestion(city)}
              activeOpacity={0.85}
            >
              <Ionicons name="location" size={ICON_SIZE} color={Colors.textInk} />
              <View style={styles.rowText}>
                <Text style={card.cardTitle} numberOfLines={1}>{city.structured_formatting.main_text}</Text>
                <Text style={card.cardSub} numberOfLines={1}>{city.structured_formatting.secondary_text}</Text>
              </View>
              <Ionicons name="add-circle" size={24} color={Colors.accent} />
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <StopList stops={form.stops} onRemove={form.removeStop} onMove={form.moveStop} />
          </View>
          <View style={styles.section}>
            <SectionLabel>{hasStops ? 'Ajouter une autre ville ?' : 'Idées de destinations'}</SectionLabel>
            {POPULAR.map(dest => (
              <TouchableOpacity
                key={dest.name}
                style={[card.whiteCard, styles.row]}
                onPress={() => form.addStopFromPopular(dest.name, dest.country)}
                activeOpacity={0.85}
              >
                <Ionicons name="location-outline" size={ICON_SIZE} color={Colors.textInk} />
                <View style={styles.rowText}>
                  <Text style={card.cardTitle}>{dest.name}</Text>
                  <Text style={card.cardSub}>{dest.country}</Text>
                </View>
                <Ionicons name="add" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    height: FIELD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm2,
    paddingHorizontal: Spacing.md2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textInk,
  },
  section: {
    marginTop: Spacing.lg,
    gap: Spacing.sm2 - 2,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm2,
    paddingHorizontal: Spacing.md2,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  empty: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
});
