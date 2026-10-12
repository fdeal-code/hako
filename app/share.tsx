// HAKO — Partage vers Hako (depuis TikTok, Instagram, YouTube, Safari…)
// Ouvert par le menu Partager du téléphone (expo-share-intent, voir
// app/+native-intent.tsx). On choisit le voyage, puis :
//  • un lien → l'aperçu de l'envie (« Joli spot ! » : vidéo, lieu, ambiances) ;
//  • un PDF, une capture ou un e-mail de confirmation copié → l'import de
//    réservation (document + planning + dépense).

import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { BackBar, CreateTripHeader } from '@/components/createTrip/CreateTripChrome';
import { setPendingImport } from '@/hooks/useBookingImport';
import { useShareIntake } from '@/hooks/useShareIntake';
import { MyTrip } from '@/services/myTripsService';
import { LINK_SOURCE_META } from '@/types/wishDraft';
import { TripMoment } from '@/utils/shareIntake';
import { detectLinkSource, formatStopRange, shortUrl } from '@/utils/wishLinks';

const THUMB = 64;
const COVER = 52;
const PREVIEW_CHARS = 120;
const MOMENT_LABEL: Record<TripMoment, string> = { now: 'En ce moment', soon: 'À venir', past: 'Terminé' };

export default function ShareScreen() {
  const insets = useSafeAreaInsets();
  const s = useShareIntake();

  const close = () => { s.done(); router.replace('/(tabs)'); };
  const booking = s.bookingSource;
  const pick = (trip: MyTrip) => {
    if (booking) {
      setPendingImport(booking);
      s.done();
      router.replace({ pathname: '/trip/[id]/import', params: { id: trip.id } });
      return;
    }
    if (!s.link) return;
    const link = s.link;
    s.done();
    router.replace({ pathname: '/trip/[id]/wish/new', params: { id: trip.id, link } });
  };
  const ready = !!s.link || !!booking;

  const source = s.link ? LINK_SOURCE_META[detectLinkSource(s.link)] : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader title="Partager vers Hako" />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Spacing.xl }]} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{booking ? 'Une réservation ?' : 'Ajouter à quel voyage ?'}</Text>
          <Text style={styles.subtitle}>
            {booking ? 'Choisis le voyage : Hako lit la confirmation et range tout.' : 'On en fait une envie, le groupe votera.'}
          </Text>
        </View>

        {/* Ce qui a été partagé */}
        {!s.isReady ? (
          <ActivityIndicator color={Colors.primary} />
        ) : booking ? (
          <View style={styles.shared}>
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <Ionicons name={booking.type === 'text' ? 'mail' : booking.mimeType === 'application/pdf' ? 'document' : 'image'} size={26} color={Colors.white} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.source}>{booking.type === 'text' ? 'E-mail de confirmation' : booking.mimeType === 'application/pdf' ? 'PDF' : 'Capture d’écran'}</Text>
              <Text style={styles.caption} numberOfLines={2}>
                {booking.type === 'text' ? booking.text.replace(/\s+/g, ' ').slice(0, PREVIEW_CHARS) : booking.name}
              </Text>
            </View>
          </View>
        ) : !s.link ? (
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.accent} />
            <Text style={styles.noticeText}>
              {s.hasFiles
                ? 'Hako lit les liens (TikTok, Reel, site), les PDF et les captures d’écran, pas encore les vidéos.'
                : 'Ce partage ne contient pas de lien. Partage la vidéo ou la page elle-même, ou le texte complet d’une confirmation.'}
            </Text>
          </View>
        ) : (
          <View style={styles.shared}>
            {s.preview?.thumbnail
              ? <Image source={{ uri: s.preview.thumbnail }} style={styles.thumb} />
              : <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name={source?.icon ?? 'link'} size={26} color={Colors.white} /></View>}
            <View style={styles.flex}>
              <View style={styles.sourceRow}>
                <Ionicons name={source?.icon ?? 'link'} size={12} color={Colors.textOnDark} />
                <Text style={styles.source} numberOfLines={1}>
                  {source?.label ?? 'Lien'}{s.preview?.author ? ` · @${s.preview.author}` : ''}
                </Text>
              </View>
              <Text style={styles.caption} numberOfLines={2}>{s.preview?.title || s.title || shortUrl(s.link, 40)}</Text>
            </View>
          </View>
        )}

        {/* Les voyages */}
        {ready && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TES VOYAGES</Text>
            {s.error ? <Text style={styles.muted}>{s.error}</Text> : null}
            {s.trips === null ? <ActivityIndicator color={Colors.primary} /> : s.trips.length === 0 ? (
              <TouchableOpacity style={styles.create} onPress={() => { s.done(); router.replace('/trip/create'); }}>
                <Ionicons name="add" size={20} color={Colors.white} />
                <Text style={styles.createText}>Crée d’abord un voyage</Text>
              </TouchableOpacity>
            ) : s.trips.map(trip => {
              const moment = s.momentOf(trip);
              return (
                <TouchableOpacity key={trip.id} style={[styles.trip, moment === 'past' && styles.tripPast]} onPress={() => pick(trip)} activeOpacity={0.85}>
                  {trip.cover_image_url
                    ? <Image source={{ uri: trip.cover_image_url }} style={styles.cover} />
                    : <View style={[styles.cover, styles.thumbEmpty]}><Ionicons name="airplane" size={20} color={Colors.white} /></View>}
                  <View style={styles.flex}>
                    <Text style={styles.tripName} numberOfLines={1}>{trip.name}</Text>
                    <Text style={styles.muted} numberOfLines={1}>{trip.destination} · {formatStopRange(trip.start_date, trip.end_date)}</Text>
                  </View>
                  <View style={[styles.badge, moment === 'now' && styles.badgeNow]}>
                    <Text style={[styles.badgeText, moment === 'now' && styles.badgeTextNow]}>{MOMENT_LABEL[moment]}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
      <BackBar onBack={close} bottomInset={insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.lg, gap: Spacing.lg },
  titleBlock: { gap: 6 },
  title: { ...Typography.displayTitle, color: Colors.textPrimary },
  subtitle: { ...Typography.body, color: Colors.textMuted },
  muted: { ...Typography.bodySmall, color: Colors.textMuted },
  notice: {
    flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md,
    borderRadius: Radii.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.accent,
  },
  noticeText: { flex: 1, ...Typography.body, color: Colors.textInk },
  shared: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.sm2,
    borderRadius: Radii.lg, backgroundColor: Colors.primary, ...Shadows.md,
  },
  thumb: { width: THUMB, height: THUMB, borderRadius: Radii.sm, backgroundColor: Colors.line },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  source: { ...Typography.bodySmall, color: Colors.textOnDark },
  caption: { ...Typography.rowTitle, color: Colors.white },
  section: { gap: Spacing.sm2 },
  sectionLabel: { ...Typography.displayLabel, color: Colors.textPrimary },
  trip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.sm2,
    borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card,
  },
  tripPast: { opacity: 0.7 },
  cover: { width: COVER, height: COVER, borderRadius: Radii.sm, backgroundColor: Colors.line },
  tripName: { ...Typography.rowTitle, color: Colors.textInk },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radii.full, backgroundColor: Colors.surfaceAlt },
  badgeNow: { backgroundColor: Colors.accent },
  badgeText: { ...Typography.bodySmall, fontWeight: '600', color: Colors.textMuted },
  badgeTextNow: { color: Colors.white },
  create: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: Radii.full, backgroundColor: Colors.accent,
  },
  createText: { ...Typography.chip, color: Colors.white },
});
