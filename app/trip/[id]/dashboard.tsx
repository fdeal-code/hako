import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from "react-native-maps";

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { tripEvents } from '@/utils/events';
import { ExpandedMapView, CardLayout } from '@/components/map/ExpandedMapView';
import { GlassCard } from '@/components/ui/GlassCard';
import { NavButton } from '@/components/ui/NavButton';
import { InviteSheet } from '@/components/invitations/InviteSheet';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

/* ─── Constants ──────────────────────────────────────────────── */
const DOC_CAT_EMOJI: Record<string, string> = {
  vol: '✈️', hotel: '🏨', restaurant: '🍽️', transport: '🚗',
  passeport: '🛂', assurance: '🛡️', visa: '📋', activite: '🎭', autre: '📄',
};

const AVATAR_COLORS = ['#E8C5A5', '#A5B8E0', '#A8D5B5', '#F0B0B0'];

/* ─── Types ──────────────────────────────────────────────────── */
interface TripData {
  id: string;
  name: string;
  destination: string;
  cover_image_url: string | null;
  start_date: string;
  end_date: string;
  owner_id: string | null;
}

interface MemberDisplay {
  user_id: string;
  name: string;
  avatar_url?: string;
}

/* ─── Helpers ────────────────────────────────────────────────── */
const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
function formatDateBadge(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end   + 'T00:00:00');
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${MONTHS[s.getMonth()]} – ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
}

