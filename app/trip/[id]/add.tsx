// HAKO — « Ajouter » : le ➕ du dashboard ouvre cette page de raccourcis.
// Tout ce qu'on peut ajouter à un voyage, à un tap : envie, document,
// logement, activité, dépense, planning, amis, note d'orga, étape, photos.
// Chaque tuile ouvre directement le formulaire concerné (paramètres add=1,
// mode=…, tab=…). Un lien copié (TikTok, Reel…) est proposé en premier.

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader } from '@/components/createTrip/CreateTripChrome';
import { ClipboardBanner, OptionRow, SectionTitle } from '@/components/envies/NewWishParts';
import { InviteSheet } from '@/components/invitations/InviteSheet';
import { HeroShortcut, ShortcutTile, TileGrid } from '@/components/trip/AddShortcuts';
import { useClipboardLink } from '@/hooks/useClipboardLink';
import { useTripOverview } from '@/hooks/useTripOverview';
import { localDayIso } from '@/utils/tripStops';

export default function AddToTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = id ?? '';
  const insets = useSafeAreaInsets();
  const { overview } = useTripOverview(tripId);
  const { clipboard, readLink } = useClipboardLink();
  const [showInvite, setShowInvite] = useState(false);

  // Remplace la page « Ajouter » : fermer le formulaire ramène au dashboard
  const go = (pathname: Parameters<typeof router.replace>[0]) => router.replace(pathname);

  const pasteLink = async () => {
    const link = await readLink();
    if (link) go({ pathname: '/trip/[id]/wish/new', params: { id: tripId, link } });
  };

  const started = !!overview?.start_date && overview.start_date <= localDayIso(new Date());

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader title="Ajouter" onClose={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.title}>On ajoute quoi ?</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {overview ? `Tout pour « ${overview.name} », au même endroit.` : 'Tout pour le voyage, au même endroit.'}
          </Text>
        </View>

        {clipboard && <ClipboardBanner url={clipboard.url} onPaste={() => { void pasteLink(); }} />}

        {/* Les deux ajouts les plus fréquents */}
        <View style={styles.heroRow}>
          <HeroShortcut
            icon="heart"
            title="Une envie"
            subtitle="TikTok, Reel, resto, spot…"
            tone="accent"
            onPress={() => go({ pathname: '/trip/[id]/wish/new', params: { id: tripId } })}
          />
          <HeroShortcut
            icon="document-text"
            title="Un document"
            subtitle="Billet, réservation, passeport"
            tone="dark"
            onPress={() => go({ pathname: '/trip/[id]/document/new', params: { id: tripId } })}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle>ORGANISER</SectionTitle>
          <TileGrid>
            {[
              <ShortcutTile
                key="lodging"
                icon="bed-outline"
                title="Un logement"
                subtitle="Hôtels & apparts à vos dates"
                onPress={() => go({ pathname: '/trip/[id]/help', params: { id: tripId, tab: 'lodging' } })}
              />,
              <ShortcutTile
                key="activity"
                icon="ticket-outline"
                title="Une activité"
                subtitle="Idées & événements"
                onPress={() => go({ pathname: '/trip/[id]/help', params: { id: tripId, tab: 'activities' } })}
              />,
              <ShortcutTile
                key="expense"
                icon="wallet-outline"
                title="Une dépense"
                subtitle="Qui a payé quoi"
                onPress={() => go({ pathname: '/trip/[id]/expense/new', params: { id: tripId } })}
              />,
              <ShortcutTile
                key="planning"
                icon="calendar-outline"
                title="Au planning"
                subtitle="Un créneau au programme"
                onPress={() => go({ pathname: '/trip/[id]/plan-add', params: { id: tripId, manual: '1' } })}
              />,
              <ShortcutTile
                key="place"
                icon="location-outline"
                title="Un lieu"
                subtitle="Via Google Maps"
                onPress={() => go({ pathname: '/trip/[id]/wish/new', params: { id: tripId, mode: 'place' } })}
              />,
              <ShortcutTile
                key="orga"
                icon="checkbox-outline"
                title="Une note d’orga"
                subtitle="« Louer la voiture »…"
                onPress={() => go({ pathname: '/trip/[id]/wish/new', params: { id: tripId, mode: 'orga' } })}
              />,
            ]}
          </TileGrid>
        </View>

        <View style={styles.section}>
          <SectionTitle>LE GROUPE & LE TRAJET</SectionTitle>
          <OptionRow
            icon="person-add-outline"
            title="Des amis"
            subtitle={overview ? `${overview.member_count} voyageur${overview.member_count > 1 ? 's' : ''} pour l’instant` : 'Invite-les au voyage'}
            onPress={() => setShowInvite(true)}
          />
          <OptionRow
            icon="git-commit-outline"
            title="Une étape"
            subtitle="Une ville de plus sur le trajet"
            onPress={() => go({ pathname: '/trip/[id]/itinerary', params: { id: tripId } })}
          />
          {started && (
            <OptionRow
              icon="images-outline"
              title="Des photos"
              subtitle="L’album souvenir du groupe"
              onPress={() => go({ pathname: '/trip/[id]/past-photos', params: { id: tripId } })}
            />
          )}
        </View>
      </ScrollView>

      <InviteSheet visible={showInvite} onClose={() => setShowInvite(false)} tripId={tripId} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.lg, gap: Spacing.md2 },
  titleBlock: { gap: 6 },
  title: { ...Typography.displayTitle, color: Colors.textPrimary },
  subtitle: { ...Typography.body, color: Colors.textMuted },
  heroRow: { flexDirection: 'row', gap: Spacing.sm2 - 2 },
  section: { gap: Spacing.sm + 2 },
});
