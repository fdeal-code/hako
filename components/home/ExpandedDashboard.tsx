import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from "react-native-maps";
import * as ImagePicker from 'expo-image-picker';

import { Colors, Spacing, Radii } from '@/constants/theme';
import { ExpandedMapView } from '@/components/map/ExpandedMapView';
import { GlassCard } from '@/components/ui/GlassCard';
import { Trip } from '@/constants/types';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { tripEvents } from '@/utils/events';

/* ─── Constants ──────────────────────────────────────────────── */
const ENVIE_IMG =
  'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=400&q=60';
const DOC_ITEMS = ["Passeport", "Billets d'avion", "Réservation"];
const AVATAR_BG = ['#E8C5A5', '#A5B8E0', '#A8D5B5', '#F0B0B0'];

function formatDateLabel(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const M = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${M[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${M[s.getMonth()]} – ${M[e.getMonth()]} ${e.getFullYear()}`;
}

/** YYYY-MM-DD → JJ/MM/AAAA */
function isoToDisplay(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** JJ/MM/AAAA → YYYY-MM-DD, null si invalide */
function parseDate(s: string): string | null {
  if (!s.trim()) return null;
  const parts = s.trim().split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (y.length !== 4) return null;
  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  if (isNaN(new Date(iso).getTime())) return null;
  return iso;
}

/* ─── ExpandedDashboard ──────────────────────────────────────── */
export interface CardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  trip: Trip;
  cardLayout: CardLayout;
  progress: SharedValue<number>;
}

export function ExpandedDashboard({ trip, cardLayout, progress }: Props) {
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const { session } = useAuth();

  const mapCardRef = useRef<View>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mapCardLayout, setMapCardLayout] = useState<CardLayout>({ x: 0, y: 0, width: 0, height: 145 });
  const [showSettings, setShowSettings] = useState(false);

  const isOwner = session?.user?.id === trip.created_by;

  const handleMapPress = useCallback(() => {
    mapCardRef.current?.measureInWindow((x, y, width, height) => {
      setMapCardLayout({ x, y, width, height });
      setIsMapExpanded(true);
    });
  }, []);

  /* ── Hero : s'anime depuis la card vers le plein écran ── */
  const heroStyle = useAnimatedStyle(() => {
    'worklet';
    const p = progress.value;
    return {
      left:         interpolate(p, [0, 1], [cardLayout.x, 0]),
      top:          interpolate(p, [0, 1], [cardLayout.y, 0]),
      width:        interpolate(p, [0, 1], [cardLayout.width,  SCREEN_W]),
      height:       interpolate(p, [0, 1], [cardLayout.height, SCREEN_H]),
      borderRadius: interpolate(p, [0, 1], [20, 0]),
    };
  });

  /* ── Header : fade in + slide down ── */
  const headerStyle = useAnimatedStyle(() => {
    'worklet';
    const p = progress.value;
    return {
      opacity:   interpolate(p, [0.55, 0.9], [0, 1], 'clamp'),
      transform: [{ translateY: interpolate(p, [0.55, 0.9], [-14, 0], 'clamp') }],
    };
  });

  /* ── Bento : fade in + slide up ── */
  const bentoStyle = useAnimatedStyle(() => {
    'worklet';
    const p = progress.value;
    return {
      opacity:   interpolate(p, [0.65, 1], [0, 1], 'clamp'),
      transform: [{ translateY: interpolate(p, [0.65, 1], [28, 0], 'clamp') }],
    };
  });

  const dateLabel = formatDateLabel(trip.start_date, trip.end_date);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {/* ── Hero image (layer bas) : s'étend de la card au plein écran ── */}
      <Animated.View style={[styles.hero, heroStyle]}>
        <Image
          source={trip.cover_url ? { uri: trip.cover_url } : require('@/assets/images/icon.png')}
          style={{ width: SCREEN_W, height: SCREEN_H }}
          resizeMode="cover"
        />
        <View style={styles.bgDim} />
      </Animated.View>

      {/* ── Contenu dashboard (layer haut) ── */}
      <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top }]} pointerEvents="box-none">

        {/* Header */}
        <Animated.View style={[styles.header, headerStyle]}>
          <Text style={styles.destText}>{trip.destination.toUpperCase()}</Text>

          <View style={styles.headerMeta}>
            <BlurView intensity={50} tint="dark" style={styles.dateBadge}>
              <Text style={styles.dateBadgeText}>{dateLabel}</Text>
            </BlurView>

            <View style={styles.headerRight}>
              {/* Avatars */}
              <View style={styles.avatarsRow}>
                {trip.members.slice(0, 3).map((m, i) => (
                  <View
                    key={m.user_id}
                    style={[styles.avatar, {
                      backgroundColor: AVATAR_BG[i % AVATAR_BG.length],
                      marginLeft: i > 0 ? -9 : 0,
                      zIndex: 10 - i,
                    }]}
                  >
                    {m.user.avatar_url && (
                      <Image source={{ uri: m.user.avatar_url }} style={styles.avatarImg} />
                    )}
                  </View>
                ))}
                <TouchableOpacity style={styles.addMemberBtn} activeOpacity={0.8}>
                  <Ionicons name="add" size={13} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Settings gear — owner only */}
              {isOwner && (
                <TouchableOpacity
                  style={styles.settingsGearBtn}
                  onPress={() => setShowSettings(true)}
                  activeOpacity={0.75}
                >
                  <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                  <View style={styles.settingsGearBorder} />
                  <Ionicons name="settings-outline" size={18} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Bento grid */}
        <Animated.View style={[{ flex: 1 }, bentoStyle]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
          >
            {/* Row 1 : Documents + Planning */}
            <View style={styles.row}>
              <GlassCard flex={1} minHeight={140} onPress={() => router.push(`/trip/${trip.id}/documents`)}>
                <Text style={styles.cardTitle}>DOCUMENT</Text>
                <View style={styles.docList}>
                  {DOC_ITEMS.map((item, i) => (
                    <View key={i} style={styles.docRow}>
                      <View style={styles.bullet} />
                      <Text style={styles.docText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </GlassCard>

              <GlassCard flex={1} minHeight={140} onPress={() => router.push(`/trip/${trip.id}/planning`)}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>PLANNING</Text>
                  <Ionicons name="calendar-outline" size={15} color="rgba(255,255,255,0.7)" />
                </View>
                <Text style={styles.planningInfo}>{'02/06\nDépart de Lyon'}</Text>
              </GlassCard>
            </View>

            {/* Row 2 : Map */}
            <View ref={mapCardRef} collapsable={false}>
              <GlassCard height={145} noPadding onPress={handleMapPress}>
                <MapView
                  style={StyleSheet.absoluteFill}
                  initialRegion={{
                    latitude: 41.9028,
                    longitude: 12.4964,
                    latitudeDelta: 0.5,
                    longitudeDelta: 0.5,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                >
                  <Marker coordinate={{ latitude: 41.9028, longitude: 12.4964 }} />
                </MapView>
                <View style={styles.mapLabelWrap}>
                  <Ionicons name="map-outline" size={12} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.mapLabel}>Rome, Italie</Text>
                </View>
              </GlassCard>
            </View>

            {/* Row 3 : Envies + Budget */}
            <View style={styles.row}>
              <GlassCard
                flex={1}
                minHeight={115}
                backgroundImageUri={ENVIE_IMG}
                onPress={() => router.push(`/trip/${trip.id}/envies`)}
              >
                <Text style={styles.cardTitle}>VOS ENVIES</Text>
                <Text style={styles.enviesEmpty}>Espace vide</Text>
              </GlassCard>

              <GlassCard flex={1} minHeight={115} onPress={() => router.push(`/trip/${trip.id}/budget`)}>
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

      {isMapExpanded && (
        <ExpandedMapView
          cardLayout={mapCardLayout}
          onClose={() => setIsMapExpanded(false)}
        />
      )}

      {/* Settings sheet */}
      <TripSettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        trip={trip}
      />

    </View>
  );
}

/* ─── TripSettingsSheet ──────────────────────────────────────── */
function TripSettingsSheet({
  visible,
  onClose,
  trip,
}: {
  visible: boolean;
  onClose: () => void;
  trip: Trip;
}) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [name,        setName]        = useState(trip.name);
  const [destination, setDestination] = useState(trip.destination);
  const [startDate,   setStartDate]   = useState(isoToDisplay(trip.start_date));
  const [endDate,     setEndDate]     = useState(isoToDisplay(trip.end_date));
  const [coverUri,    setCoverUri]    = useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const handlePickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorise l'accès à ta galerie.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    const parsedStart = startDate ? parseDate(startDate) : null;
    const parsedEnd   = endDate   ? parseDate(endDate)   : null;

    if (startDate && !parsedStart) {
      Alert.alert('Date invalide', 'Format attendu : JJ/MM/AAAA pour la date de départ.');
      return;
    }
    if (endDate && !parsedEnd) {
      Alert.alert('Date invalide', 'Format attendu : JJ/MM/AAAA pour la date de retour.');
      return;
    }

    try {
      setSaving(true);
      const userId = session!.user.id;

      let coverImageUrl: string | null = trip.cover_url ?? null;
      if (coverUri) {
        const ext      = coverUri.split('.').pop() ?? 'jpg';
        const filePath = `${userId}/${Date.now()}.${ext}`;
        const formData = new FormData();
        formData.append('file', { uri: coverUri, name: `cover.${ext}`, type: `image/${ext}` } as any);
        const { error: uploadError } = await supabase.storage
          .from('covers')
          .upload(filePath, formData, { upsert: true, contentType: `image/${ext}` });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(filePath);
        coverImageUrl = publicUrl;
      }

      const { error } = await supabase
        .from('trips')
        .update({
          name:            name.trim(),
          destination:     destination.trim(),
          start_date:      parsedStart,
          end_date:        parsedEnd,
          cover_image_url: coverImageUrl,
        })
        .eq('id', trip.id);

      if (error) throw error;
      tripEvents.emit();
      onClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erreur lors de la sauvegarde.';
      Alert.alert('Erreur', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer le voyage',
      'Êtes-vous sûr ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            console.log('DELETING TRIP:', trip.id);

            const { error: memberError } = await supabase
              .from('trip_members')
              .delete()
              .eq('trip_id', trip.id);
            console.log('DELETE MEMBERS ERROR:', JSON.stringify(memberError));

            const { error: tripError } = await supabase
              .from('trips')
              .delete()
              .eq('id', trip.id);
            console.log('DELETE TRIP ERROR:', JSON.stringify(tripError));

            tripEvents.emit();
            setDeleting(false);
            onClose();
            setTimeout(() => {
              router.replace('/');
            }, 100);
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={sheet.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[sheet.container, { paddingBottom: insets.bottom + Spacing.md }]}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />

          {/* Handle bar */}
          <View style={sheet.handleBar} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sheet.scroll}>

            {/* Header */}
            <View style={sheet.header}>
              <Text style={sheet.title}>Paramètres du voyage</Text>
              <TouchableOpacity onPress={onClose} style={sheet.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* ── Section : Modifier ── */}
            <Text style={sheet.sectionLabel}>Modifier le voyage</Text>

            <SheetField label="Nom du voyage" value={name} onChangeText={setName} placeholder="Ex : Road trip Italie" />
            <SheetField label="Destination" value={destination} onChangeText={setDestination} placeholder="Ex : Italie" />
            <View style={sheet.dateRow}>
              <SheetField label="Départ" value={startDate} onChangeText={setStartDate} placeholder="JJ/MM/AAAA" style={{ flex: 1 }} />
              <SheetField label="Retour" value={endDate} onChangeText={setEndDate} placeholder="JJ/MM/AAAA" style={{ flex: 1 }} />
            </View>

            <TouchableOpacity style={sheet.coverBtn} onPress={handlePickCover} activeOpacity={0.8}>
              <Ionicons name="image-outline" size={18} color={Colors.primary} />
              <Text style={sheet.coverBtnText}>
                {coverUri ? 'Photo sélectionnée ✓' : 'Changer la photo de couverture'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[sheet.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={sheet.saveBtnText}>Sauvegarder</Text>
              }
            </TouchableOpacity>

            {/* ── Section : Membres ── */}
            <Text style={[sheet.sectionLabel, { marginTop: Spacing.lg }]}>Membres</Text>

            {trip.members.length === 0 ? (
              <Text style={sheet.emptyMembers}>Aucun membre pour l'instant.</Text>
            ) : (
              trip.members.map((m) => (
                <View key={m.user_id} style={sheet.memberRow}>
                  <View style={sheet.memberAvatar}>
                    {m.user.avatar_url ? (
                      <Image source={{ uri: m.user.avatar_url }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Text style={sheet.memberInitial}>{m.user.name?.[0]?.toUpperCase() ?? '?'}</Text>
                    )}
                  </View>
                  <Text style={sheet.memberName}>{m.user.name}</Text>
                  {m.role === 'owner' && (
                    <Text style={sheet.memberRole}>Organisateur</Text>
                  )}
                </View>
              ))
            )}

            <TouchableOpacity style={sheet.inviteBtn} activeOpacity={0.8}>
              <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
              <Text style={sheet.inviteBtnText}>Inviter par lien ou email</Text>
            </TouchableOpacity>

            {/* ── Section : Danger ── */}
            <View style={sheet.dangerSection}>
              <TouchableOpacity
                style={[sheet.deleteBtn, deleting && { opacity: 0.6 }]}
                onPress={handleDelete}
                disabled={deleting}
                activeOpacity={0.85}
              >
                {deleting
                  ? <ActivityIndicator color="#E53935" />
                  : (
                    <>
                      <Ionicons name="trash-outline" size={18} color="#E53935" />
                      <Text style={sheet.deleteBtnText}>Supprimer le voyage</Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ─── SheetField ─────────────────────────────────────────────── */
function SheetField({
  label,
  value,
  onChangeText,
  placeholder,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  style?: object;
}) {
  return (
    <View style={[sheet.field, style]}>
      <Text style={sheet.fieldLabel}>{label}</Text>
      <TextInput
        style={sheet.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
      />
    </View>
  );
}

/* ─── Sheet styles ───────────────────────────────────────────── */
const sheet = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  container: {
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  field: {
    marginBottom: Spacing.sm,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  coverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  coverBtnText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyMembers: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  memberName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  memberRole: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  inviteBtnText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  dangerSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FFF0F0',
    borderRadius: Radii.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: '#FFD0D0',
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E53935',
  },
});

/* ─── Main styles ────────────────────────────────────────────── */
const styles = StyleSheet.create({
  /* Hero */
  hero: {
    position: 'absolute',
    overflow: 'hidden',
  },
  bgDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,15,30,0.28)',
  },

  /* Header */
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
  destText: {
    fontSize: 68,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.90)',
    letterSpacing: 4,
    lineHeight: 72,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dateBadge: {
    overflow: 'hidden',
    borderRadius: 9999,
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
  avatarsRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
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

  /* Settings gear button */
  settingsGearBtn: {
    width: 40,
    height: 40,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  settingsGearBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.50)',
  },

  /* Scroll / Bento */
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  row: { flexDirection: 'row', gap: Spacing.sm },

  /* Card text styles */
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  /* Documents */
  docList: { gap: 7, marginTop: Spacing.sm },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.65)' },
  docText: { fontSize: 12, color: '#FFFFFF', fontWeight: '500' },

  /* Planning */
  planningInfo: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    lineHeight: 20,
    marginTop: Spacing.sm,
  },

  /* Map */
  mapLabelWrap: { position: 'absolute', bottom: 10, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.28)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999 },
  mapLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },

  /* Envies */
  enviesEmpty: { fontSize: 12, color: '#FFFFFF', fontStyle: 'italic', marginTop: Spacing.xs },

  /* Budget */
  addCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginVertical: 2 },
  budgetSub: { fontSize: 10, color: '#FFFFFF', textAlign: 'center', fontWeight: '500' },
});
