// HAKO — Billet / détail d'un document (maquette « Documents · Billet »)
// Carte d'embarquement quand les infos du billet ont été saisies
// (trajet, horaires, passager, siège, porte, référence), puis le fichier
// lui-même. « Dispo hors connexion » télécharge une copie locale.

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, StepActions } from '@/components/createTrip/CreateTripChrome';
import { useAuth } from '@/contexts/AuthContext';
import {
  SHARE_LINK_TTL_SECONDS,
  deleteDocument,
  fileLink,
  getDocument,
  makeAvailableOffline,
  offlineUri,
  removeOfflineCopy,
} from '@/services/documentService';
import { TicketDetails, TripDocumentRow, docCategoryMeta } from '@/types/documents';

const ACTIONS_SPACE = 140;
const FILE_PREVIEW_HEIGHT = 300;
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const WEEKDAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

function longDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()] ?? '';
  return `${weekday} ${String(d ?? '').padStart(2, '0')} ${MONTHS_SHORT[(m ?? 1) - 1] ?? ''}`;
}

const GRID_FIELDS: { key: keyof TicketDetails; label: string }[] = [
  { key: 'passenger', label: 'PASSAGER' },
  { key: 'seat', label: 'SIÈGE' },
  { key: 'gate', label: 'PORTE' },
  { key: 'boarding', label: 'EMBARQ.' },
];

