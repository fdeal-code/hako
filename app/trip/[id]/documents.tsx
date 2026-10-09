/**
 * Documents screen — liste groupée par ville (maquette « Documents · Liste »).
 * L'ajout (document/new) et le billet (document/[docId]) sont des pages.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows, Typography } from '@/constants/theme';
import { NavButton } from '@/components/ui/NavButton';
import { FilterButton } from '@/components/ui/FilterButton';
import { supabase } from '@/services/supabase';
import { PrepStrip } from '@/components/preparation/PrepParts';
import { stopForDay } from '@/utils/tripStops';
import { useTripStops } from '@/hooks/useTripStops';

/* ─── Types ──────────────────────────────────────────────────── */
// Valeurs de la contrainte documents_category_check (en base)
type DocCategory =
  | 'flight' | 'hotel' | 'restaurant' | 'transport'
  | 'passport' | 'insurance' | 'visa' | 'activity' | 'other';

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
  start_date?: string | null;
  end_date?: string | null;
}

/** Aujourd'hui en "YYYY-MM-DD" (heure locale). */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ─── Config ─────────────────────────────────────────────────── */
const CAT_META: Record<DocCategory, { emoji: string; label: string; color: string }> = {
  flight:        { emoji: '✈️',  label: 'Vol',         color: '#4F7BE8' },
  hotel:      { emoji: '🏨',  label: 'Hôtel',       color: '#0EA5E9' },
  restaurant: { emoji: '🍽️', label: 'Restaurant',  color: '#F97316' },
  transport:  { emoji: '🚗',  label: 'Transport',   color: '#8B5CF6' },
  passport:  { emoji: '🛂',  label: 'Passeport',   color: '#EAB308' },
  insurance:  { emoji: '🛡️', label: 'Assurance',   color: '#22C55E' },
  visa:       { emoji: '📋',  label: 'Visa',        color: '#EC4899' },
  activity:   { emoji: '🎭',  label: 'Activité',    color: '#14B8A6' },
  other:      { emoji: '📄',  label: 'Autre',       color: '#6B7280' },
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'Tout'      },
  { key: 'vol',       label: 'Billets'   },
  { key: 'hotel',     label: 'Logements' },
  { key: 'transport', label: 'Transport' },
  { key: 'identite',  label: 'Perso'     },
  { key: 'autre',     label: 'Autres'    },
];

/* Icône Ionicons par catégorie (cartes de la maquette « Documents · Liste ») */
const CAT_ICON: Record<DocCategory, React.ComponentProps<typeof Ionicons>['name']> = {
  flight: 'airplane-outline', hotel: 'bed-outline', restaurant: 'restaurant-outline',
  transport: 'train-outline', passport: 'card-outline', insurance: 'shield-checkmark-outline',
  visa: 'document-text-outline', activity: 'ticket-outline', other: 'document-outline',
};
const MONTHS_UPPER = ['JANV.', 'FÉVR.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.'];

function groupDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${String(d ?? '').padStart(2, '0')} ${MONTHS_UPPER[(m ?? 1) - 1] ?? ''}`;
}

const IDENTITE_CATS: DocCategory[] = ['passport', 'visa'];
const AUTRE_CATS:    DocCategory[] = ['insurance', 'restaurant', 'activity', 'other'];

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
function filterDocs(docs: Doc[], filter: FilterKey): Doc[] {
  if (filter === 'all') return docs;
  if (filter === 'vol')       return docs.filter(d => d.category === 'flight');
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

  const [trip,      setTrip]      = useState<Trip | null>(null);
  const [docs,      setDocs]      = useState<Doc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter,    setFilter]    = useState<FilterKey>('all');

  /* ── Load ── */
  const loadTrip = useCallback(async () => {
    if (!tripId) return;
    const { data } = await supabase
      .from('trips')
      .select('id, name, destination, start_date, end_date')
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

  /* Rechargé au retour de l'écran d'ajout / du billet */
  useFocusEffect(
    useCallback(() => {
      void Promise.all([loadTrip(), loadDocs()]).finally(() => setIsLoading(false));
    }, [loadTrip, loadDocs]),
  );

  /* ── Filtered list ── */
  const filtered  = filterDocs(docs, filter);
  const totalCount = docs.length;

  /* ── Groupes par ville (date du document → étape du jour) ── */
  const { stops } = useTripStops(tripId);
  const groups = (() => {
    const byStop = new Map<string, Doc[]>();
    for (const doc of filtered) {
      const stop = doc.event_date ? stopForDay(stops, doc.event_date.slice(0, 10)) : null;
      const key = stop?.id ?? 'none';
      byStop.set(key, [...(byStop.get(key) ?? []), doc]);
    }
    const result = stops
      .filter(st => byStop.has(st.id))
      .map(st => ({
        key: st.id,
        title: `${st.place_name.toUpperCase()} · ${groupDay(st.start_date)} → ${groupDay(st.end_date)}`,
        docs: byStop.get(st.id) ?? [],
      }));
    const rest = byStop.get('none') ?? [];
    if (rest.length > 0) result.push({ key: 'none', title: stops.length > 0 ? 'TOUT LE VOYAGE' : 'DOCUMENTS', docs: rest });
    return result;
  })();

  const navBottom = Math.max(insets.bottom, 10) + 16;
  const navH      = 64;

  /* ── Navigation : ajout et détail (billet) sont des pages plein écran ── */
  const openDoc = (doc: Doc) => {
    router.push({ pathname: '/trip/[id]/document/[docId]', params: { id: tripId ?? '', docId: doc.id } });
  };

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
        <Text style={s.title}>Vos documents</Text>
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
          return (
            <FilterButton
              key={f.key}
              label={f.label}
              active={filter === f.key}
              onPress={() => setFilter(f.key)}
              count={count > 0 ? count : undefined}
            />
          );
        })}
      </ScrollView>

      {/* Préparatifs (essentiels + tâches du groupe) — tant que le voyage n'est pas terminé */}
      {tripId && (!trip?.end_date || trip.end_date >= todayIso()) && (
        <View style={s.prepStrip}><PrepStrip tripId={tripId} /></View>
      )}

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
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.list, { paddingBottom: navH + navBottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {groups.map(group => (
            <View key={group.key} style={s.group}>
              <View style={s.groupHeader}>
                <Text style={s.groupTitle}>{group.title}</Text>
                <Text style={s.groupCount}>{group.docs.length} doc{group.docs.length > 1 ? 's' : ''}</Text>
              </View>
              {group.docs.map(item => {
                const meta = CAT_META[item.category] ?? CAT_META.other;
                const details = [
                  meta.label,
                  item.event_date ? formatDate(item.event_date) : null,
                  formatFileSize(item.file_size) || null,
                ].filter(Boolean).join(' · ');
                return (
                  <TouchableOpacity key={item.id} style={s.card} onPress={() => openDoc(item)} activeOpacity={0.85}>
                    <View style={s.iconBox}>
                      <Ionicons name={CAT_ICON[item.category] ?? CAT_ICON.other} size={22} color={Colors.textInk} />
                    </View>
                    <View style={s.cardInfo}>
                      <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={s.cardMetaTxt} numberOfLines={1}>
                        {item.is_shared ? details : `Perso · visible que par toi`}
                      </Text>
                    </View>
                    <Ionicons
                      name={item.is_shared ? 'cloud-done-outline' : 'lock-closed'}
                      size={18}
                      color={item.is_shared ? Colors.textMuted : Colors.accent}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Bottom nav */}
      <View style={[s.bottomNav, { bottom: navBottom }]} pointerEvents="box-none">
        <NavButton icon="arrow-back-outline" onPress={() => router.back()} />
        <NavButton icon="add" iconSize={28} variant="accent" onPress={() => router.push({ pathname: '/trip/[id]/document/new', params: { id: tripId ?? '' } })} />
        <NavButton icon="options-outline" onPress={() => {}} />
      </View>

    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  prepStrip: { paddingHorizontal: Spacing.md2, marginBottom: Spacing.sm2 },
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* Header */
  header: {
    paddingHorizontal: Spacing.md2,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    ...Typography.displayTitle,
    color: Colors.textPrimary,
  },

  /* Filters */
  filterStrip: {
    maxHeight: 64,
    flexGrow: 0,
  },
  filterRow: {
    paddingHorizontal: Spacing.md2,
    gap: Spacing.sm,
    alignItems: 'center',
    paddingVertical: Spacing.sm2,
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
    paddingHorizontal: Spacing.md2,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  group: {
    gap: Spacing.sm2 - 2,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupTitle: {
    ...Typography.displayLabel,
    color: Colors.textPrimary,
  },
  groupCount: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },

  /* Card */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    paddingLeft: Spacing.sm2 - 2,
    paddingRight: Spacing.md,
    paddingVertical: Spacing.sm2 - 2,
    gap: Spacing.sm2,
    ...Shadows.card,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textInk,
  },
  cardMetaTxt: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
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
