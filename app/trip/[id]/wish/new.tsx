// HAKO — Nouvelle envie (maquettes « Envie · Nouvelle envie » 711:2841
// et « Envie · Aperçu TikTok » 711:2962). Page plein écran ouverte par le ➕
// des Envies : coller un lien (TikTok, Reel, YouTube…) → aperçu + lieu trouvé
// + ambiances ; ou un lieu Google, les idées Hako, une note d'orga.

import { useEffect, useRef } from 'react';
import {
  Alert, BackHandler, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, StepActions } from '@/components/createTrip/CreateTripChrome';
import {
  ClipboardBanner, LinkField, OptionRow, ShareTip, PlaceCard, PlacePhoto, PlaceSearch, SectionTitle, VibeChips, VideoPreview,
} from '@/components/envies/NewWishParts';
import { PriceDurationFields } from '@/components/envies/PriceDurationFields';
import { useAuth } from '@/contexts/AuthContext';
import { useNewWish } from '@/hooks/useNewWish';
import { formatStopRange } from '@/utils/wishLinks';

const ACTIONS_SPACE = 120;
const NOTE_MIN_HEIGHT = 96;

function Title({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

export default function NewWishScreen() {
  // mode / link : raccourcis depuis la page « Ajouter » (app/trip/[id]/add.tsx)
  const { id, mode, link } = useLocalSearchParams<{ id: string; mode?: string; link?: string }>();
  const tripId = id ?? '';
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const w = useNewWish(tripId, session?.user?.id, mode === 'place' || mode === 'orga' ? mode : 'choose');

  // Lien déjà collé sur la page « Ajouter » → aperçu direct
  const openLink = w.openLink;
  const linkOpened = useRef(false);
  useEffect(() => {
    if (!link || linkOpened.current) return;
    linkOpened.current = true;
    void openLink(link);
  }, [link, openLink]);

  // Android : le bouton retour revient au choix avant de fermer la page
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (w.screen === 'choose') return false;
      w.goTo('choose');
      return true;
    });
    return () => sub.remove();
  }, [w]);

  const stopLabel = w.stop
    ? `Étape ${w.stop.place_name} · ${formatStopRange(w.stop.start_date, w.stop.end_date)}`
    : null;

  const onSave = async () => {
    const error = await w.save();
    if (error) Alert.alert('Oups', error);
    else router.back();
  };

  const ctaLabel = w.screen === 'orga' ? 'Ajouter la note' : 'Ajouter aux envies';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader title="Nouvelle envie" onClose={() => router.back()} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: ACTIONS_SPACE + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Choix ── */}
          {w.screen === 'choose' && (
            <>
              <Title title="Tu as vu quoi ?" subtitle="Un TikTok, un Reel, un lieu… tout finit ici." />
              {w.clipboard && (
                <ClipboardBanner url={w.clipboard.url} onPaste={() => { void w.pasteFromClipboard(); }} />
              )}
              <LinkField
                value={w.linkInput}
                onChange={w.setLinkInput}
                onSubmit={() => { void w.openLink(w.linkInput); }}
              />
              <View style={styles.options}>
                <SectionTitle>AUTRES FAÇONS D’AJOUTER</SectionTitle>
                <OptionRow
                  icon="location-outline"
                  title="Un lieu"
                  subtitle="Resto, bar, plage… via Google Maps"
                  onPress={() => w.goTo('place')}
                />
                <OptionRow
                  icon="sparkles-outline"
                  title="Les idées Hako"
                  subtitle="Logements & activités à vos dates"
                  onPress={() => router.replace({ pathname: '/trip/[id]/help', params: { id: tripId, tab: 'activities' } })}
                />
                <OptionRow
                  icon="document-text-outline"
                  title="Une note d’orga"
                  subtitle="« Louer la voiture », « Billets »…"
                  onPress={() => w.goTo('orga')}
                />
              </View>
              <ShareTip />
            </>
          )}

          {/* ── Aperçu du lien ── */}
          {w.screen === 'link' && (
            <>
              <Title title={w.isVideo ? 'Joli spot !' : 'Bonne idée !'} subtitle="On l’ajoute à vos envies ?" />
              <VideoPreview
                preview={w.preview}
                loading={w.loadingPreview}
                onPlay={() => { if (w.preview) void Linking.openURL(w.preview.url); }}
              />
              {w.editingPlace ? (
                <PlaceSearch query={w.placeQuery} onChange={w.setPlaceQuery} suggestions={w.suggestions} onSelect={s => { void w.choosePlace(s); }} />
              ) : (
                <PlaceCard
                  place={w.place}
                  detected={w.placeDetected}
                  finding={w.findingPlace}
                  stopLabel={stopLabel}
                  onEdit={w.startEditingPlace}
                />
              )}
              <VibeChips selected={w.vibes} onToggle={w.toggleVibe} />
              <PriceDurationFields
                price={w.price}
                duration={w.duration}
                onPriceChange={w.setPrice}
                onDurationChange={w.setDuration}
              />
            </>
          )}

          {/* ── Un lieu ── */}
          {w.screen === 'place' && (
            <>
              <Title title="Quel lieu ?" subtitle="Resto, bar, plage… via Google Maps" />
              {w.place && !w.editingPlace ? (
                <>
                  <PlacePhoto place={w.place} />
                  <PlaceCard place={w.place} detected={false} finding={false} stopLabel={stopLabel} onEdit={w.startEditingPlace} />
                  <VibeChips selected={w.vibes} onToggle={w.toggleVibe} />
                  <PriceDurationFields
                    price={w.price}
                    duration={w.duration}
                    onPriceChange={w.setPrice}
                    onDurationChange={w.setDuration}
                  />
                </>
              ) : (
                <PlaceSearch query={w.placeQuery} onChange={w.setPlaceQuery} suggestions={w.suggestions} onSelect={s => { void w.choosePlace(s); }} />
              )}
            </>
          )}

          {/* ── Note d'orga ── */}
          {w.screen === 'orga' && (
            <>
              <Title title="C’est quoi la tâche ?" subtitle="Une note visible par tout le groupe." />
              <View style={styles.card}>
                <TextInput
                  style={styles.orgaTitle}
                  value={w.orgaTitle}
                  onChangeText={w.setOrgaTitle}
                  placeholder="Louer la voiture"
                  placeholderTextColor={Colors.textMuted}
                  autoFocus
                  returnKeyType="next"
                />
              </View>
              <View style={styles.card}>
                <TextInput
                  style={styles.note}
                  value={w.note}
                  onChangeText={w.setNote}
                  placeholder="Détails (optionnel)"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {w.screen !== 'choose' && (
        <StepActions
          onBack={() => w.goTo('choose')}
          onNext={() => { void onSave(); }}
          label={ctaLabel}
          disabled={!w.canSave}
          loading={w.saving}
          bottomInset={insets.bottom}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.lg, gap: Spacing.md2 },
  titleBlock: { gap: 6 },
  title: { ...Typography.displayTitle, color: Colors.textPrimary },
  subtitle: { ...Typography.body, color: Colors.textMuted },
  options: { gap: Spacing.sm + 2 },
  card: {
    padding: Spacing.md2, borderRadius: Radii.lg,
    backgroundColor: Colors.surface, ...Shadows.card,
  },
  orgaTitle: { padding: 0, ...Typography.displayValue, color: Colors.textInk },
  note: { padding: 0, minHeight: NOTE_MIN_HEIGHT, ...Typography.body, color: Colors.textInk },
});