export default function DocumentDetailScreen() {
  const { docId } = useLocalSearchParams<{ id: string; docId: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [doc, setDoc] = useState<TripDocumentRow | null>(null);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [remoteUri, setRemoteUri] = useState<string | null>(null); // lien signé (bucket privé)

  const load = useCallback(async () => {
    if (!docId) return;
    const { data, error } = await getDocument(docId);
    if (error !== null) { Alert.alert('Oups', error); return; }
    setDoc(data);
    setLocalUri(offlineUri(data.id, data.file_url));
    const link = await fileLink(data.file_url);
    if (link.data) setRemoteUri(link.data);
  }, [docId]);

  useEffect(() => { void load(); }, [load]);

  if (!doc) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const meta = docCategoryMeta(doc.category);
  const details = doc.details ?? {};
  const hasRoute = !!(details.from || details.to);
  const gridItems = GRID_FIELDS.filter(f => details[f.key]);
  const isImage = doc.file_type.startsWith('image/');
  const isText = doc.file_type.startsWith('text/'); // e-mail collé lors d'un import de réservation
  const fileUri = localUri ?? remoteUri;
  const isOwner = doc.uploaded_by === session?.user?.id;

  const openFile = async () => {
    if (localUri) { void Linking.openURL(localUri); return; }
    const { data: link, error } = await fileLink(doc.file_url); // lien frais (1 h)
    if (error !== null) { Alert.alert('Oups', error); return; }
    await WebBrowser.openBrowserAsync(link);
  };

  // Lien temporaire : la personne qui le reçoit peut ouvrir le fichier pendant 24 h
  const share = async () => {
    const { data: link, error } = await fileLink(doc.file_url, SHARE_LINK_TTL_SECONDS);
    if (error !== null) { Alert.alert('Oups', error); return; }
    void Share.share({ message: `${doc.title}\n${link}\n(lien valable 24 h)` });
  };

  const toggleOffline = async () => {
    if (localUri) {
      removeOfflineCopy(doc.id, doc.file_url);
      setLocalUri(null);
      return;
    }
    setDownloading(true);
    const { data, error } = await makeAvailableOffline(doc.id, doc.file_url);
    setDownloading(false);
    if (error !== null) { Alert.alert('Oups', error); return; }
    setLocalUri(data);
  };

  const confirmDelete = () => Alert.alert('Supprimer ce document ?', `« ${doc.title} » sera supprimé pour tout le groupe.`, [
    { text: 'Annuler', style: 'cancel' },
    {
      text: 'Supprimer',
      style: 'destructive',
      onPress: () => {
        void deleteDocument(doc.id, doc.file_url).then(({ error }) => {
          if (error) Alert.alert('Oups', error); else router.back();
        });
      },
    },
  ]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader title={meta.isTicket ? 'Billet' : 'Document'} onClose={() => router.back()} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: ACTIONS_SPACE + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{doc.title}</Text>
          <Text style={styles.subtitle}>
            {[meta.label, doc.event_date ? longDay(doc.event_date) : null, doc.is_shared ? null : 'Perso'].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {/* Carte d'embarquement (si les infos du billet ont été saisies) */}
        {(hasRoute || gridItems.length > 0 || details.reference) && (
          <View style={styles.pass}>
            {hasRoute && (
              <View style={styles.route}>
                <View>
                  <Text style={styles.airport} numberOfLines={1}>{details.from ?? '—'}</Text>
                  {details.departure ? <Text style={styles.time}>{details.departure}</Text> : null}
                </View>
                <Ionicons name={meta.icon} size={26} color={Colors.accent} />
                <View style={styles.routeEnd}>
                  <Text style={styles.airport} numberOfLines={1}>{details.to ?? '—'}</Text>
                  {details.arrival ? <Text style={styles.time}>{details.arrival}</Text> : null}
                </View>
              </View>
            )}
            {gridItems.length > 0 && (
              <View style={styles.grid}>
                {gridItems.map(f => (
                  <View key={f.key} style={styles.gridCell}>
                    <Text style={styles.gridLabel}>{f.label}</Text>
                    <Text style={styles.gridValue}>{details[f.key]}</Text>
                  </View>
                ))}
              </View>
            )}
            {details.reference && (
              <>
                <View style={styles.separator} />
                <Text style={styles.refLabel}>RÉFÉRENCE</Text>
                <Text style={styles.ref} selectable>{details.reference}</Text>
              </>
            )}
          </View>
        )}

        {/* Le fichier (contient le QR code du billet) */}
        <TouchableOpacity style={styles.fileCard} onPress={() => { void openFile(); }} activeOpacity={0.9}>
          {isImage ? (
            fileUri
              ? <Image source={{ uri: fileUri }} style={styles.fileImage} resizeMode="contain" />
              : <View style={[styles.fileImage, styles.center]}><ActivityIndicator color={Colors.primary} /></View>
          ) : (
            <View style={styles.pdfRow}>
              <View style={styles.pdfIcon}><Ionicons name="document-text" size={26} color={Colors.textInk} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pdfTitle}>{isText ? 'Lire la confirmation' : 'Ouvrir le PDF'}</Text>
                <Text style={styles.pdfSub}>{isText ? 'Le texte de l’e-mail importé' : 'Le billet complet, avec son QR code'}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={Colors.textInk} />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.offline, localUri ? styles.offlineOn : null]} onPress={() => { void toggleOffline(); }} disabled={downloading} activeOpacity={0.85}>
          {downloading
            ? <ActivityIndicator size="small" color={Colors.textMuted} />
            : <Ionicons name={localUri ? 'cloud-done' : 'cloud-download-outline'} size={16} color={localUri ? Colors.accent : Colors.textMuted} />}
          <Text style={[styles.offlineText, localUri ? styles.offlineTextOn : null]}>
            {localUri ? 'Dispo hors connexion' : 'Rendre dispo hors connexion'}
          </Text>
        </TouchableOpacity>

        {doc.notes ? <Text style={styles.notes}>{doc.notes}</Text> : null}

        <View style={styles.links}>
          <TouchableOpacity style={styles.link} onPress={() => { void share(); }}>
            <Ionicons name="share-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.linkText}>Partager</Text>
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity style={styles.link} onPress={confirmDelete}>
              <Ionicons name="trash-outline" size={16} color={Colors.negative} />
              <Text style={[styles.linkText, { color: Colors.negative }]}>Supprimer</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <StepActions
        onBack={() => router.back()}
        onNext={() => { void openFile(); }}
        label={isImage ? 'Plein écran' : 'Ouvrir'}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.lg, gap: Spacing.md },
  titleBlock: { gap: 6 },
  title: { ...Typography.displayTitle, color: Colors.textPrimary },
  subtitle: { ...Typography.body, color: Colors.textMuted },
  pass: {
    gap: Spacing.md, padding: Spacing.md2, borderRadius: Radii.pill,
    backgroundColor: Colors.surface, ...Shadows.card,
  },
  route: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  routeEnd: { alignItems: 'flex-end' },
  airport: { fontFamily: Fonts.display, fontSize: 32, color: Colors.textPrimary, maxWidth: 130 },
  time: { ...Typography.bodySmall, color: Colors.textMuted },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  gridCell: { gap: 2 },
  gridLabel: { fontSize: 10, fontWeight: '500', color: Colors.textMuted },
  gridValue: { fontSize: 15, fontWeight: '600', color: Colors.textInk },
  separator: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: Colors.textTertiary },
  refLabel: { fontSize: 10, fontWeight: '500', color: Colors.textMuted, textAlign: 'center' },
  ref: { fontFamily: Fonts.displayBold, fontSize: 28, letterSpacing: 4, color: Colors.textPrimary, textAlign: 'center' },
  fileCard: { borderRadius: Radii.lg, backgroundColor: Colors.surface, overflow: 'hidden', ...Shadows.card },
  fileImage: { width: '100%', height: FILE_PREVIEW_HEIGHT, backgroundColor: Colors.surface },
  pdfRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.md },
  pdfIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  pdfTitle: { ...Typography.cardTitle, color: Colors.textInk },
  pdfSub: { ...Typography.bodySmall, color: Colors.textMuted },
  offline: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radii.full,
    backgroundColor: Colors.surfaceAlt,
  },
  offlineOn: { borderWidth: 1, borderColor: Colors.accent, backgroundColor: Colors.background },
  offlineText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  offlineTextOn: { color: Colors.accent },
  notes: { ...Typography.body, color: Colors.textInk },
  links: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { ...Typography.body, fontWeight: '600', color: Colors.textMuted },
});
