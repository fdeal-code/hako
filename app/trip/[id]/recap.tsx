// HAKO — Récap du voyage
// Couverture + chiffres clés, le podium (mieux notés), les trophées du
// groupe, le trajet, les moments (photos) et le partage du récap.

import {
  ActivityIndicator, Image, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, StepActions } from '@/components/createTrip/CreateTripChrome';
import { StarRating } from '@/components/past/StarRating';
import { Avatar } from '@/components/ui/Avatar';
import { PrintAlbumBanner } from '@/components/past/PrintAlbumBanner';
import { usePastTrip } from '@/hooks/usePastTrip';
import { formatEuros, plural } from '@/utils/dashboardSummary';
import { buildRecapMessage } from '@/utils/pastRecap';
import { formatStopRange } from '@/utils/wishLinks';

const HERO_HEIGHT = 220;
const MOMENT_SIZE = 96;
const MAX_MOMENTS = 10;
const ACTIONS_SPACE = 120;
const RANK_SIZE = 28;

export default function RecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = id ?? '';
  const insets = useSafeAreaInsets();
  const p = usePastTrip(tripId);

  if (!p.data || !p.stats) {
    return (
      <View style={[styles.root, styles.center]}>
        {p.error ? <Text style={styles.muted}>{p.error}</Text> : <ActivityIndicator color={Colors.primary} />}
      </View>
    );
  }

  const { trip, photos } = p.data;
  const stats = p.stats;
  const dates = formatStopRange(trip.startDate, trip.endDate);
  const cover = trip.coverUrl ?? photos[0]?.photoUrl ?? null;

  const share = () => {
    void Share.share({ message: buildRecapMessage({ name: trip.name, dates, stats, top: p.top }) });
  };

  const tiles: { value: string; label: string }[] = [
    { value: String(stats.days), label: stats.days > 1 ? 'jours' : 'jour' },
    { value: String(stats.cities), label: stats.cities > 1 ? 'villes' : 'ville' },
    { value: String(stats.places), label: stats.places > 1 ? 'lieux' : 'lieu' },
    { value: String(stats.photos), label: stats.photos > 1 ? 'photos' : 'photo' },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader title="Récap" onClose={() => router.back()} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: ACTIONS_SPACE + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Le résumé de votre voyage : les chiffres, vos lieux préférés et les trophées du groupe. À garder, et à partager.
        </Text>

        {/* Couverture */}
        <View style={styles.hero}>
          {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <LinearGradient colors={[Colors.scrimClear, Colors.scrimStrong]} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroText}>
            <Text style={styles.heroName} numberOfLines={2}>{trip.name}</Text>
            <Text style={styles.heroDates}>{dates} · {plural(p.data.members.length, 'voyageur')}</Text>
          </View>
        </View>

        {/* Chiffres clés */}
        <View style={styles.stats}>
          {tiles.map(t => (
            <View key={t.label} style={styles.stat}>
              <Text style={styles.statValue}>{t.value}</Text>
              <Text style={styles.statLabel}>{t.label}</Text>
            </View>
          ))}
        </View>
        {stats.total > 0 && (
          <View style={styles.money}>
            <Ionicons name="wallet-outline" size={20} color={Colors.white} />
            <Text style={styles.moneyText}>
              {formatEuros(stats.total)} dépensés · ≈ {formatEuros(stats.perPerson)} par personne
            </Text>
          </View>
        )}

        {/* Podium */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LE PODIUM</Text>
          {p.top.length === 0 ? (
            <TouchableOpacity style={styles.card} onPress={() => router.push({ pathname: '/trip/[id]/past-avis', params: { id: tripId } })}>
              <Text style={styles.muted}>Notez vos lieux pour découvrir votre podium.</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.card}>
              {p.top.map((item, i) => (
                <View key={item.wishId} style={[styles.podiumRow, i > 0 && styles.rowBorder]}>
                  <View style={[styles.rank, i === 0 && styles.rankFirst]}>
                    <Text style={[styles.rankText, i === 0 && styles.rankTextFirst]}>{i + 1}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                    <StarRating value={item.avgRating} size={12} />
                  </View>
                  <Text style={styles.score}>{(item.avgRating ?? 0).toFixed(1).replace('.', ',')}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Trophées */}
        {p.badges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>LES TROPHÉES</Text>
            <View style={styles.card}>
              {p.badges.map((b, i) => (
                <View key={b.id} style={[styles.badgeRow, i > 0 && styles.rowBorder]}>
                  <View style={styles.badgeIcon}>
                    <Ionicons name={b.icon} size={18} color={Colors.white} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{b.title}</Text>
                    <Text style={styles.muted} numberOfLines={1}>{b.winner.nickname} · {b.detail}</Text>
                  </View>
                  <Avatar name={b.winner.nickname} uri={b.winner.avatarUrl ?? undefined} size={36} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Trajet */}
        {p.stops.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>LE TRAJET</Text>
            <View style={styles.card}>
              {p.stops.map((s, i) => (
                <View key={s.id} style={[styles.stopRow, i > 0 && styles.rowBorder]}>
                  <View style={styles.stopDot}><Text style={styles.stopNumber}>{i + 1}</Text></View>
                  <Text style={[styles.rowTitle, styles.flex]} numberOfLines={1}>{s.place_name}</Text>
                  <Text style={styles.muted}>{formatStopRange(s.start_date, s.end_date)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Moments */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>LES MOMENTS</Text>
            <TouchableOpacity onPress={() => router.push({ pathname: '/trip/[id]/past-photos', params: { id: tripId } })}>
              <Text style={styles.link}>{photos.length > 0 ? 'Tout voir' : 'Ajouter'}</Text>
            </TouchableOpacity>
          </View>
          {photos.length === 0 ? (
            <Text style={styles.muted}>Pas encore de photos dans l’album.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moments}>
              {photos.slice(0, MAX_MOMENTS).map(ph => (
                <Image key={ph.id} source={{ uri: ph.photoUrl }} style={styles.moment} />
              ))}
            </ScrollView>
          )}
          <PrintAlbumBanner tripId={tripId} photoCount={photos.length} />
        </View>
      </ScrollView>

      <StepActions onBack={() => router.back()} onNext={share} label="Partager le récap" variant="accent" bottomInset={insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.lg, gap: Spacing.lg },
  intro: { ...Typography.body, color: Colors.textMuted, marginBottom: -Spacing.sm },
  hero: {
    height: HERO_HEIGHT, borderRadius: Radii.pill, overflow: 'hidden', justifyContent: 'flex-end',
    borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.primary, ...Shadows.md,
  },
  heroText: { padding: Spacing.md2, gap: Spacing.xs },
  heroName: { fontFamily: Fonts.displayBold, fontSize: 34, lineHeight: 38, color: Colors.white },
  heroDates: { ...Typography.body, color: Colors.white },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  stat: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radii.lg,
    backgroundColor: Colors.surface, ...Shadows.card,
  },
  statValue: { ...Typography.displayValue, color: Colors.textPrimary },
  statLabel: { ...Typography.bodySmall, color: Colors.textMuted },
  money: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.primary,
  },
  moneyText: { flex: 1, ...Typography.body, color: Colors.white },
  section: { gap: Spacing.sm2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...Typography.displayLabel, color: Colors.textPrimary },
  link: { ...Typography.chip, color: Colors.accent },
  card: { borderRadius: Radii.lg, backgroundColor: Colors.surface, padding: Spacing.md, ...Shadows.card },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.line },
  rowTitle: { ...Typography.rowTitle, color: Colors.textInk },
  muted: { ...Typography.body, color: Colors.textMuted },
  podiumRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, paddingVertical: Spacing.sm2 },
  rank: {
    width: RANK_SIZE, height: RANK_SIZE, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  rankFirst: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  rankText: { ...Typography.chip, color: Colors.textPrimary },
  rankTextFirst: { color: Colors.white },
  score: { ...Typography.displayValue, fontSize: 20, color: Colors.textPrimary },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, paddingVertical: Spacing.sm2 },
  badgeIcon: {
    width: 36, height: 36, borderRadius: Radii.full, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, paddingVertical: Spacing.sm2 },
  stopDot: {
    width: RANK_SIZE, height: RANK_SIZE, borderRadius: Radii.full, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  stopNumber: { ...Typography.chip, color: Colors.white },
  moments: { gap: Spacing.sm },
  moment: { width: MOMENT_SIZE, height: MOMENT_SIZE, borderRadius: Radii.sm, backgroundColor: Colors.line },
});
