// HAKO — Création · étape 5 « Nom & couverture » (maquette « V2 · 4 Nom & couverture »)
// Champ nom (placeholder animé) + grille de couvertures 2 colonnes :
// « IMPORTER » en pointillés orange, la couverture choisie bordée d'orange.

import { useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { CreateTripForm } from '@/hooks/useCreateTripForm';
import { SectionLabel, StepTitle, createCardStyles as card } from '@/components/createTrip/CreateTripChrome';
import { UNSPLASH_HOME_URL } from '@/services/unsplashService';

const FIELD_HEIGHT = 60;
const TILE_HEIGHT = 112;
const PLACEHOLDER_INTERVAL_MS = 3000;
const PLACEHOLDER_FADE_MS = 300;
const MAX_SUGGESTIONS = 5;
const CHECK_SIZE = 28;

interface NameCoverStepProps {
  form: CreateTripForm;
  active: boolean;
  onPickError: (message: string) => void;
}

export function NameCoverStep({ form, active, onPickError }: NameCoverStepProps) {
  const city = form.stops[0]?.place_name ?? 'Rome';
  const placeholders = [`${city} entre potes`, 'Road trip entre potes', 'Week-end surprise', `Escapade à ${city}`];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const opacity = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      opacity.set(withTiming(0, { duration: PLACEHOLDER_FADE_MS }));
      setTimeout(() => {
        setPlaceholderIndex(i => (i + 1) % placeholders.length);
        opacity.set(withTiming(1, { duration: PLACEHOLDER_FADE_MS }));
      }, PLACEHOLDER_FADE_MS);
    }, PLACEHOLDER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [active, opacity, placeholders.length]);

  const tiles = form.coverSuggestions.slice(0, MAX_SUGGESTIONS);
  const pick = async () => {
    const error = await form.pickCoverFromGallery();
    if (error) onPickError(error);
  };

  return (
    <View>
      <StepTitle title="Nom & couverture" subtitle="Ce que verra toute la bande." />

      <View style={[card.whiteCard, styles.field]}>
        <Ionicons name="pencil" size={18} color={Colors.textInk} />
        <View style={styles.inputWrap}>
          {form.tripName.length === 0 && (
            <Animated.Text style={[styles.placeholder, fadeStyle]} pointerEvents="none" numberOfLines={1}>
              {placeholders[placeholderIndex]}
            </Animated.Text>
          )}
          <TextInput
            style={styles.input}
            value={form.tripName}
            onChangeText={form.setTripName}
            maxLength={form.nameMaxLength}
            selectionColor={Colors.accent}
            returnKeyType="done"
            accessibilityLabel="Nom du voyage"
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionLabel>Couverture</SectionLabel>
        <View style={styles.grid}>
          <TouchableOpacity style={[styles.tile, styles.importTile]} onPress={() => { void pick(); }} activeOpacity={0.85}>
            {form.coverUri ? (
              <>
                <Image source={{ uri: form.coverUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={styles.check}><Ionicons name="checkmark" size={16} color={Colors.textInverted} /></View>
              </>
            ) : (
              <>
                <Text style={styles.importLabel}>IMPORTER</Text>
                <Text style={styles.importSub}>Depuis ta galerie</Text>
              </>
            )}
          </TouchableOpacity>
          {tiles.map(cover => {
            const selected = form.selectedCoverId === cover.id && form.coverUri === null;
            return (
              <TouchableOpacity
                key={cover.id}
                style={[styles.tile, selected ? styles.tileSelected : styles.tileIdle]}
                onPress={() => form.selectCover(cover.id)}
                activeOpacity={0.85}
                accessibilityState={{ selected }}
              >
                <Image source={{ uri: cover.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                {selected && <View style={styles.check}><Ionicons name="checkmark" size={16} color={Colors.textInverted} /></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Attribution Unsplash (guideline : nom + liens) */}
        {form.selectedCover?.photo && (
          <View style={styles.attribution}>
            <TouchableOpacity onPress={() => { void Linking.openURL(form.selectedCover!.photo!.photographerUrl); }}>
              <Text style={styles.attributionText}>Photo : {form.selectedCover.photo.photographerName}</Text>
            </TouchableOpacity>
            <Text style={styles.attributionText}> · </Text>
            <TouchableOpacity onPress={() => { void Linking.openURL(UNSPLASH_HOME_URL); }}>
              <Text style={styles.attributionText}>Unsplash</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
  inputWrap: { flex: 1, justifyContent: 'center' },
  placeholder: { position: 'absolute', left: 0, right: 0, fontSize: 16, fontWeight: '600', color: Colors.textMuted },
  input: { fontSize: 16, fontWeight: '600', color: Colors.textInk },
  section: { marginTop: Spacing.md, gap: Spacing.sm2 - 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm2 - 2 },
  tile: {
    width: '48.5%',
    height: TILE_HEIGHT,
    borderRadius: Radii.pill,
    overflow: 'hidden',
    borderWidth: 1,
  },
  tileIdle: { borderColor: Colors.primary },
  tileSelected: { borderColor: Colors.accent, borderWidth: 2 },
  importTile: {
    borderColor: Colors.accent,
    borderStyle: 'dashed',
    backgroundColor: Colors.background,
    padding: Spacing.md2,
    justifyContent: 'space-between',
  },
  importLabel: { ...Typography.displayLabel, color: Colors.textPrimary },
  importSub: { ...Typography.body, color: Colors.accent },
  check: {
    position: 'absolute',
    top: Spacing.sm2,
    right: Spacing.sm2,
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: Radii.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attribution: { flexDirection: 'row', flexWrap: 'wrap' },
  attributionText: { ...Typography.bodySmall, color: Colors.textMuted },
});
