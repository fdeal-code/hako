// HAKO — Importer une réservation (page plein écran)
// Colle le texte de l'e-mail de confirmation, ou choisis un PDF / une
// capture d'écran : Hako lit la réservation (fonction parse-booking), tu
// vérifies, puis tout est rangé — le document, les créneaux du planning et
// la dépense (payée par toi, partagée entre tous).

import { ComponentProps } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Motion, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, SectionLabel, StepActions, StepTitle, createCardStyles } from '@/components/createTrip/CreateTripChrome';
import { OptionRow } from '@/components/envies/NewWishParts';
import { BookingCard } from '@/components/import/BookingCard';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useBookingImport } from '@/hooks/useBookingImport';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TEXT_MIN_HEIGHT = 160;
const BIG_ICON = 72;
const READING_STEPS = ['On repère les dates', 'On cherche la référence', 'On range par type'];

export default function ImportBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = id ?? '';
  const insets = useSafeAreaInsets();
  const x = useBookingImport(tripId);

  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

  // ─── Lecture en cours ─────────────────────────────────────────────────────
  if (x.step === 'reading' || x.step === 'saving') {
    const reading = x.step === 'reading';
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Animated.View entering={ZoomIn.springify()} style={styles.bigIcon}>
          <Ionicons name={reading ? 'sparkles' : 'folder-open'} size={32} color={Colors.white} />
        </Animated.View>
        <Text style={styles.bigTitle}>{reading ? 'Hako lit ta réservation…' : 'On range tout…'}</Text>
        {reading && (
          <View style={styles.readingSteps}>
            {READING_STEPS.map((s, i) => (
              <Animated.Text key={s} entering={FadeIn.delay(600 + i * 900)} style={styles.readingStep}>{s}</Animated.Text>
            ))}
          </View>
        )}
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      </View>
    );
  }

  // ─── C'est rangé ──────────────────────────────────────────────────────────
  if (x.step === 'done' && x.result) {
    const r = x.result;
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <CreateTripHeader title="Import" onClose={() => router.back()} />
        <ScrollView contentContainerStyle={[styles.content, styles.doneContent]}>
          <Animated.View entering={ZoomIn.springify()} style={[styles.bigIcon, styles.bigIconDone]}>
            <Ionicons name="checkmark" size={36} color={Colors.white} />
          </Animated.View>
          <Text style={styles.bigTitle}>C’est rangé !</Text>
          <View style={styles.summary}>
            <SummaryRow icon="document-text" text={plural(r.documents, 'document')} />
            {r.planning > 0 && <SummaryRow icon="calendar" text={`${plural(r.planning, 'créneau')} au planning`.replace('créneaus', 'créneaux')} />}
            {r.expenses > 0 && <SummaryRow icon="wallet" text={`${plural(r.expenses, 'dépense')} partagée${r.expenses > 1 ? 's' : ''}`} />}
          </View>
          <View style={styles.doneActions}>
            {r.planning > 0 && (
              <OptionRow icon="calendar-outline" title="Voir le planning" subtitle="Les créneaux sont au bon jour"
                onPress={() => router.replace({ pathname: '/trip/[id]/planning', params: { id: tripId } })} />
            )}
            <OptionRow icon="folder-open-outline" title="Voir les documents" subtitle="La confirmation est rangée"
              onPress={() => router.replace({ pathname: '/trip/[id]/documents', params: { id: tripId } })} />
            <OptionRow icon="add-circle-outline" title="Importer une autre réservation" subtitle="E-mail, PDF ou capture" onPress={x.restart} />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Vérification ─────────────────────────────────────────────────────────
  if (x.step === 'review') {
    const n = x.drafts.length;
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <CreateTripHeader title="Import" onClose={() => router.back()} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <StepTitle
            title={n > 1 ? `${n} réservations trouvées` : 'Réservation trouvée'}
            subtitle={`Vérifie, puis on range tout. La dépense est payée par toi et partagée entre les ${x.memberCount} voyageurs.`}
          />
          <View style={styles.cards}>
            {x.drafts.map((d, i) => (
              <BookingCard key={d.key} draft={d} index={i} warnings={x.warningsOf(d)} onChange={patch => x.update(d.key, patch)} />
            ))}
          </View>
          {x.error ? <Text style={styles.error}>{x.error}</Text> : null}
        </ScrollView>
        <StepActions
          onBack={x.restart}
          onNext={() => { void x.confirm(); }}
          label={x.chosen.length > 1 ? `Ajouter les ${x.chosen.length}` : 'Ajouter au voyage'}
          icon="checkmark"
          variant="accent"
          disabled={x.chosen.length === 0}
          bottomInset={insets.bottom}
        />
      </View>
    );
  }

  // ─── Source : texte collé, PDF ou capture ─────────────────────────────────
  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CreateTripHeader title="Import" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <StepTitle
          title="Importer une réservation"
          subtitle="Vol, train, hôtel, location, activité… Hako lit la confirmation et range tout : document, planning et dépense."
        />

        {x.file ? (
          <Animated.View entering={FadeInDown} style={styles.fileCard}>
            <View style={styles.fileIcon}>
              <Ionicons name={x.file.mimeType === 'application/pdf' ? 'document' : 'image'} size={22} color={Colors.white} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.fileName} numberOfLines={1}>{x.file.name}</Text>
              <Text style={styles.fileSub}>{x.file.mimeType === 'application/pdf' ? 'PDF' : 'Capture d’écran'} prêt à être lu</Text>
            </View>
            <TouchableOpacity onPress={x.clearFile} hitSlop={10} accessibilityLabel="Retirer le fichier">
              <Ionicons name="close" size={22} color={Colors.white} />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <>
            <View>
              <View style={styles.pasteHead}>
                <View style={styles.flex}><SectionLabel>Le texte de l’e-mail</SectionLabel></View>
                <AnimatedPressable onPress={() => { void x.paste(); }} style={styles.pasteBtn} scaleTo={Motion.pressScaleSmall} accessibilityRole="button">
                  <Ionicons name="clipboard-outline" size={14} color={Colors.white} />
                  <Text style={styles.pasteText}>Coller</Text>
                </AnimatedPressable>
              </View>
              <View style={[createCardStyles.whiteCard, styles.textCard]}>
                <TextInput
                  style={styles.textInput}
                  value={x.text}
                  onChangeText={x.setText}
                  placeholder="Colle ici la confirmation : Air France, SNCF Connect, Booking, Airbnb, Hertz…"
                  placeholderTextColor={Colors.textSecondary}
                  multiline
                  textAlignVertical="top"
                />
              </View>
              <Text style={styles.hint}>Dans ton appli mail : ouvre la confirmation, sélectionne tout le texte, copie.</Text>
            </View>

            <View style={styles.options}>
              <SectionLabel>Ou un fichier</SectionLabel>
              <OptionRow icon="document-attach-outline" title="Un PDF" subtitle="Billet, facture, confirmation" onPress={() => { void x.pickPdf(); }} />
              <OptionRow icon="image-outline" title="Une capture d’écran" subtitle="De l’appli de la compagnie ou de l’e-mail" onPress={() => { void x.pickImage(); }} />
            </View>
          </>
        )}

        {x.error ? (
          <Animated.View entering={FadeIn} style={styles.errorCard}>
            <Ionicons name="alert-circle" size={18} color={Colors.negative} />
            <Text style={styles.errorText}>{x.error}</Text>
          </Animated.View>
        ) : null}

        <Text style={styles.privacy}>
          La confirmation est lue par l’IA de Hako uniquement pour en extraire la réservation. Rien n’est ajouté sans ta validation.
        </Text>
      </ScrollView>

      <StepActions
        onBack={() => router.back()}
        onNext={() => { void x.analyze(); }}
        label="Lire la réservation"
        icon="sparkles"
        variant="accent"
        disabled={!x.canAnalyze}
        bottomInset={insets.bottom}
      />
    </KeyboardAvoidingView>
  );
}

