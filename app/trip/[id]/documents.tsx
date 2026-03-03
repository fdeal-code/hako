/**
 * Documents screen — liste, upload, viewer
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Modal,
  Image,
  Alert,
  TextInput,
  Switch,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { NavButton } from '@/components/ui/NavButton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';

/* ─── Types ──────────────────────────────────────────────────── */
type DocCategory =
  | 'vol' | 'hotel' | 'restaurant' | 'transport'
  | 'passeport' | 'assurance' | 'visa' | 'activite' | 'autre';

type FilterKey = 'all' | 'vol' | 'hotel' | 'transport' | 'identite' | 'autre';

interface Doc {
  id: string;
  trip_id: string;
  uploaded_by: string;
  uploaded_by_name?: string;
  uploaded_by_avatar?: string;
  title: string;
  category: DocCategory;
  file_url: string;
  file_type: string;
  file_size?: number;
  notes?: string;
  event_date?: string;
  is_shared: boolean;
  created_at: string;
}

interface Trip {
  id: string;
  name: string;
  destination?: string;
}

/* ─── Config ─────────────────────────────────────────────────── */
const CAT_META: Record<DocCategory, { emoji: string; label: string; color: string }> = {
  vol:        { emoji: '✈️',  label: 'Vol',         color: '#4F7BE8' },
  hotel:      { emoji: '🏨',  label: 'Hôtel',       color: '#0EA5E9' },
  restaurant: { emoji: '🍽️', label: 'Restaurant',  color: '#F97316' },
  transport:  { emoji: '🚗',  label: 'Transport',   color: '#8B5CF6' },
  passeport:  { emoji: '🛂',  label: 'Passeport',   color: '#EAB308' },
  assurance:  { emoji: '🛡️', label: 'Assurance',   color: '#22C55E' },
  visa:       { emoji: '📋',  label: 'Visa',        color: '#EC4899' },
  activite:   { emoji: '🎭',  label: 'Activité',    color: '#14B8A6' },
  autre:      { emoji: '📄',  label: 'Autre',       color: '#6B7280' },
};

const UPLOAD_CATEGORIES: { key: DocCategory; emoji: string; label: string }[] = [
  { key: 'vol',        emoji: '✈️',  label: 'Vol'        },
  { key: 'hotel',      emoji: '🏨',  label: 'Hôtel'      },
  { key: 'restaurant', emoji: '🍽️', label: 'Restaurant' },
  { key: 'transport',  emoji: '🚗',  label: 'Transport'  },
  { key: 'passeport',  emoji: '🛂',  label: 'Passeport'  },
  { key: 'assurance',  emoji: '🛡️', label: 'Assurance'  },
  { key: 'visa',       emoji: '📋',  label: 'Visa'       },
  { key: 'activite',   emoji: '🎭',  label: 'Activité'   },
  { key: 'autre',      emoji: '📄',  label: 'Autre'      },
];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'Tous'       },
  { key: 'vol',       label: '✈️ Vols'    },
  { key: 'hotel',     label: '🏨 Hôtels'  },
  { key: 'transport', label: '🚗 Transport'},
  { key: 'identite',  label: '🛂 Identité' },
  { key: 'autre',     label: '📄 Autres'  },
];

const IDENTITE_CATS: DocCategory[] = ['passeport', 'visa'];
const AUTRE_CATS:    DocCategory[] = ['assurance', 'restaurant', 'activite', 'autre'];

/* ─── Helpers ────────────────────────────────────────────────── */
function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function isImage(fileType?: string, url?: string): boolean {
  const t = (fileType ?? '').toLowerCase();
  const u = (url ?? '').toLowerCase();
  return t.startsWith('image/') || u.endsWith('.jpg') || u.endsWith('.jpeg') || u.endsWith('.png') || u.endsWith('.webp');
}
function filterDocs(docs: Doc[], filter: FilterKey): Doc[] {
  if (filter === 'all') return docs;
  if (filter === 'vol')       return docs.filter(d => d.category === 'vol');
  if (filter === 'hotel')     return docs.filter(d => d.category === 'hotel');
  if (filter === 'transport') return docs.filter(d => d.category === 'transport');
  if (filter === 'identite')  return docs.filter(d => IDENTITE_CATS.includes(d.category));
  if (filter === 'autre')     return docs.filter(d => AUTRE_CATS.includes(d.category));
  return docs;
}

