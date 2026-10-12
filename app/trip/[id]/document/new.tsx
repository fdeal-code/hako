// HAKO — Ajouter un document (maquette « Documents · Ajouter »)
// 1. Scanner / Importer  2. Titre, type, jour, infos du billet, visibilité.
// Le jour range le document dans la bonne ville (liste groupée par étape).

import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import {
  CreateTripHeader,
  SectionLabel,
  StepActions,
  StepTitle,
  createCardStyles as card,
} from '@/components/createTrip/CreateTripChrome';
import { useAuth } from '@/contexts/AuthContext';
import { useTripOverview } from '@/hooks/useTripOverview';
import { LocalFile, uploadDocument } from '@/services/documentService';
import { DOC_CATEGORIES, DocCategory, PRIVATE_BY_DEFAULT, TicketDetails, docCategoryMeta } from '@/types/documents';
import { tripDays } from '@/utils/tripStops';

const ACTIONS_SPACE = 140;
const TILE_ICON = 40;
const PREVIEW = 64;
const WEEKDAYS = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];

const TICKET_FIELDS: { key: keyof TicketDetails; label: string; placeholder: string }[] = [
  { key: 'from', label: 'De', placeholder: 'LYS / Roma Termini' },
  { key: 'to', label: 'À', placeholder: 'FCO / Firenze SMN' },
  { key: 'departure', label: 'Départ', placeholder: '08:00' },
  { key: 'arrival', label: 'Arrivée', placeholder: '10:05' },
  { key: 'passenger', label: 'Passager', placeholder: 'A. Martin' },
  { key: 'seat', label: 'Siège', placeholder: '14C' },
  { key: 'gate', label: 'Porte', placeholder: 'B12' },
  { key: 'boarding', label: 'Embarquement', placeholder: '07:20' },
  { key: 'reference', label: 'Référence', placeholder: 'ABC123' },
];