function SummaryRow({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.summaryRow}>
      <Ionicons name={icon} size={18} color={Colors.accent} />
      <Text style={styles.summaryText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.lg },
  cards: { gap: Spacing.md },

  pasteHead: { flexDirection: 'row', alignItems: 'center' },
  pasteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm2, paddingVertical: Spacing.xs + 2, borderRadius: Radii.full, backgroundColor: Colors.primary,
  },
  pasteText: { ...Typography.chip, color: Colors.white },
  textCard: { padding: Spacing.md },
  textInput: { minHeight: TEXT_MIN_HEIGHT, ...Typography.body, color: Colors.textInk, padding: 0 },
  hint: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: Spacing.sm, marginLeft: Spacing.xs },
  options: { gap: Spacing.sm + 2 },

  fileCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.md,
    borderRadius: Radii.lg, backgroundColor: Colors.primary, ...Shadows.md,
  },
  fileIcon: { width: BIG_ICON / 1.8, height: BIG_ICON / 1.8, borderRadius: Radii.full, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  fileName: { ...Typography.cardTitle, color: Colors.white },
  fileSub: { ...Typography.bodySmall, color: Colors.textOnDark },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm2,
    borderRadius: Radii.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.negative,
  },
  errorText: { flex: 1, ...Typography.body, color: Colors.textInk },
  error: { ...Typography.body, color: Colors.negative },
  privacy: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'center' },

  bigIcon: { width: BIG_ICON, height: BIG_ICON, borderRadius: Radii.full, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', ...Shadows.md },
  bigIconDone: { backgroundColor: Colors.positive },
  bigTitle: { ...Typography.displayTitle, color: Colors.textPrimary, textAlign: 'center' },
  readingSteps: { gap: Spacing.xs, alignItems: 'center' },
  readingStep: { ...Typography.body, color: Colors.textMuted },
  loader: { marginTop: Spacing.sm },

  doneContent: { alignItems: 'stretch' },
  summary: { gap: Spacing.sm, alignSelf: 'center' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  summaryText: { ...Typography.cardTitle, color: Colors.textInk },
  doneActions: { gap: Spacing.sm + 2 },
});
