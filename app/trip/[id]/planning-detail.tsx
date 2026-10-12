// HAKO — Fiche d'une activité du planning (même langage que la fiche envie,
// maquettes « Envie · Détail vote » / « Validée à réserver »).
// Grande photo + grand mot, badge type · ville, partants ; titre ; billet ou
// réservation ; encarts QUAND (horaire modifiable) / DURÉE ; OÙ avec
// mini-carte et « Y aller » ; à savoir ; liens ; l'avis du groupe.

import { ComponentProps } from 'react';
import {
  ActivityIndicator, Alert, Image, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { NavButton } from '@/components/ui/NavButton';
import { placeMeta } from '@/components/map/TripMapParts';
import { useActivity } from '@/hooks/useActivity';
import { ActivityMember } from '@/types/activity';
import { bigWord, durationLabel } from '@/utils/activityDetail';
import { directionsUrl } from '@/utils/ongoingTrip';
import { longDayLabel } from '@/utils/planningDay';
import { durationMinutes, formatMinutes, priceLabel } from '@/utils/wishPriceDuration';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const HERO_HEIGHT = 300;
const AVATAR = 40;
const VOTE_AVATAR = 36;
const MAX_HERO_AVATARS = 4;
const MAP_HEIGHT = 150;
const MAP_DELTA = 0.01;
const STEP = 15;
const NAV_SPACE = 120;
const OS: 'ios' | 'android' | 'other' = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other';

function Avatar({ member, size, overlap }: { member: ActivityMember; size: number; overlap?: boolean }) {
  return (
    <View style={[styles.avatar, { width: size, height: size }, overlap && styles.avatarOverlap]}>
      {member.avatarUrl
        ? <Image source={{ uri: member.avatarUrl }} style={styles.avatarImg} />
        : <Text style={styles.avatarInitial}>{member.nickname[0]?.toUpperCase() ?? '?'}</Text>}
    </View>
  );
}

export default function ActivityScreen() {
  const { id: tripId, itemId } = useLocalSearchParams<{ id: string; itemId: string }>();
  const insets = useSafeAreaInsets();
  const a = useActivity(itemId);

  if (!a.item || !a.detail) {
    return (
      <View style={[styles.root, styles.center]}>
        {a.error ? <Text style={styles.muted}>{a.error}</Text> : <ActivityIndicator color={Colors.primary} />}
      </View>
    );
  }

  const item = a.item;
  const wish = item.wish;
  const isTransport = a.kind === 'transport';
  const meta = isTransport
    ? { icon: (a.ticket?.category === 'flight' ? 'airplane' : 'train') as IoniconName, label: 'Trajet' }
    : placeMeta(wish?.category ?? (a.kind === 'lodging' ? 'hotel' : null));
  const place = a.detail.stop?.place_name;
  const word = bigWord(wish?.category ?? null, item.title, isTransport);
  // Durée : celle du créneau, sinon celle prévue sur l'envie
  const wishMinutes = durationMinutes(wish?.duration_minutes, wish?.duration);
  const duration = durationLabel(item.start_time, item.end_time) ?? (wishMinutes !== null ? formatMinutes(wishMinutes) : null);
  const price = priceLabel(wish?.price_per_person, wish?.budget);
  const author = a.detail.members.find(m => m.userId === (wish?.added_by ?? item.added_by));
  const dest = { label: item.title, address: wish?.address ?? null, latitude: wish?.latitude ?? null, longitude: wish?.longitude ?? null };
  const goUrl = directionsUrl(dest, OS);
  const locked = item.is_locked === true;
  const links = [
    ...(wish?.link_url ? [{ url: wish.link_url, title: undefined as string | undefined }] : []),
    ...(wish?.links ?? []).map(l => ({ url: l.url, title: l.title })),
  ];

  const subtitle = wish
    ? `${wish.status === 'validated' ? 'Envie validée' : 'Envie à voter'}${author ? ` · proposée par ${author.nickname}` : ''}`
    : isTransport ? 'Trajet du voyage' : 'Créneau du planning';

  const save = () => { void a.saveTime().then(err => { if (err) Alert.alert('Oups', err); }); };
  const confirmRemove = () => Alert.alert(
    'Retirer du planning ?',
    wish ? `« ${item.title} » reste dans vos envies.` : `« ${item.title} » sera supprimé du planning.`,
    [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => { void a.remove().then(err => { if (err) Alert.alert('Oups', err); else router.back(); }); } },
    ],
  );
  const openLink = (url: string) => {
    if (url.includes('tiktok.com') || url.includes('instagram.com')) void Linking.openURL(url);
    else void WebBrowser.openBrowserAsync(url);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + NAV_SPACE }} showsVerticalScrollIndicator={false}>
        {/* ── Photo + grand mot ── */}
        <View style={styles.hero}>
          {wish?.image_url
            ? <Image source={{ uri: wish.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <View style={[StyleSheet.absoluteFill, styles.heroEmpty]} />}
          <View style={styles.heroDim} />
          <View style={[styles.heroContent, { paddingTop: insets.top + Spacing.sm }]}>
            <View>
              <Text style={styles.heroWord} numberOfLines={1} adjustsFontSizeToFit>{word}</Text>
              <View style={styles.heroMeta}>
                <View style={styles.badge}>
                  <Ionicons name={meta.icon} size={16} color={Colors.textPrimary} />
                  <Text style={styles.badgeText} numberOfLines={1}>{meta.label}{place ? ` · ${place}` : ''}</Text>
                </View>
                {a.partants.length > 0 && (
                  <View style={styles.avatars}>
                    {a.partants.slice(0, MAX_HERO_AVATARS).map((v, i) => (
                      <Avatar key={v.member.userId} member={v.member} size={AVATAR} overlap={i > 0} />
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sheet}>
          {/* ── Titre ── */}
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {/* ── Billet / réservation ── */}
          {a.ticket && (
            <TouchableOpacity
              style={styles.darkRow}
              onPress={() => router.push({ pathname: '/trip/[id]/document/[docId]', params: { id: tripId ?? '', docId: a.ticket?.id ?? '' } })}
              activeOpacity={0.9}
            >
              <View style={styles.darkRowIcon}><Ionicons name="ticket" size={16} color={Colors.white} /></View>
              <View style={styles.flex}>
                <Text style={styles.darkRowTitle}>Ton billet</Text>
                <Text style={styles.darkRowSub} numberOfLines={1}>
                  {[a.ticket.details?.from && a.ticket.details?.to ? `${a.ticket.details.from} → ${a.ticket.details.to}` : a.ticket.title,
                    a.ticket.details?.seat].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.white} />
            </TouchableOpacity>
          )}
          {wish?.booked_at && (
            <View style={styles.bookedRow}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
              <Text style={styles.bookedText}>Réservé{wish.booked_amount ? ` · ${Math.round(wish.booked_amount)} €` : ''}</Text>
            </View>
          )}

          {/* ── Quand / Durée ── */}
          {a.draft ? (
            <View style={styles.editCard}>
              <Text style={styles.sectionLabel}>CHANGER L’HORAIRE</Text>
              {(['start', 'end'] as const).map(which => (
                <View key={which} style={styles.editRow}>
                  <Text style={styles.editLabel}>{which === 'start' ? 'Début' : 'Fin'}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => a.shift(which, -STEP)} accessibilityLabel={`${which === 'start' ? 'Début' : 'Fin'} plus tôt`}>
                    <Ionicons name="remove" size={18} color={Colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.editValue}>{which === 'start' ? a.draft?.start : a.draft?.end}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => a.shift(which, STEP)} accessibilityLabel={`${which === 'start' ? 'Début' : 'Fin'} plus tard`}>
                    <Ionicons name="add" size={18} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.editActions}>
                <TouchableOpacity onPress={a.cancelEdit}><Text style={styles.cancel}>Annuler</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={a.saving}>
                  {a.saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveText}>Enregistrer</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.boxes}>
              <TouchableOpacity style={[styles.box, styles.boxLight]} onPress={locked || !item.start_time ? undefined : a.startEdit} activeOpacity={0.85}>
                <Text style={styles.boxLabel}>QUAND</Text>
                <Text style={styles.boxValue} numberOfLines={1}>{longDayLabel(item.day_date).split(' ').slice(0, 2).join(' ')}</Text>
                <Text style={styles.boxSub}>
                  {item.start_time ? `${item.start_time.slice(0, 5)}${item.end_time ? ` → ${item.end_time.slice(0, 5)}` : ''}` : 'Toute la journée'}
                </Text>
                {!locked && item.start_time && <Text style={styles.boxLink}>Modifier</Text>}
                {locked && <Text style={styles.boxSub}>Verrouillé</Text>}
              </TouchableOpacity>
              <View style={[styles.box, styles.boxDark]}>
                <Text style={[styles.boxLabel, styles.onDark]}>{isTransport ? 'TRAJET' : 'DURÉE'}</Text>
                <Text style={[styles.boxValue, styles.onDark]} numberOfLines={1}>{duration ?? '—'}</Text>
                <Text style={styles.boxSubAccent} numberOfLines={1}>
                  {[price ? `${price}${wish?.price_per_person ? ' / pers.' : ''}` : null,
                    wish?.google_rating ? `★ ${wish.google_rating.toFixed(1).replace('.', ',')}` : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
          )}

          {/* ── Où ── */}
          {(wish?.address || (wish?.latitude && wish?.longitude)) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>OÙ</Text>
              <View style={styles.whereCard}>
                {wish?.latitude && wish?.longitude ? (
                  <MapView
                    style={styles.map}
                    initialRegion={{ latitude: wish.latitude, longitude: wish.longitude, latitudeDelta: MAP_DELTA, longitudeDelta: MAP_DELTA }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                  >
                    <Marker coordinate={{ latitude: wish.latitude, longitude: wish.longitude }} />
                  </MapView>
                ) : null}
                <View style={styles.whereRow}>
                  <Text style={styles.address} numberOfLines={2}>{wish?.address ?? place ?? ''}</Text>
                  {goUrl && (
                    <TouchableOpacity style={styles.go} onPress={() => { void Linking.openURL(goUrl); }}>
                      <Ionicons name="navigate" size={14} color={Colors.white} />
                      <Text style={styles.goText}>Y aller</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* ── À savoir ── */}
          {(item.notes || wish?.description) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>À SAVOIR</Text>
              <View style={styles.card}>
                {item.notes ? <Text style={styles.body}>{item.notes}</Text> : null}
                {wish?.description ? <Text style={styles.body}>{wish.description}</Text> : null}
              </View>
            </View>
          )}

          {/* ── Liens (TikTok, site…) ── */}
          {links.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>LIENS</Text>
              {links.map(l => (
                <TouchableOpacity key={l.url} style={styles.linkRow} onPress={() => openLink(l.url)} activeOpacity={0.85}>
                  <Ionicons
                    name={l.url.includes('tiktok') ? 'musical-notes' : l.url.includes('instagram') ? 'logo-instagram' : 'link'}
                    size={18}
                    color={Colors.textInk}
                  />
                  <Text style={styles.linkTitle} numberOfLines={1}>{l.title ?? l.url.replace(/^https?:\/\/(www\.)?/, '')}</Text>
                  <Ionicons name="open-outline" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Le groupe ── */}
          {wish && (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>LE GROUPE</Text>
                <Text style={styles.sectionRight}>{a.partants.length}/{a.votes.length} partants</Text>
              </View>
              <View style={styles.card}>
                {a.votes.map((v, i) => (
                  <View key={v.member.userId} style={[styles.voteRow, i > 0 && styles.voteDivider]}>
                    <Avatar member={v.member} size={VOTE_AVATAR} />
                    <Text style={styles.voteName} numberOfLines={1}>{v.member.nickname}</Text>
                    <Text style={[styles.voteStatus, v.vote === 'up' && styles.voteUp]}>
                      {v.vote === 'up' ? 'Partant ✓' : v.vote === 'down' ? 'Pas chaud' : 'Pas encore voté'}
                    </Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity onPress={() => router.push({ pathname: '/trip/[id]/envies', params: { id: tripId ?? '', wish: wish.id } })}>
                <Text style={styles.seeWish}>Voir l’envie et les commentaires ›</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Barre du bas ── */}
      <View style={[styles.nav, { bottom: Math.max(insets.bottom, 10) + Spacing.md }]} pointerEvents="box-none">
        <NavButton icon="arrow-back-outline" onPress={() => router.back()} />
        {goUrl && <NavButton icon="navigate" iconSize={24} variant="accent" onPress={() => { void Linking.openURL(goUrl); }} />}
        {!locked && <NavButton icon="trash-outline" onPress={confirmRemove} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceAlt },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  hero: { height: HERO_HEIGHT, overflow: 'hidden' },
  heroEmpty: { backgroundColor: Colors.primary },
  heroDim: { ...StyleSheet.absoluteFill, backgroundColor: Colors.overlay },
  heroContent: { flex: 1, paddingHorizontal: Spacing.md2, paddingBottom: Spacing.xl + Spacing.sm, justifyContent: 'flex-end' },
  heroWord: { fontFamily: Fonts.displayBold, fontSize: 80, lineHeight: 92, color: Colors.white, opacity: 0.88 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1,
    height: 44, paddingHorizontal: Spacing.md2, borderRadius: Radii.pill, backgroundColor: Colors.background, ...Shadows.md,
  },
  badgeText: { flexShrink: 1, ...Typography.filter, color: Colors.textPrimary },
  avatars: { flexDirection: 'row' },
  avatar: {
    borderRadius: Radii.full, overflow: 'hidden', borderWidth: 2, borderColor: Colors.white,
    backgroundColor: Colors.line, alignItems: 'center', justifyContent: 'center',
  },
  avatarOverlap: { marginLeft: -14 },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  sheet: {
    marginTop: -Spacing.xl, paddingTop: Spacing.xl, paddingHorizontal: Spacing.md2, gap: Spacing.md,
    borderTopLeftRadius: Radii.sheet, borderTopRightRadius: Radii.sheet, backgroundColor: Colors.surfaceAlt,
  },
  titleBlock: { gap: Spacing.xs },
  title: { fontFamily: Fonts.display, fontSize: 28, color: Colors.textPrimary },
  subtitle: { ...Typography.body, color: Colors.textMuted },
  muted: { ...Typography.body, color: Colors.textMuted },
  darkRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2,
    padding: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.primary, ...Shadows.md,
  },
  darkRowIcon: { width: 32, height: 32, borderRadius: Radii.full, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  darkRowTitle: { ...Typography.rowTitle, color: Colors.white },
  darkRowSub: { ...Typography.bodySmall, color: Colors.textOnDark },
  bookedRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2,
    padding: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.accent, ...Shadows.md,
  },
  bookedText: { flex: 1, ...Typography.rowTitle, color: Colors.white },
  boxes: { flexDirection: 'row', gap: Spacing.sm2 - 2 },
  box: { flex: 1, gap: 2, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md2, borderRadius: Radii.pill },
  boxLight: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.primary },
  boxDark: { backgroundColor: Colors.primary },
  boxLabel: { ...Typography.displayLabel, color: Colors.textPrimary },
  boxValue: { fontFamily: Fonts.display, fontSize: 26, color: Colors.textPrimary, marginTop: Spacing.sm },
  boxSub: { ...Typography.bodySmall, color: Colors.textMuted },
  boxSubAccent: { ...Typography.bodySmall, color: Colors.accent },
  boxLink: { ...Typography.bodySmall, fontWeight: '700', color: Colors.accent, marginTop: Spacing.xs },
  onDark: { color: Colors.white },
  editCard: { gap: Spacing.sm2, padding: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2 },
  editLabel: { flex: 1, ...Typography.rowTitle, color: Colors.textInk },
  editValue: { width: 64, textAlign: 'center', fontFamily: Fonts.display, fontSize: 22, color: Colors.textPrimary },
  stepBtn: {
    width: 36, height: 36, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background,
  },
  editActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.md },
  cancel: { ...Typography.body, fontWeight: '600', color: Colors.textMuted },
  saveBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm2, borderRadius: Radii.full, backgroundColor: Colors.accent },
  saveText: { ...Typography.chip, color: Colors.white },
  section: { gap: Spacing.sm2 - 2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { ...Typography.displayLabel, color: Colors.textPrimary },
  sectionRight: { fontSize: 12, fontWeight: '600', color: Colors.accent },
  whereCard: { borderRadius: Radii.lg, backgroundColor: Colors.surface, overflow: 'hidden', ...Shadows.card },
  map: { height: MAP_HEIGHT },
  whereRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.md },
  address: { flex: 1, ...Typography.body, color: Colors.textInk },
  go: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.sm2, paddingVertical: Spacing.sm, borderRadius: Radii.full, backgroundColor: Colors.accent,
  },
  goText: { ...Typography.chip, color: Colors.white },
  card: { gap: Spacing.sm, padding: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card },
  body: { ...Typography.body, color: Colors.textInk },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, minHeight: 52,
    paddingHorizontal: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card,
  },
  linkTitle: { flex: 1, ...Typography.rowTitle, color: Colors.textInk },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, paddingVertical: Spacing.xs },
  voteDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.line, paddingTop: Spacing.sm },
  voteName: { flex: 1, ...Typography.rowTitle, color: Colors.textInk },
  voteStatus: { ...Typography.bodySmall, color: Colors.textMuted },
  voteUp: { fontWeight: '700', color: Colors.accent },
  seeWish: { ...Typography.body, fontWeight: '600', color: Colors.accent, textAlign: 'center', paddingVertical: Spacing.sm },
  nav: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 14 },
});