/* ─── Main screen ────────────────────────────────────────────── */
export default function DashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();
  const { session } = useAuth();

  const mapCardRef = useRef<View>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mapCardLayout, setMapCardLayout] = useState<CardLayout>({ x: 0, y: 0, width: 0, height: 145 });

  /* Trip & members */
  const [trip,    setTrip]    = useState<TripData | null>(null);
  const [members, setMembers] = useState<MemberDisplay[]>([]);
  const [isOwner, setIsOwner] = useState(false);

  /* Sheets */
  const [showInviteSheet,   setShowInviteSheet]   = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);

  /* Documents */
  const [recentDocs, setRecentDocs] = useState<{ id: string; title: string; category: string }[]>([]);
  const [docCount,   setDocCount]   = useState(0);

  /* Map region */
  const [region, setRegion] = useState({
    latitude: 48.8566, longitude: 2.3522,
    latitudeDelta: 0.5, longitudeDelta: 0.5,
  });

  /* ── Fetch all data ── */
  useEffect(() => {
    if (!id) return;

    /* Trip */
    supabase
      .from('trips')
      .select('id, name, destination, cover_image_url, start_date, end_date, owner_id')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          setTrip(data);
          setIsOwner(data.owner_id === session?.user?.id);

          /* Geocode destination */
          const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
          if (key && data.destination) {
            fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(data.destination)}&key=${key}`)
              .then(r => r.json())
              .then(json => {
                if (json.status === 'OK' && json.results.length > 0) {
                  const { lat, lng } = json.results[0].geometry.location;
                  setRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.5, longitudeDelta: 0.5 });
                }
              })
              .catch(() => {});
          }
        }
      });

    /* Members */
    supabase
      .from('trip_members')
      .select('user_id, role, profile:profiles(nickname, avatar_url)')
      .eq('trip_id', id)
      .then(({ data }) => {
        const display: MemberDisplay[] = (data ?? []).map((m: any) => {
          const p = m.profile ?? {};
          return {
            user_id:    m.user_id,
            name:       p.nickname ?? 'Membre',
            avatar_url: p.avatar_url ?? undefined,
          };
        });
        setMembers(display);
      });

    /* Documents */
    supabase
      .from('documents')
      .select('id, title, category')
      .eq('trip_id', id)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setRecentDocs(data ?? []));

    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('trip_id', id)
      .then(({ count }) => setDocCount(count ?? 0));

  }, [id, session?.user?.id]);

  const handleMapPress = useCallback(() => {
    mapCardRef.current?.measureInWindow((x, y, width, height) => {
      setMapCardLayout({ x, y, width, height });
      setIsMapExpanded(true);
    });
  }, []);

  const dateLabel = trip ? formatDateBadge(trip.start_date, trip.end_date) : '';

  return (
    <View style={styles.root}>

      <Stack.Screen options={{ animation: 'fade', headerShown: false }} />

      {/* ── Background photo ── */}
      {trip?.cover_image_url ? (
        <Image source={{ uri: trip.cover_image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0D1B2A' }]} />
      )}
      <View style={styles.bgDim} />

      {/* ── Foreground layout ── */}
      <View style={[styles.fg, { paddingTop: insets.top }]}>

        {/* ── HEADER ── */}
        <Animated.View entering={FadeIn.duration(350).delay(180)} style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Destination name */}
          <Text style={styles.destText} numberOfLines={1}>
            {trip?.destination?.toUpperCase() ?? ''}
          </Text>

          {/* Badge date + avatars */}
          <View style={styles.headerMeta}>
            <BlurView intensity={50} tint="dark" style={styles.dateBadge}>
              <Text style={styles.dateBadgeText}>{dateLabel}</Text>
            </BlurView>

            <View style={styles.avatarsRow}>
              {members.slice(0, 3).map((m, i) => (
                <View
                  key={m.user_id}
                  style={[
                    styles.avatar,
                    { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length], marginLeft: i > 0 ? -9 : 0, zIndex: 10 - i },
                  ]}
                >
                  {m.avatar_url ? (
                    <Image source={{ uri: m.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarInitial}>{m.name[0]?.toUpperCase() ?? '?'}</Text>
                  )}
                </View>
              ))}
              {isOwner && (
                <TouchableOpacity
                  style={styles.addMemberBtn}
                  activeOpacity={0.8}
                  onPress={() => setShowInviteSheet(true)}
                >
                  <Ionicons name="add" size={13} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>

        {/* ── BENTO GRID ── */}
        <Animated.View entering={FadeInUp.duration(500).delay(300)} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 110 },
          ]}
        >
          {/* ── Row 1 : Documents + Planning ── */}
          <View style={styles.row}>

            {/* Documents */}
            <GlassCard
              flex={1}
              minHeight={140}
              onPress={() => router.push(`/trip/${id}/documents`)}
            >
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>DOCUMENTS</Text>
                <Text style={styles.cardCount}>{docCount}</Text>
              </View>
              {recentDocs.length === 0 ? (
                <Text style={styles.docEmpty}>Aucun document</Text>
              ) : (
                <View style={styles.docList}>
                  {recentDocs.map(doc => (
                    <View key={doc.id} style={styles.docRow}>
                      <Text style={styles.docEmoji}>{DOC_CAT_EMOJI[doc.category] ?? '📄'}</Text>
                      <Text style={styles.docText} numberOfLines={1}>{doc.title}</Text>
                    </View>
                  ))}
                </View>
              )}
            </GlassCard>

            {/* Planning */}
            <GlassCard
              flex={1}
              minHeight={140}
              onPress={() => router.push(`/trip/${id}/planning`)}
            >
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>PLANNING</Text>
                <Ionicons name="calendar-outline" size={15} color="rgba(255,255,255,0.7)" />
              </View>
              <Text style={styles.planningInfo}>Voir le planning</Text>
            </GlassCard>

          </View>

          {/* ── Row 2 : Map (full width) ── */}
          <View ref={mapCardRef} collapsable={false}>
            <GlassCard height={145} noPadding onPress={handleMapPress}>
              <MapView
                style={StyleSheet.absoluteFill}
                initialRegion={region}
                region={region}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }} />
              </MapView>
              <View style={styles.mapLabelWrap}>
                <Ionicons name="map-outline" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.mapLabel}>{trip?.destination ?? ''}</Text>
              </View>
            </GlassCard>
          </View>

          {/* ── Row 3 : Envies + Budget ── */}
          <View style={styles.row}>

            <GlassCard
              flex={1}
              minHeight={115}
              onPress={() => router.push(`/trip/${id}/envies`)}
            >
              <Text style={styles.cardTitle}>VOS ENVIES</Text>
              <View style={styles.addCircle}>
                <Ionicons name="heart-outline" size={20} color="#fff" />
              </View>
            </GlassCard>

            <GlassCard
              flex={1}
              minHeight={115}
              onPress={() => router.push(`/trip/${id}/budget`)}
            >
              <Text style={styles.cardTitle}>BUDGET</Text>
              <View style={styles.addCircle}>
                <Ionicons name="add" size={20} color="#fff" />
              </View>
              <Text style={styles.budgetSub}>Créer un tricount</Text>
            </GlassCard>

          </View>
        </ScrollView>
        </Animated.View>
      </View>

      {/* ── BOTTOM NAV ── */}
      <View
        style={[styles.bottomNav, { bottom: Math.max(insets.bottom, 10) + 16 }]}
        pointerEvents="box-none"
      >
        <NavButton icon="arrow-back-outline" onPress={() => router.back()} />
        <NavButton icon="add" iconSize={28} onPress={() => setShowInviteSheet(true)} />
        <NavButton icon="settings-outline" onPress={() => setShowSettingsSheet(true)} />
      </View>

      {isMapExpanded && (
        <ExpandedMapView
          cardLayout={mapCardLayout}
          onClose={() => setIsMapExpanded(false)}
          tripId={id}
          destination={trip?.destination}
          region={region}
        />
      )}

      {/* ── Invite sheet ── */}
      <InviteSheet
        visible={showInviteSheet}
        onClose={() => setShowInviteSheet(false)}
        tripId={id ?? ''}
      />

      {/* ── Settings sheet ── */}
      <DashboardSettingsSheet
        visible={showSettingsSheet}
        onClose={() => setShowSettingsSheet(false)}
        tripId={id ?? ''}
        tripName={trip?.name ?? ''}
        members={members}
        isOwner={isOwner}
        onInvite={() => { setShowSettingsSheet(false); setShowInviteSheet(true); }}
      />

    </View>
  );
}

/* ─── DashboardSettingsSheet ─────────────────────────────────── */
function DashboardSettingsSheet({
  visible,
  onClose,
  tripId,
  tripName,
  members,
  isOwner,
  onInvite,
}: {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  tripName: string;
  members: MemberDisplay[];
  isOwner: boolean;
  onInvite: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = () => {
    Alert.alert('Supprimer le voyage', 'Êtes-vous sûr ? Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          await supabase.from('trip_members').delete().eq('trip_id', tripId);
          await supabase.from('trips').delete().eq('id', tripId);
          tripEvents.emit();
          setDeleting(false);
          onClose();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ss.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={ss.container}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <View style={ss.handleBar} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.scroll}>

            <View style={ss.header}>
              <Text style={ss.title}>Paramètres</Text>
              <TouchableOpacity onPress={onClose} style={ss.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={ss.sectionLabel}>Membres ({members.length})</Text>
            {members.length === 0 ? (
              <Text style={ss.empty}>Aucun membre pour l'instant.</Text>
            ) : (
              members.map((m, i) => (
                <View key={m.user_id} style={ss.memberRow}>
                  <View style={[ss.avatar, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }]}>
                    {m.avatar_url
                      ? <Image source={{ uri: m.avatar_url }} style={{ width: '100%', height: '100%' }} />
                      : <Text style={ss.avatarInitial}>{m.name[0]?.toUpperCase() ?? '?'}</Text>
                    }
                  </View>
                  <Text style={ss.memberName}>{m.name}</Text>
                </View>
              ))
            )}

            {isOwner && (
              <TouchableOpacity style={ss.inviteBtn} onPress={onInvite} activeOpacity={0.8}>
                <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
                <Text style={ss.inviteBtnText}>Inviter par email</Text>
              </TouchableOpacity>
            )}

            {isOwner && (
              <View style={ss.danger}>
                <TouchableOpacity
                  style={[ss.deleteBtn, deleting && { opacity: 0.6 }]}
                  onPress={handleDelete}
                  disabled={deleting}
                  activeOpacity={0.85}
                >
                  {deleting
                    ? <ActivityIndicator color="#E53935" />
                    : <>
                        <Ionicons name="trash-outline" size={18} color="#E53935" />
                        <Text style={ss.deleteBtnText}>Supprimer le voyage</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const ss = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  container: { borderTopLeftRadius: Radii.xl, borderTopRightRadius: Radii.xl, overflow: 'hidden', maxHeight: '75%' },
  handleBar: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.sm, marginBottom: Spacing.sm },
  scroll: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  closeBtn: { padding: Spacing.xs },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  empty: { fontSize: 13, color: Colors.textTertiary, fontStyle: 'italic', marginBottom: Spacing.sm },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  memberName: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  inviteBtnText: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
  danger: { marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: '#FFF0F0', borderRadius: Radii.md, paddingVertical: Spacing.md, borderWidth: 1, borderColor: '#FFD0D0' },
  deleteBtnText: { fontSize: 15, fontWeight: '700', color: '#E53935' },
});

/* ─── Styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D1B2A',
  },

  /* Background */
  bgDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,15,30,0.25)',
  },
  fg: {
    flex: 1,
  },

  /* ── Header ── */
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  destText: {
    fontSize: 58,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.90)',
    letterSpacing: 3,
    lineHeight: 62,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  dateBadge: {
    overflow: 'hidden',
    borderRadius: Radii.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  dateBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addMemberBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -9,
  },

  /* ── Scroll ── */
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },

  /* ── Card text styles ── */
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  /* ── Documents ── */
  cardCount: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
  },
  docList: {
    gap: 6,
    marginTop: Spacing.sm,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  docEmoji: {
    fontSize: 12,
  },
  docEmpty: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic',
    marginTop: Spacing.sm,
  },
  docText: {
    flex: 1,
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },

  /* ── Planning ── */
  planningInfo: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    lineHeight: 20,
    marginTop: Spacing.sm,
  },

  /* ── Map ── */
  mapLabelWrap: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  mapLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },

  /* ── Budget ── */
  addCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 2,
  },
  budgetSub: {
    fontSize: 10,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
  },

  /* ── Bottom nav ── */
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
});