/* ─── Main ───────────────────────────────────────────────────── */
export default function DocumentsScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [trip,      setTrip]      = useState<Trip | null>(null);
  const [docs,      setDocs]      = useState<Doc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter,    setFilter]    = useState<FilterKey>('all');

  /* Upload sheet */
  const [showUploadSheet,  setShowUploadSheet]  = useState(false);
  const [showUploadForm,   setShowUploadForm]   = useState(false);
  const [uploadFile,       setUploadFile]       = useState<{
    uri: string; name: string; type: string; size?: number;
  } | null>(null);
  const [uploadTitle,    setUploadTitle]    = useState('');
  const [uploadCategory, setUploadCategory] = useState<DocCategory>('autre');
  const [uploadDate,     setUploadDate]     = useState('');
  const [uploadNotes,    setUploadNotes]    = useState('');
  const [uploadShared,   setUploadShared]   = useState(true);
  const [isSaving,       setIsSaving]       = useState(false);

  /* Viewer */
  const [viewerDoc,  setViewerDoc]  = useState<Doc | null>(null);
  const [showViewer, setShowViewer] = useState(false);

  /* ── Load ── */
  const loadTrip = useCallback(async () => {
    if (!tripId) return;
    const { data } = await supabase
      .from('trips')
      .select('id, name, destination')
      .eq('id', tripId)
      .single();
    if (data) setTrip(data);
  }, [tripId]);

  const loadDocs = useCallback(async () => {
    if (!tripId) return;
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });
    setDocs(data ?? []);
  }, [tripId]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([loadTrip(), loadDocs()]).finally(() => setIsLoading(false));
  }, [loadTrip, loadDocs]);

  /* ── Filtered list ── */
  const filtered  = filterDocs(docs, filter);
  const totalCount = docs.length;

  /* ── Pick handlers ── */
  const pickCamera = async () => {
    setShowUploadSheet(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission requise', 'Autorise la caméra.'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (res.canceled) return;
    const asset = res.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    setUploadFile({ uri: asset.uri, name: `photo_${Date.now()}.${ext}`, type: `image/${ext}`, size: asset.fileSize });
    setUploadTitle(`photo_${Date.now()}`);
    setShowUploadForm(true);
  };

  const pickGallery = async () => {
    setShowUploadSheet(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission requise', 'Autorise la galerie.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (res.canceled) return;
    const asset = res.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    const name = asset.fileName ?? `image_${Date.now()}.${ext}`;
    setUploadFile({ uri: asset.uri, name, type: `image/${ext}`, size: asset.fileSize });
    setUploadTitle(name.replace(/\.[^.]+$/, ''));
    setShowUploadForm(true);
  };

  const pickFile = async () => {
    setShowUploadSheet(false);
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (res.canceled) return;
    const asset = res.assets[0];
    setUploadFile({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream', size: asset.size });
    setUploadTitle(asset.name.replace(/\.[^.]+$/, ''));
    setShowUploadForm(true);
  };

  /* ── Upload ── */
  const handleSave = async () => {
    if (!uploadFile || !uploadTitle.trim()) {
      Alert.alert('Titre requis', 'Donne un titre au document.');
      return;
    }
    setIsSaving(true);
    try {
      const ext = uploadFile.name.split('.').pop() ?? 'bin';
      const filePath = `${tripId}/${Date.now()}_${uploadFile.name}`;

      const formData = new FormData();
      formData.append('file', {
        uri: uploadFile.uri,
        name: uploadFile.name,
        type: uploadFile.type,
      } as any);

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, formData, { upsert: true, contentType: uploadFile.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase.from('documents').insert({
        trip_id:    tripId,
        uploaded_by: user?.id ?? null,
        title:      uploadTitle.trim(),
        category:   uploadCategory,
        file_url:   publicUrl,
        file_type:  uploadFile.type,
        file_size:  uploadFile.size ?? null,
        notes:      uploadNotes.trim() || null,
        event_date: uploadDate || null,
        is_shared:  uploadShared,
      });

      if (insertError) throw insertError;

      setShowUploadForm(false);
      resetUploadForm();
      loadDocs();
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? "Impossible d'uploader le fichier");
    }
    setIsSaving(false);
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadTitle('');
    setUploadCategory('autre');
    setUploadDate('');
    setUploadNotes('');
    setUploadShared(true);
  };

  /* ── Open doc ── */
  const openDoc = (doc: Doc) => {
    if (isImage(doc.file_type, doc.file_url)) {
      setViewerDoc(doc);
      setShowViewer(true);
    } else {
      Linking.openURL(doc.file_url);
    }
  };

  /* ── Delete ── */
  const handleDelete = (doc: Doc) => {
    Alert.alert('Supprimer', `Supprimer "${doc.title}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          await supabase.from('documents').delete().eq('id', doc.id);
          setShowViewer(false);
          loadDocs();
        },
      },
    ]);
  };

  const navBottom = Math.max(insets.bottom, 10) + 16;
  const navH      = 64;

  /* ── Render ── */
  if (isLoading) {
    return (
      <View style={[s.root, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Documents</Text>
          <Text style={s.subtitle}>
            {totalCount} document{totalCount !== 1 ? 's' : ''}
            {trip ? ` · ${trip.name}` : ''}
          </Text>
        </View>
        <NavButton icon="settings-outline" onPress={() => {}} />
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterRow}
        style={s.filterStrip}
      >
        {FILTERS.map(f => {
          const count = f.key === 'all' ? totalCount : filterDocs(docs, f.key).length;
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[s.filterChip, active && s.filterChipOn]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.75}
            >
              <Text style={[s.filterTxt, active && s.filterTxtOn]}>
                {f.label}{count > 0 ? ` (${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>📂</Text>
          <Text style={s.emptyTitle}>Aucun document</Text>
          <Text style={s.emptySub}>
            {filter === 'all'
              ? 'Ajoute des billets, réservations, passeports…'
              : 'Aucun document dans cette catégorie'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={d => d.id}
          contentContainerStyle={[s.list, { paddingBottom: navH + navBottom + 20 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const meta = CAT_META[item.category] ?? CAT_META.autre;
            return (
              <TouchableOpacity style={s.card} onPress={() => openDoc(item)} activeOpacity={0.8}>
                {/* Icon */}
                <View style={[s.iconBox, { backgroundColor: meta.color + '18' }]}>
                  <Text style={s.iconEmoji}>{meta.emoji}</Text>
                </View>

                {/* Info */}
                <View style={s.cardInfo}>
                  <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={s.cardMeta}>
                    {item.event_date ? (
                      <Text style={s.cardMetaTxt}>{formatDate(item.event_date)}</Text>
                    ) : null}
                    {item.file_size ? (
                      <Text style={s.cardMetaTxt}>{formatFileSize(item.file_size)}</Text>
                    ) : null}
                    <View style={s.sharedBadge}>
                      <Ionicons
                        name={item.is_shared ? 'people-outline' : 'lock-closed-outline'}
                        size={11}
                        color={Colors.textTertiary}
                      />
                      <Text style={s.sharedTxt}>{item.is_shared ? 'Partagé' : 'Privé'}</Text>
                    </View>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Bottom nav */}
      <View style={[s.bottomNav, { bottom: navBottom }]} pointerEvents="box-none">
        <NavButton icon="arrow-back-outline" onPress={() => router.back()} />
        <NavButton icon="add" iconSize={28} onPress={() => setShowUploadSheet(true)} />
        <NavButton icon="options-outline" onPress={() => {}} />
      </View>

      {/* ── Upload pick sheet ── */}
      <Modal visible={showUploadSheet} transparent animationType="slide" onRequestClose={() => setShowUploadSheet(false)}>
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setShowUploadSheet(false)} />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Ajouter un document</Text>

          <TouchableOpacity style={s.sheetRow} onPress={pickCamera} activeOpacity={0.75}>
            <View style={[s.sheetIcon, { backgroundColor: '#FF6B6B18' }]}>
              <Text style={s.sheetEmoji}>📸</Text>
            </View>
            <View style={s.sheetRowInfo}>
              <Text style={s.sheetRowTitle}>Prendre une photo</Text>
              <Text style={s.sheetRowSub}>Ouvre la caméra</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={s.sheetRow} onPress={pickGallery} activeOpacity={0.75}>
            <View style={[s.sheetIcon, { backgroundColor: '#4F7BE818' }]}>
              <Text style={s.sheetEmoji}>🖼️</Text>
            </View>
            <View style={s.sheetRowInfo}>
              <Text style={s.sheetRowTitle}>Choisir depuis la galerie</Text>
              <Text style={s.sheetRowSub}>Photos et images</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={s.sheetRow} onPress={pickFile} activeOpacity={0.75}>
            <View style={[s.sheetIcon, { backgroundColor: '#22C55E18' }]}>
              <Text style={s.sheetEmoji}>📄</Text>
            </View>
            <View style={s.sheetRowInfo}>
              <Text style={s.sheetRowTitle}>Importer un fichier</Text>
              <Text style={s.sheetRowSub}>PDF, images…</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Upload form ── */}
      <Modal visible={showUploadForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowUploadForm(false); resetUploadForm(); }}>
        <View style={[s.formRoot, { paddingTop: Spacing.md, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={s.sheetHandle} />

          {/* Header form */}
          <View style={s.formHeader}>
            <TouchableOpacity onPress={() => { setShowUploadForm(false); resetUploadForm(); }} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.formTitle}>Nouveau document</Text>
            <TouchableOpacity
              style={[s.saveBtn, isSaving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              {isSaving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.saveBtnTxt}>Sauvegarder</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.formScroll}>

            {/* Preview */}
            {uploadFile && (
              <View style={s.previewBox}>
                {isImage(uploadFile.type) ? (
                  <Image source={{ uri: uploadFile.uri }} style={s.previewImg} resizeMode="cover" />
                ) : (
                  <View style={s.previewPdf}>
                    <Text style={s.previewPdfEmoji}>📄</Text>
                    <Text style={s.previewPdfName} numberOfLines={2}>{uploadFile.name}</Text>
                    {uploadFile.size ? <Text style={s.previewPdfSize}>{formatFileSize(uploadFile.size)}</Text> : null}
                  </View>
                )}
              </View>
            )}

            {/* Titre */}
            <Text style={s.label}>Titre</Text>
            <TextInput
              style={s.input}
              value={uploadTitle}
              onChangeText={setUploadTitle}
              placeholder="Ex: Billet Paris–Tokyo"
              placeholderTextColor={Colors.textTertiary}
            />

            {/* Catégorie */}
            <Text style={s.label}>Catégorie</Text>
            <View style={s.catGrid}>
              {UPLOAD_CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.key}
                  style={[s.catBtn, uploadCategory === c.key && s.catBtnOn]}
                  onPress={() => setUploadCategory(c.key)}
                  activeOpacity={0.75}
                >
                  <Text style={s.catEmoji}>{c.emoji}</Text>
                  <Text style={[s.catLabel, uploadCategory === c.key && s.catLabelOn]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date */}
            <Text style={s.label}>Date de l'événement (optionnel)</Text>
            <TextInput
              style={s.input}
              value={uploadDate}
              onChangeText={setUploadDate}
              placeholder="AAAA-MM-JJ"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />

            {/* Partager */}
            <View style={s.toggleRow}>
              <View>
                <Text style={s.toggleLabel}>Partager avec le groupe</Text>
                <Text style={s.toggleSub}>Visible par tous les membres</Text>
              </View>
              <Switch
                value={uploadShared}
                onValueChange={setUploadShared}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor="#fff"
              />
            </View>

            {/* Notes */}
            <Text style={s.label}>Notes (optionnel)</Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              value={uploadNotes}
              onChangeText={setUploadNotes}
              placeholder="Informations utiles…"
              placeholderTextColor={Colors.textTertiary}
              multiline
            />

          </ScrollView>
        </View>
      </Modal>

      {/* ── Viewer image ── */}
      <Modal visible={showViewer} transparent animationType="fade" onRequestClose={() => setShowViewer(false)}>
        <View style={s.viewer}>
          {/* Close */}
          <TouchableOpacity style={[s.viewerClose, { top: insets.top + 12 }]} onPress={() => setShowViewer(false)}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>

          {viewerDoc && isImage(viewerDoc.file_type, viewerDoc.file_url) && (
            <Image
              source={{ uri: viewerDoc.file_url }}
              style={s.viewerImg}
              resizeMode="contain"
            />
          )}

          {/* Bottom bar */}
          {viewerDoc && (
            <View style={[s.viewerBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <Text style={s.viewerTitle} numberOfLines={1}>{viewerDoc.title}</Text>
              <View style={s.viewerActions}>
                <TouchableOpacity style={s.viewerBtn} onPress={() => Linking.openURL(viewerDoc.file_url)} activeOpacity={0.8}>
                  <Ionicons name="share-outline" size={20} color="#fff" />
                  <Text style={s.viewerBtnTxt}>Partager</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.viewerBtn} onPress={() => Linking.openURL(viewerDoc.file_url)} activeOpacity={0.8}>
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text style={s.viewerBtnTxt}>Télécharger</Text>
                </TouchableOpacity>
                {viewerDoc.uploaded_by === user?.id && (
                  <TouchableOpacity style={[s.viewerBtn, s.viewerBtnDanger]} onPress={() => handleDelete(viewerDoc)} activeOpacity={0.8}>
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                    <Text style={s.viewerBtnTxt}>Supprimer</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>

    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },

  /* Filters */
  filterStrip: {
    maxHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterRow: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    alignItems: 'center',
    paddingVertical: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipOn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterTxtOn: {
    color: Colors.white,
    fontWeight: '700',
  },

  /* List */
  list: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },

  /* Card */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: {
    fontSize: 22,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardMetaTxt: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sharedTxt: {
    fontSize: 11,
    color: Colors.textTertiary,
  },

  /* Empty */
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Bottom nav */
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    zIndex: 10,
  },

  /* Upload sheet */
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetIcon: {
    width: 46,
    height: 46,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetEmoji: {
    fontSize: 22,
  },
  sheetRowInfo: {
    flex: 1,
    gap: 2,
  },
  sheetRowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sheetRowSub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  /* Upload form */
  formRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  formTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radii.full,
    minWidth: 110,
    alignItems: 'center',
  },
  saveBtnTxt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  formScroll: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: 0,
  },

  /* Preview */
  previewBox: {
    marginBottom: Spacing.md,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewImg: {
    width: '100%',
    height: 180,
  },
  previewPdf: {
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 8,
  },
  previewPdfEmoji: { fontSize: 40 },
  previewPdfName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  previewPdfSize: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  /* Form fields */
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: Spacing.md,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputMulti: {
    height: 80,
    textAlignVertical: 'top',
  },

  /* Category grid */
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catBtnOn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catEmoji: { fontSize: 16 },
  catLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  catLabelOn: {
    color: Colors.white,
  },

  /* Toggle */
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  toggleSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  /* Viewer */
  viewer: {
    flex: 1,
    backgroundColor: '#000',
  },
  viewerClose: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImg: {
    flex: 1,
  },
  viewerBar: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  viewerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  viewerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  viewerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radii.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  viewerBtnDanger: {
    backgroundColor: '#EF444440',
  },
  viewerBtnTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
