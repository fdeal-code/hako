// HAKO — Proposer un logement (page plein écran)
// 1. On cherche chez Booking ou Hostelworld (ville, dates, voyageurs déjà
//    remplis, liens affiliés) ; 2. on colle le lien de l'annonce trouvée ;
// 3. nom et prix, pré-remplis en lisant l'annonce (photos comprises), ou
// le prix lu sur une capture quand le site bloque la lecture (Booking).
// Le logement devient une envie que le groupe vote.
// Paramètre stop : l'étape concernée (ex. depuis « Pas encore de logement »).

import { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, SectionLabel, StepActions, StepTitle, createCardStyles } from '@/components/createTrip/CreateTripChrome';
import { ClipboardBanner } from '@/components/envies/NewWishParts';
import { FilterButton } from '@/components/ui/FilterButton';
import { useLodgingProposal } from '@/hooks/useLodgingProposal';
import { openPartner } from '@/services/partnerService';
import { LODGING_SITE_LABEL } from '@/utils/lodgingLinks';

const ICON = 40;
const FIELD_HEIGHT = 56;
const PHOTO_W = 150;
const PHOTO_H = 104;
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function shortDay(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${d ?? ''} ${MONTHS[(m ?? 1) - 1] ?? ''}`;
}

export default function LodgingProposalScreen() {
  const { id, stop: stopParam } = useLocalSearchParams<{ id: string; stop?: string }>();
  const tripId = id ?? '';
  const insets = useSafeAreaInsets();
  const l = useLodgingProposal(tripId, stopParam ?? null);
  const [error, setError] = useState<string | null>(null);

  const addScreenshot = async () => {
    setError(null);
    const err = await l.addScreenshot();
    if (err) setError(err);
  };

  const save = async () => {
    setError(null);
    const err = await l.save();
    if (err) { setError(err); return; }
    Alert.alert('Proposé !', 'Le logement est dans les envies : le groupe peut voter.');
    router.back();
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CreateTripHeader title="Proposer un logement" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <StepTitle title="Où dort-on ?" subtitle="Trouve une annonce, colle son lien ici : le groupe vote comme pour une envie." />

        {/* Étape du voyage */}
        {l.stops.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stops}>
            {l.stops.map(s => (
              <FilterButton
                key={s.id}
                label={l.gaps.some(g => g.id === s.id) ? `${s.place_name} · à trouver` : s.place_name}
                active={l.stop?.id === s.id}
                onPress={() => l.setStopId(s.id)}
              />
            ))}
          </ScrollView>
        )}

        {/* 1. Chercher */}
        <View>
          <SectionLabel>1. Cherche une annonce</SectionLabel>
          {l.stop && (
            <Text style={styles.stopInfo}>
              {l.stop.place_name} · du {shortDay(l.stop.start_date)} au {shortDay(l.stop.end_date)} · {l.nights} nuit{l.nights > 1 ? 's' : ''} · {l.travelers} voyageur{l.travelers > 1 ? 's' : ''}
            </Text>
          )}
          <View style={styles.searches}>
            {l.searches.map(link => (
              <TouchableOpacity
                key={link.id}
                style={[createCardStyles.whiteCard, styles.search]}
                onPress={() => openPartner(link.url, link.id, 'wish_lodging', tripId)}
                activeOpacity={0.85}
                accessibilityRole="link"
              >
                <View style={styles.icon}><Ionicons name={link.icon} size={20} color={Colors.textInk} /></View>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{link.name}</Text>
                  <Text style={styles.rowSub}>{link.tagline}</Text>
                </View>
                <Ionicons name="open-outline" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>Sur l’annonce qui te plaît, touche « Partager » puis « Copier le lien », et reviens ici.</Text>
        </View>

        {/* 2. Coller l'annonce */}
        <View>
          <SectionLabel>2. Colle le lien de l’annonce</SectionLabel>
          {l.clipboard && !l.url && <ClipboardBanner url={l.clipboard.url} onPaste={() => { void l.paste(); }} />}
          <View style={[createCardStyles.whiteCard, styles.field, styles.spaced]}>
            <Ionicons name="link-outline" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={l.link}
              onChangeText={l.setLink}
              placeholder="https://www.booking.com/hotel/…"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {l.site && l.site !== 'other' && <Text style={styles.site}>{LODGING_SITE_LABEL[l.site]}</Text>}
          </View>

          {l.reading && (
            <View style={styles.reading}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.hint}>Hako lit l’annonce…</Text>
            </View>
          )}

          {/* Photos trouvées sur l'annonce */}
          {l.photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photos} contentContainerStyle={styles.photosContent}>
              {l.photos.map(uri => <Image key={uri} source={{ uri }} style={styles.photo} />)}
            </ScrollView>
          )}

          {/* Plateforme qui bloque la lecture (ex. Booking) : on passe par une capture */}
          {l.blocked && !l.reading && (
            <View style={styles.notice}>
              <Ionicons name="image-outline" size={20} color={Colors.accent} />
              <View style={styles.flex}>
                <Text style={styles.noticeText}>
                  {l.site && l.site !== 'other' ? LODGING_SITE_LABEL[l.site] : 'Ce site'} ne laisse pas lire ses annonces automatiquement.
                  Fais une capture d’écran de l’annonce avec le prix : Hako le lira.
                </Text>
                <TouchableOpacity onPress={() => { void addScreenshot(); }} style={styles.noticeBtn} hitSlop={8}>
                  <Text style={styles.noticeBtnText}>Ajouter une capture</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* 3. Détails */}
        {l.url && (
          <View>
            <SectionLabel>3. Les détails</SectionLabel>
            <View style={styles.fields}>
              <View style={[createCardStyles.whiteCard, styles.field]}>
                <Ionicons name="bed-outline" size={20} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  value={l.name}
                  onChangeText={l.setName}
                  placeholder="Nom du logement"
                  placeholderTextColor={Colors.textSecondary}
                  maxLength={80}
                />
              </View>
              <View style={[createCardStyles.whiteCard, styles.field]}>
                <Ionicons name="wallet-outline" size={20} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  value={l.totalText}
                  onChangeText={l.setTotalText}
                  placeholder="Prix total du séjour (€), facultatif"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="decimal-pad"
                />
                {l.perPerson !== null && <Text style={styles.site}>≈ {Math.round(l.perPerson)} {l.currency && l.currency !== 'EUR' ? l.currency : '€'}/pers.</Text>}
              </View>
              {l.currency && l.currency !== 'EUR' && <Text style={styles.warn}>Prix lu en {l.currency} : convertis-le en euros pour les comptes du groupe.</Text>}
              {l.priceFromScreenshot && <Text style={styles.hint}>Prix lu sur la capture, vérifie-le.</Text>}
              {!l.totalText && !l.blocked && !l.reading && (
                <TouchableOpacity onPress={() => { void addScreenshot(); }} hitSlop={8}>
                  <Text style={styles.link}>Lire le prix sur une capture de l’annonce</Text>
                </TouchableOpacity>
              )}
              {l.address && <Text style={styles.hint}>{l.address}</Text>}
            </View>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <StepActions
        onBack={() => router.back()}
        onNext={() => { void save(); }}
        label="Proposer au groupe"
        icon="add"
        variant="accent"
        disabled={!l.canSave}
        loading={l.saving}
        bottomInset={insets.bottom}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.lg },
  stops: { gap: Spacing.sm, paddingRight: Spacing.md2 },
  stopInfo: { ...Typography.bodySmall, color: Colors.textMuted, marginBottom: Spacing.sm },
  searches: { gap: Spacing.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.sm2 },
  icon: { width: ICON, height: ICON, borderRadius: Radii.full, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...Typography.rowTitle, color: Colors.textInk },
  rowSub: { ...Typography.bodySmall, color: Colors.textMuted },
  hint: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: Spacing.sm, marginLeft: Spacing.xs },
  fields: { gap: Spacing.sm },
  field: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, minHeight: FIELD_HEIGHT, paddingHorizontal: Spacing.md },
  spaced: { marginTop: Spacing.sm },
  input: { flex: 1, ...Typography.body, color: Colors.textInk, paddingVertical: Spacing.md },
  site: { ...Typography.chip, color: Colors.textMuted },
  error: { ...Typography.body, color: Colors.negative },
  reading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  photos: { marginTop: Spacing.sm2, marginHorizontal: -Spacing.md2 },
  photosContent: { gap: Spacing.sm, paddingHorizontal: Spacing.md2 },
  photo: { width: PHOTO_W, height: PHOTO_H, borderRadius: Radii.sm, backgroundColor: Colors.line },
  notice: {
    flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm2, padding: Spacing.sm2,
    borderRadius: Radii.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.accent,
  },
  noticeText: { ...Typography.body, color: Colors.textInk },
  noticeBtn: { alignSelf: 'flex-start', marginTop: Spacing.sm, paddingHorizontal: Spacing.sm2, paddingVertical: Spacing.xs + 2, borderRadius: Radii.full, backgroundColor: Colors.accent },
  noticeBtnText: { ...Typography.chip, color: Colors.white },
  warn: { ...Typography.bodySmall, color: Colors.accent, marginLeft: Spacing.xs },
  link: { ...Typography.chip, color: Colors.accent, marginLeft: Spacing.xs },
});