function formatSize(bytes?: number | null): string {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} Ko` : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const IMPORT_ICON = 36;

export default function AddDocumentScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { overview } = useTripOverview(tripId);

  const [file, setFile] = useState<LocalFile | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocCategory>('flight');
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [isShared, setIsShared] = useState(true);
  const [details, setDetails] = useState<TicketDetails>({});
  const [saving, setSaving] = useState(false);

  const days = useMemo(
    () => (overview?.start_date && overview.end_date ? tripDays(overview.start_date, overview.end_date) : []),
    [overview],
  );
  const meta = docCategoryMeta(category);

  const chooseCategory = (key: DocCategory) => {
    setCategory(key);
    setIsShared(!PRIVATE_BY_DEFAULT.includes(key));
  };

  const accept = (picked: LocalFile) => {
    setFile(picked);
    if (title.trim().length === 0) setTitle(picked.name.replace(/\.[^.]+$/, ''));
  };

  const scan = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Caméra', 'Autorise la caméra pour scanner un billet.'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    const asset = res.canceled ? undefined : res.assets[0];
    if (!asset) return;
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    accept({ uri: asset.uri, name: `scan_${Date.now()}.${ext}`, type: `image/${ext}`, size: asset.fileSize });
  };

  const importFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    const asset = res.canceled ? undefined : res.assets[0];
    if (!asset) return;
    accept({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream', size: asset.size });
  };

  const importPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Galerie', 'Autorise la galerie pour importer une capture.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    const asset = res.canceled ? undefined : res.assets[0];
    if (!asset) return;
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    accept({ uri: asset.uri, name: asset.fileName ?? `capture_${Date.now()}.${ext}`, type: `image/${ext}`, size: asset.fileSize });
  };

  const save = async () => {
    if (!tripId || !file) return;
    setSaving(true);
    const { error } = await uploadDocument({
      tripId,
      userId: session?.user?.id ?? null,
      file,
      title,
      category,
      eventDate,
      isShared,
      notes: null,
      details: meta.isTicket ? details : null,
    });
    setSaving(false);
    if (error !== null) { Alert.alert('Oups', error); return; }
    router.back();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader title="Nouveau document" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: ACTIONS_SPACE + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StepTitle title="Ajoute un doc" subtitle="Billets, réservations, papiers…" />

        {!file ? (
          <>
            {/* Une réservation ? Hako lit la confirmation et remplit tout */}
            <TouchableOpacity
              style={styles.importBanner}
              onPress={() => router.replace({ pathname: '/trip/[id]/import', params: { id: tripId ?? '' } })}
              activeOpacity={0.85}
            >
              <View style={styles.importIcon}><Ionicons name="sparkles" size={18} color={Colors.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.importTitle}>Une réservation ?</Text>
                <Text style={styles.importSub}>Importe l’e-mail : document, planning et dépense remplis pour toi</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.white} />
            </TouchableOpacity>
            <View style={styles.tiles}>
              {[
                { icon: 'camera' as const, title: 'Scanner', sub: 'Billet, passeport', onPress: scan },
                { icon: 'document' as const, title: 'Importer', sub: 'PDF, fichier', onPress: importFile },
              ].map(tile => (
                <TouchableOpacity key={tile.title} style={[card.whiteCard, styles.tile]} onPress={() => { void tile.onPress(); }} activeOpacity={0.85}>
                  <View style={styles.tileIcon}><Ionicons name={tile.icon} size={20} color={Colors.white} /></View>
                  <Text style={card.cardTitle}>{tile.title}</Text>
                  <Text style={card.cardSub}>{tile.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[card.whiteCard, styles.row]} onPress={() => { void importPhoto(); }} activeOpacity={0.85}>
              <View style={styles.rowIcon}><Ionicons name="images-outline" size={20} color={Colors.textInk} /></View>
              <View style={{ flex: 1 }}>
                <Text style={card.cardTitle}>Depuis tes photos</Text>
                <Text style={card.cardSub}>Une capture d’écran de billet ou de réservation</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textInk} />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.form}>
            {/* Fichier choisi */}
            <View style={[card.whiteCard, styles.row]}>
              {file.type.startsWith('image/')
                ? <Image source={{ uri: file.uri }} style={styles.preview} />
                : <View style={[styles.preview, styles.previewPdf]}><Ionicons name="document-text" size={26} color={Colors.textInk} /></View>}
              <View style={{ flex: 1 }}>
                <Text style={card.cardTitle} numberOfLines={1}>{file.name}</Text>
                <Text style={card.cardSub}>{formatSize(file.size) || file.type}</Text>
              </View>
              <TouchableOpacity onPress={() => setFile(null)} hitSlop={10}>
                <Text style={styles.change}>Changer</Text>
              </TouchableOpacity>
            </View>

            {/* Titre */}
            <View style={[card.whiteCard, styles.field]}>
              <Ionicons name="pencil" size={18} color={Colors.textInk} />
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Vol AF1402 · Lyon → Rome"
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.accent}
              />
            </View>

            {/* Type */}
            <View>
              <SectionLabel>Type</SectionLabel>
              <View style={styles.chips}>
                {DOC_CATEGORIES.map(c => {
                  const active = c.key === category;
                  return (
                    <TouchableOpacity key={c.key} style={[styles.chip, active && styles.chipOn]} onPress={() => chooseCategory(c.key)} activeOpacity={0.85}>
                      <Ionicons name={c.icon} size={14} color={active ? Colors.white : Colors.textPrimary} />
                      <Text style={[styles.chipText, active && styles.chipTextOn]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Jour (range le document dans la bonne ville) */}
            {days.length > 0 && (
              <View>
                <SectionLabel right="facultatif">Quel jour ?</SectionLabel>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
                  {days.map(day => {
                    const active = day === eventDate;
                    const [y, m, d] = day.split('-').map(Number);
                    const weekday = WEEKDAYS[new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()] ?? '';
                    return (
                      <TouchableOpacity key={day} style={[styles.day, active && styles.dayOn]} onPress={() => setEventDate(active ? null : day)}>
                        <Text style={[styles.dayWeek, active && styles.dayWeekOn]}>{weekday}</Text>
                        <Text style={[styles.dayNum, active && styles.dayNumOn]}>{day.slice(8, 10)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Infos du billet */}
            {meta.isTicket && (
              <View>
                <SectionLabel right="facultatif">Infos du billet</SectionLabel>
                <View style={styles.grid}>
                  {TICKET_FIELDS.map(f => (
                    <View key={f.key} style={[card.whiteCard, styles.gridCell]}>
                      <Text style={styles.gridLabel}>{f.label.toUpperCase()}</Text>
                      <TextInput
                        style={styles.gridInput}
                        value={details[f.key] ?? ''}
                        onChangeText={v => setDetails(prev => ({ ...prev, [f.key]: v }))}
                        placeholder={f.placeholder}
                        placeholderTextColor={Colors.textTertiary}
                        autoCapitalize={f.key === 'reference' || f.key === 'from' || f.key === 'to' ? 'characters' : 'sentences'}
                        selectionColor={Colors.accent}
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Visibilité */}
            <View style={[card.whiteCard, styles.row]}>
              <View style={{ flex: 1 }}>
                <Text style={card.cardTitle}>Partager avec le groupe</Text>
                <Text style={card.cardSub}>Désactive pour un passeport : visible que par toi</Text>
              </View>
              <Switch
                value={isShared}
                onValueChange={setIsShared}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        )}
      </ScrollView>

      <StepActions
        onBack={() => (file ? setFile(null) : router.back())}
        onNext={() => { void save(); }}
        label="Ajouter le doc"
        variant="accent"
        disabled={!file || title.trim().length === 0}
        loading={saving}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.lg, gap: Spacing.sm2 + 2 },
  tiles: { flexDirection: 'row', gap: Spacing.sm2 - 2 },
  importBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.md,
    borderRadius: Radii.lg, backgroundColor: Colors.primary,
  },
  importIcon: { width: IMPORT_ICON, height: IMPORT_ICON, borderRadius: Radii.full, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  importTitle: { ...Typography.cardTitle, color: Colors.white },
  importSub: { ...Typography.bodySmall, color: Colors.textOnDark },
  tile: { flex: 1, padding: Spacing.md, gap: Spacing.sm2 - 2 },
  tileIcon: {
    width: TILE_ICON, height: TILE_ICON, borderRadius: 14, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.sm2 + 2 },
  rowIcon: { width: TILE_ICON, height: TILE_ICON, borderRadius: 14, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  form: { gap: Spacing.md },
  preview: { width: PREVIEW, height: PREVIEW, borderRadius: Radii.sm, borderWidth: 1, borderColor: Colors.primary },
  previewPdf: { backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  change: { fontSize: 13, fontWeight: '600', color: Colors.accent },
  field: { height: 60, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, paddingHorizontal: Spacing.md2 },
  input: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.textInk },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.background,
  },
  chipOn: { backgroundColor: Colors.primary },
  chipText: { ...Typography.filter, color: Colors.textPrimary },
  chipTextOn: { color: Colors.white },
  days: { gap: Spacing.xs + 2 },
  day: {
    minWidth: 44, alignItems: 'center', gap: 3, paddingVertical: 9,
    borderRadius: Radii.sm, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.surface,
  },
  dayOn: { backgroundColor: Colors.primary },
  dayWeek: { fontSize: 10, fontWeight: '500', color: Colors.textMuted },
  dayWeekOn: { color: Colors.line },
  dayNum: { fontSize: 15, fontWeight: '600', color: Colors.textInk },
  dayNumOn: { color: Colors.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  gridCell: { width: '48.5%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm2 - 2, gap: 2 },
  gridLabel: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  gridInput: { fontSize: 15, fontWeight: '600', color: Colors.textInk, padding: 0 },
});
