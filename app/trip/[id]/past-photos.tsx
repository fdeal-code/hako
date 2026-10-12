// HAKO — Album photo du voyage (après le voyage)
// Grille de toutes les photos du groupe, import de plusieurs photos d'un coup,
// visionneuse plein écran (qui l'a ajoutée, quand), suppression de ses photos.

import { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, StepActions } from '@/components/createTrip/CreateTripChrome';
import { Avatar } from '@/components/ui/Avatar';
import { PrintAlbumBanner } from '@/components/past/PrintAlbumBanner';
import { usePastTrip } from '@/hooks/usePastTrip';
import { PastMember, TripPhoto } from '@/types/pastTrip';
import { plural } from '@/utils/dashboardSummary';
import { BACK_ICON } from '@/components/ui/NavButton';

const COLUMNS = 3;
const GRID_GAP = Spacing.xs;
const ACTIONS_SPACE = 120;
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function addedOn(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()] ?? ''}`;
}

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const p = usePastTrip(id);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const photos = p.data?.photos ?? [];
  const members = useMemo(() => new Map((p.data?.members ?? []).map(m => [m.userId, m])), [p.data]);
  const contributors = new Set(photos.map(ph => ph.uploadedBy)).size;
  const cell = (width - Spacing.md2 * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

  const importPhotos = () => { void p.importPhotos().then(error => { if (error) Alert.alert('Oups', error); }); };

  const confirmDelete = (photo: TripPhoto) => Alert.alert('Retirer cette photo ?', 'Elle disparaît de l’album pour tout le groupe.', [
    { text: 'Annuler', style: 'cancel' },
    {
      text: 'Retirer', style: 'destructive',
      onPress: () => {
        setViewerIndex(null);
        void p.removePhoto(photo).then(error => { if (error) Alert.alert('Oups', error); });
      },
    },
  ]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader title="Album" />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: ACTIONS_SPACE + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Nos photos</Text>
          <Text style={styles.subtitle}>
            {photos.length > 0
              ? `${plural(photos.length, 'photo')} · par ${plural(contributors, 'voyageur')}`
              : 'Chacun ajoute les siennes : l’album se remplit tout seul.'}
          </Text>
        </View>

        <PrintAlbumBanner tripId={id ?? ''} photoCount={photos.length} />

        {!p.data ? (
          p.error ? <Text style={styles.subtitle}>Chargement impossible : {p.error}</Text>
            : <ActivityIndicator color={Colors.primary} style={styles.loader} />
        ) : photos.length === 0 ? (
          <TouchableOpacity style={styles.empty} onPress={importPhotos} activeOpacity={0.85} disabled={p.uploading}>
            <View style={styles.emptyIcon}>
              {p.uploading ? <ActivityIndicator color={Colors.white} /> : <Ionicons name="images" size={28} color={Colors.white} />}
            </View>
            <Text style={styles.emptyTitle}>Importe vos photos</Text>
            <Text style={styles.emptySub}>Choisis-en plusieurs d’un coup dans ta galerie</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.grid}>
            {photos.map((photo, index) => (
              <TouchableOpacity key={photo.id} onPress={() => setViewerIndex(index)} activeOpacity={0.85}>
                <Image source={{ uri: photo.photoUrl }} style={[styles.cell, { width: cell, height: cell }]} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <StepActions
        onBack={() => router.back()}
        onNext={importPhotos}
        label="Ajouter des photos"
        icon="add"
        loading={p.uploading}
        variant="accent"
        bottomInset={insets.bottom}
      />

      <PhotoViewer
        photos={photos}
        index={viewerIndex}
        members={members}
        currentUserId={p.userId}
        onClose={() => setViewerIndex(null)}
        onDelete={confirmDelete}
      />
    </View>
  );
}

// ─── Visionneuse plein écran (balayage horizontal) ───────────────────────────
function PhotoViewer({ photos, index, members, currentUserId, onClose, onDelete }: {
  photos: readonly TripPhoto[];
  index: number | null;
  members: ReadonlyMap<string, PastMember>;
  currentUserId: string | null;
  onClose: () => void;
  onDelete: (photo: TripPhoto) => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(0);
  const shown = index ?? 0;
  const photo = photos[current] ?? photos[shown];
  const author = photo ? members.get(photo.uploadedBy) : undefined;

  return (
    <Modal visible={index !== null} animationType="fade" onRequestClose={onClose} onShow={() => setCurrent(shown)}>
      <View style={styles.viewer}>
        <FlatList
          data={photos}
          keyExtractor={item => item.id}
          horizontal
          pagingEnabled
          initialScrollIndex={shown}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={e => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Image source={{ uri: item.photoUrl }} style={{ width, height }} resizeMode="contain" />
          )}
        />
        <View style={[styles.viewerActions, { bottom: insets.bottom + Spacing.md }]}>
          <TouchableOpacity style={styles.viewerBtn} onPress={onClose} accessibilityLabel="Retour">
            <Ionicons name={BACK_ICON} size={24} color={Colors.white} />
          </TouchableOpacity>
          {photo && photo.uploadedBy === currentUserId && (
            <TouchableOpacity style={styles.viewerBtn} onPress={() => onDelete(photo)} accessibilityLabel="Retirer la photo">
              <Ionicons name="trash-outline" size={20} color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>
        {photo && (
          <View style={[styles.viewerInfo, { bottom: insets.bottom + Spacing.md + VIEWER_BTN + Spacing.sm2 }]}>
            <Avatar name={author?.nickname ?? 'Membre'} uri={author?.avatarUrl ?? undefined} size={32} />
            <Text style={styles.viewerText} numberOfLines={1}>
              {author?.nickname ?? 'Membre'} · {addedOn(photo.createdAt)}
            </Text>
            <Text style={styles.viewerCount}>{current + 1}/{photos.length}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const VIEWER_BTN = 48;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.lg, gap: Spacing.md2 },
  titleBlock: { gap: 6 },
  title: { ...Typography.displayTitle, color: Colors.textPrimary },
  subtitle: { ...Typography.body, color: Colors.textMuted },
  loader: { marginTop: Spacing.xxl },
  empty: {
    alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg,
    borderRadius: Radii.pill, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.accent,
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: Radii.full, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  emptyTitle: { ...Typography.cardTitle, color: Colors.textPrimary },
  emptySub: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  cell: { borderRadius: Radii.sm / 2, backgroundColor: Colors.line },
  viewer: { flex: 1, backgroundColor: Colors.primary },
  viewerActions: {
    position: 'absolute', left: Spacing.md2, right: Spacing.md2,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  viewerBtn: {
    width: VIEWER_BTN, height: VIEWER_BTN, borderRadius: Radii.full, backgroundColor: Colors.overlay,
    alignItems: 'center', justifyContent: 'center',
  },
  viewerInfo: {
    position: 'absolute', left: Spacing.md2, right: Spacing.md2,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.sm, borderRadius: Radii.full, backgroundColor: Colors.overlay,
  },
  viewerText: { flex: 1, ...Typography.body, color: Colors.white },
  viewerCount: { ...Typography.bodySmall, color: Colors.textOnDark, marginRight: Spacing.sm },
});
