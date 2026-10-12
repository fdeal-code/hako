// HAKO — Album souvenir imprimé (aperçu + liste d'attente)
// Aperçu de la couverture et des premières pages avec les vraies photos du
// voyage, choix du format, « Je le veux » (enregistré, sans paiement :
// l'impression n'est pas encore ouverte, le groupe sera prévenu).

import { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, StepActions } from '@/components/createTrip/CreateTripChrome';
import { usePastTrip } from '@/hooks/usePastTrip';
import { usePrintAlbum } from '@/hooks/usePrintAlbum';
import { PRINT_FORMATS, PrintFormat } from '@/types/printAlbum';
import { plural } from '@/utils/dashboardSummary';
import { formatStopRange } from '@/utils/wishLinks';

const ACTIONS_SPACE = 120;
const COVER_HEIGHT = 260;
const PAGE_HEIGHT = 150;
const PREVIEW_PAGES = 4;

export default function PrintAlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const p = usePastTrip(id);
  const print = usePrintAlbum(id);
  const [format, setFormat] = useState<PrintFormat>('square');

  if (!p.data) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const { trip, photos } = p.data;
  const option = PRINT_FORMATS.find(f => f.id === format) ?? PRINT_FORMATS[0];
  const cover = trip.coverUrl ?? photos[0]?.photoUrl ?? null;
  const perPage = option?.photosPerPage ?? 2;
  const pages = Array.from({ length: PREVIEW_PAGES }, (_, i) => photos.slice(i * perPage, i * perPage + perPage))
    .filter(page => page.length > 0);

  const submit = () => {
    void print.request(format, photos.length).then(error => {
      if (error) Alert.alert('Oups', error);
      else Alert.alert('C’est noté !', 'On te prévient dès que l’impression ouvre. Ton album sera prêt à commander en un tap.');
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader title="Album imprimé" />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: ACTIONS_SPACE + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Votre voyage, en vrai</Text>
          <Text style={styles.subtitle}>
            Un livre photo avec les {plural(photos.length, 'photo')} du groupe, mis en page automatiquement.
          </Text>
        </View>

        {/* Couverture */}
        <View style={styles.cover}>
          {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <LinearGradient colors={[Colors.scrimClear, Colors.scrimStrong]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.coverText}>
            <Text style={styles.coverName} numberOfLines={2}>{trip.name}</Text>
            <Text style={styles.coverDates}>{formatStopRange(trip.startDate, trip.endDate)}</Text>
          </View>
        </View>

        {/* Premières pages */}
        {pages.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pages}>
            {pages.map((page, i) => (
              <View key={i} style={[styles.page, { width: PAGE_HEIGHT * (format === 'square' ? 1 : 1.4) }]}>
                {page.map(ph => <Image key={ph.id} source={{ uri: ph.photoUrl }} style={styles.pagePhoto} />)}
                <Text style={styles.pageNumber}>{i + 1}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Format */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FORMAT</Text>
          {PRINT_FORMATS.map(f => {
            const active = f.id === format;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.format, active && styles.formatActive]}
                onPress={() => setFormat(f.id)}
                activeOpacity={0.85}
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? Colors.accent : Colors.textMuted} />
                <View style={styles.flex}>
                  <Text style={styles.formatTitle}>{f.label}</Text>
                  <Text style={styles.muted}>{f.pages} pages · couverture rigide</Text>
                </View>
                <Text style={styles.price}>dès {f.priceFrom} €</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.note}>
          <Ionicons name="time-outline" size={18} color={Colors.accent} />
          <Text style={styles.noteText}>
            L’impression arrive bientôt. Dis-nous si tu le veux : on te prévient dès l’ouverture, sans engagement.
            {print.groupCount > 0 ? ` ${plural(print.groupCount, 'membre')} du groupe ${print.groupCount > 1 ? 'le veulent' : 'le veut'} déjà.` : ''}
          </Text>
        </View>
      </ScrollView>

      <StepActions
        onBack={() => router.back()}
        onNext={submit}
        label={print.mine ? 'C’est noté ✓' : 'Je le veux'}
        icon={print.mine ? 'checkmark' : 'heart'}
        variant="accent"
        loading={print.sending}
        disabled={photos.length === 0}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.lg, gap: Spacing.lg },
  titleBlock: { gap: 6 },
  title: { ...Typography.displayTitle, color: Colors.textPrimary },
  subtitle: { ...Typography.body, color: Colors.textMuted },
  cover: {
    height: COVER_HEIGHT, borderRadius: Radii.sm, overflow: 'hidden', justifyContent: 'flex-end',
    backgroundColor: Colors.primary, ...Shadows.md,
  },
  coverText: { padding: Spacing.md2, gap: Spacing.xs },
  coverName: { fontFamily: Fonts.displayBold, fontSize: 30, lineHeight: 34, color: Colors.white },
  coverDates: { ...Typography.body, color: Colors.white },
  pages: { gap: Spacing.sm },
  page: {
    height: PAGE_HEIGHT, padding: Spacing.sm, gap: Spacing.xs, borderRadius: Spacing.xs,
    backgroundColor: Colors.surface, ...Shadows.card,
  },
  pagePhoto: { flex: 1, borderRadius: 2, backgroundColor: Colors.line },
  pageNumber: { ...Typography.bodySmall, fontSize: 9, color: Colors.textMuted, textAlign: 'center' },
  section: { gap: Spacing.sm2 },
  sectionTitle: { ...Typography.displayLabel, color: Colors.textPrimary },
  format: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.md,
    borderRadius: Radii.lg, borderWidth: 1, borderColor: Colors.surface, backgroundColor: Colors.surface, ...Shadows.card,
  },
  formatActive: { borderColor: Colors.accent },
  formatTitle: { ...Typography.rowTitle, color: Colors.textInk },
  muted: { ...Typography.bodySmall, color: Colors.textMuted },
  price: { ...Typography.rowTitle, color: Colors.textPrimary },
  note: {
    flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radii.lg,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.accent,
  },
  noteText: { flex: 1, ...Typography.body, color: Colors.textInk },
});
