// HAKO — Paramètres d'un voyage (page plein écran, remplace les anciens
// bottom sheets des deux dashboards). Tout s'enregistre au fil de l'eau :
// couverture, nom, dates (décalage de tout le voyage), étapes, style &
// budget, membres et invitations, notifications, quitter / supprimer.

import { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader } from '@/components/createTrip/CreateTripChrome';
import { StyleBudgetStep } from '@/components/createTrip/StyleBudgetStep';
import { InviteSheet } from '@/components/invitations/InviteSheet';
import {
  CoverEditor, Divider, MemberRow, NameRow, SettingsGroup, SettingsRow, ShiftStepper,
} from '@/components/settings/TripSettingsParts';
import { useTripSettings } from '@/hooks/useTripSettings';
import { useTripStops } from '@/hooks/useTripStops';
import { nightsBetween } from '@/utils/tripStops';
import { plural } from '@/utils/dashboardSummary';
import { formatStopRange } from '@/utils/wishLinks';

const COVER_ASPECT: [number, number] = [16, 9];
const COVER_QUALITY = 0.8;

export default function TripSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = id ?? '';
  const insets = useSafeAreaInsets();
  const s = useTripSettings(tripId);
  const { stops } = useTripStops(tripId);
  const [nameDraft, setNameDraft] = useState<string | null>(null); // null = nom enregistré
  const [showInvite, setShowInvite] = useState(false);

  const report = (error: string | null) => { if (error) Alert.alert('Oups', error); };

  if (!s.settings) {
    return (
      <View style={[styles.root, styles.center]}>
        {s.error ? <Text style={styles.subtitle}>{s.error}</Text> : <ActivityIndicator color={Colors.primary} />}
      </View>
    );
  }

  const t = s.settings;
  const nights = nightsBetween(t.startDate, t.endDate);

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Accès refusé', 'Autorise l’accès à ta galerie dans les réglages.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: COVER_ASPECT, quality: COVER_QUALITY,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) report(await s.uploadCover(asset.uri));
  };

  const shareInvite = async () => {
    const result = await s.inviteMessage();
    if ('error' in result) { report(result.error); return; }
    await Share.share({ message: result.message });
  };

  const confirmRemove = (memberId: string, memberName: string) => Alert.alert(
    `Retirer ${memberName} ?`,
    'Ses envies, dépenses et documents restent dans le voyage.',
    [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => { void s.removeMember(memberId).then(report); } },
    ],
  );

  const confirmLeave = () => Alert.alert(
    'Quitter le voyage ?',
    `Tu ne verras plus « ${t.name} ». Un membre pourra te réinviter.`,
    [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Quitter', style: 'destructive',
        onPress: () => { void s.leave().then(error => { if (error) report(error); else router.replace('/'); }); },
      },
    ],
  );

  const confirmDelete = () => Alert.alert(
    'Supprimer le voyage ?',
    `« ${t.name} » sera supprimé pour tout le groupe : envies, planning, budget et documents. C’est définitif.`,
    [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: () => { void s.remove().then(error => { if (error) report(error); else router.replace('/'); }); },
      },
    ],
  );

  const stopsLabel = stops.length > 1
    ? `${stops[0]?.place_name ?? ''}, ${stops[1]?.place_name ?? ''}${stops.length > 2 ? ` +${stops.length - 2}` : ''}`
    : stops[0]?.place_name ?? t.destination;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader title="Paramètres" onClose={() => router.back()} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={2}>{t.name}</Text>
            <Text style={styles.subtitle}>
              {s.saving ? 'Enregistrement…' : 'Les changements sont enregistrés automatiquement.'}
            </Text>
          </View>

          <CoverEditor
            coverUrl={t.coverUrl}
            destination={t.destination}
            suggestions={s.covers}
            onPickGallery={() => { void pickFromGallery(); }}
            onChoose={photo => { void s.chooseCover(photo).then(report); }}
          />

          <SettingsGroup title="LE VOYAGE">
            <NameRow
              value={nameDraft ?? t.name}
              onChange={setNameDraft}
              onSubmit={() => {
                if (nameDraft === null) return;
                void s.rename(nameDraft).then(report);
                setNameDraft(null);
              }}
              editable
            />
            <Divider />
            <SettingsRow
              icon="calendar-outline"
              title={formatStopRange(t.startDate, t.endDate)}
              value={`${plural(nights, 'nuit')} · décaler tout le voyage`}
              right={<ShiftStepper disabled={s.saving} onShift={days => { void s.shiftDates(days).then(report); }} />}
            />
            <Divider />
            <SettingsRow
              icon="git-commit-outline"
              title={plural(Math.max(stops.length, 1), 'étape')}
              value={`${stopsLabel} · durée de chaque étape`}
              onPress={() => router.push({ pathname: '/trip/[id]/itinerary', params: { id: tripId } })}
            />
          </SettingsGroup>

          <View style={styles.style}>
            <StyleBudgetStep
              vibes={t.vibes}
              onToggleVibe={s.toggleVibe}
              budget={t.budgetPerPerson}
              onBudgetChange={s.setBudget}
              totalNights={nights}
            />
          </View>

          <SettingsGroup title={`LE GROUPE · ${t.members.length}`}>
            {t.members.map((m, i) => (
              <View key={m.userId}>
                {i > 0 && <Divider />}
                <MemberRow
                  member={m}
                  isMe={m.userId === s.userId}
                  canRemove={s.isOwner && m.userId !== s.userId}
                  onRemove={() => confirmRemove(m.userId, m.nickname)}
                />
              </View>
            ))}
            <Divider />
            <SettingsRow icon="link-outline" title="Partager le lien d’invitation" value="WhatsApp, Messages…" onPress={() => { void shareInvite(); }} />
            <Divider />
            <SettingsRow icon="person-add-outline" title="Inviter des amis" value="Depuis tes amis Hako ou par e-mail" onPress={() => setShowInvite(true)} />
          </SettingsGroup>

          <SettingsGroup title="PRÉFÉRENCES">
            <SettingsRow
              icon="notifications-outline"
              title="Notifications"
              value="Votes, ajouts, rappels"
              onPress={() => router.push('/settings/notifications')}
            />
          </SettingsGroup>

          <SettingsGroup title="ZONE SENSIBLE">
            {s.isOwner ? (
              <SettingsRow icon="trash-outline" title="Supprimer le voyage" value="Pour tout le groupe, définitivement" danger onPress={confirmDelete} />
            ) : (
              <SettingsRow icon="exit-outline" title="Quitter le voyage" value="Tu pourras être réinvité" danger onPress={confirmLeave} />
            )}
          </SettingsGroup>
        </ScrollView>
      </KeyboardAvoidingView>

      <InviteSheet visible={showInvite} onClose={() => { setShowInvite(false); void s.refresh(); }} tripId={tripId} />
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
  style: { marginTop: -Spacing.sm },
});
