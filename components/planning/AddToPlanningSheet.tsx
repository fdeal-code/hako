/**
 * AddToPlanningSheet — composant unifié pour planifier une envie
 *
 * Utilisé depuis :
 *  - Fiche détail d'une envie (Vos Envies)
 *  - Bottom sheet marker (Carte)
 *  - Bouton "+" du Planning
 *  - Slots vides de la timeline
 *
 * Flux :
 *  defaultWish fourni → vue "time" directement (choix jour/heure)
 *  defaultWish absent  → vue "list" (choix d'une envie validée ou ajout manuel)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { supabase } from '@/services/supabase';

/* ─── Constants ──────────────────────────────────────────────── */
const START_HOUR = 7;
const END_HOUR   = 23;

/* ─── Category config ────────────────────────────────────────── */
const CAT_CONFIG: Record<string, { emoji: string; color: string }> = {
  restaurant: { emoji: '🍽️', color: '#FF6B6B' },
  monument:   { emoji: '🏛️', color: '#4ECDC4' },
  cafe:       { emoji: '☕',  color: '#C7956C' },
  hotel:      { emoji: '🏨', color: '#6C5CE7' },
  activity:   { emoji: '🎯', color: '#0984E3' },
  photo:      { emoji: '📸', color: '#00B894' },
  photo_spot: { emoji: '📍', color: '#FDCB6E' },
  bar:        { emoji: '🍺', color: '#E17055' },
  autre:      { emoji: '✨', color: '#A29BFE' },
};
function getCat(key?: string | null) {
  return CAT_CONFIG[key ?? ''] ?? CAT_CONFIG.autre;
}

/* ─── Helpers ────────────────────────────────────────────────── */
const DAYS   = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function generateDays(start: string, end: string): string[] {
  const result: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end   + 'T00:00:00');
  const cur = new Date(s);
  while (cur <= e) {
    result.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

function formatDayChip(dateStr: string): string {
  const d   = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  return `${DAYS[d.getDay()]} ${day}/${mon}`;
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0];
}

function hourToTime(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

/* ─── Types ──────────────────────────────────────────────────── */
export interface WishItem {
  id:         string;
  title:      string;
  image_url?: string | null;
  cover_url?: string | null;
  category?:  string | null;
}

export interface AddToPlanningSheetProps {
  visible:       boolean;
  onClose:       () => void;
  onAdded?:      (day: string, itemId?: string) => void;
  tripId:        string;
  userId?:       string;
  /** Si fourni → on saute la liste et on va direct au sélecteur horaire */
  defaultWish?:  WishItem | null;
  /** Heure pré-sélectionnée (depuis un tap sur un créneau) */
  defaultHour?:  number;
  /** Jour pré-sélectionné (depuis la vue Planning) */
  defaultDay?:   string;
  /** Ouvre directement la vue ajout manuel (sans passer par la liste) */
  forceManual?:  boolean;
}

type SheetView = 'list' | 'time' | 'manual';

/* ─── Component ──────────────────────────────────────────────── */
export function AddToPlanningSheet({
  visible, onClose, onAdded,
  tripId, userId,
  defaultWish, defaultHour, defaultDay, forceManual,
}: AddToPlanningSheetProps) {
  const insets = useSafeAreaInsets();

  /* ── Data ── */
  const [days,        setDays]        = useState<string[]>([]);
  const [wishes,      setWishes]      = useState<WishItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  /* ── Navigation ── */
  const [view,    setView]    = useState<SheetView>('list');
  const [selWish, setSelWish] = useState<WishItem | null>(null);

  /* ── Day / time ── */
  const [selDay, setSelDay] = useState('');
  const [startH, setStartH] = useState(9);
  const [endH,   setEndH]   = useState(10);
  const [locked, setLocked] = useState(false);

  /* ── Manual add ── */
  const [manualTitle, setManualTitle] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  /* ── Save ── */
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);

  /* ── Load trip dates + unplanned wishes ── */
  const loadData = useCallback(async () => {
    if (!tripId) return;
    setLoadingData(true);
    try {
      // Trip dates
      const { data: trip } = await supabase
        .from('trips')
        .select('start_date, end_date')
        .eq('id', tripId)
        .single();

      if (trip?.start_date && trip?.end_date) {
        const d = generateDays(trip.start_date, trip.end_date);
        setDays(d);
        const today = new Date().toISOString().split('T')[0];
        // Priority: defaultDay > today > first day
        if (defaultDay && d.includes(defaultDay)) {
          setSelDay(defaultDay);
        } else if (d.includes(today)) {
          setSelDay(today);
        } else {
          setSelDay(d[0] ?? '');
        }
      }

      // 1. Récupère les wish_id déjà planifiés
      const { data: planned, error: plannedError } = await supabase
        .from('planning_items')
        .select('wish_id')
        .eq('trip_id', tripId);
      console.log('[ADD TO PLANNING] PLANNED ITEMS:', JSON.stringify(planned));
      console.log('[ADD TO PLANNING] PLANNED ERROR:', JSON.stringify(plannedError));

      const plannedIds = (planned || []).map((p: any) => p.wish_id).filter(Boolean) as string[];
      console.log('[ADD TO PLANNING] PLANNED IDS:', plannedIds);

      // 2. Récupère toutes les envies validées
      const { data: allValidated, error: validatedError } = await supabase
        .from('wishes')
        .select('id, title, image_url, category')
        .eq('trip_id', tripId)
        .eq('status', 'validated');
      console.log('[ADD TO PLANNING] ALL VALIDATED:', JSON.stringify(allValidated?.map((w: any) => ({ id: w.id, title: w.title }))));
      console.log('[ADD TO PLANNING] VALIDATED ERROR:', JSON.stringify(validatedError));

      // 3. Filtre les non planifiées en JS
      const unplanned = (allValidated || []).filter((w: any) => !plannedIds.includes(w.id));
      console.log('[ADD TO PLANNING] UNPLANNED:', JSON.stringify(unplanned?.map((w: any) => ({ id: w.id, title: w.title }))));
      console.log('[ADD TO PLANNING] UNPLANNED COUNT:', unplanned.length);

      setWishes(unplanned);
    } catch (e) {
      console.error('[AddToPlanningSheet] loadData error:', e);
    }
    setLoadingData(false);
  }, [tripId, defaultDay]);

  /* ── Reset + init when sheet opens ── */
  useEffect(() => {
    if (!visible) return;

    console.log('[ADD TO PLANNING] visible=true');
    console.log('[ADD TO PLANNING] tripId:', tripId);
    console.log('[ADD TO PLANNING] defaultWish:', JSON.stringify(defaultWish));

    // Reset
    setSuccess(false);
    setSaving(false);
    setLocked(false);
    setManualTitle('');
    setManualNotes('');

    // Hours
    const hour = defaultHour ?? 9;
    setStartH(hour);
    setEndH(Math.min(hour + 1, END_HOUR - 1));

    // Initial view
    if (defaultWish) {
      setSelWish(defaultWish);
      setView('time');
    } else if (forceManual) {
      setSelWish(null);
      setView('manual');
    } else {
      setSelWish(null);
      setView('list');
    }

    loadData();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Select wish from list → go to time view ── */
  const handleSelectWish = (wish: WishItem) => {
    console.log('[ADD TO PLANNING] wish selected:', wish.id, wish.title);
    setSelWish(wish);
    setView('time');
  };

  /* ── Save ── */
  const handleSave = async (isManual: boolean) => {
    console.log('[ADD TO PLANNING] CONFIRM PRESSED');
    console.log('[ADD TO PLANNING] SELECTED DAY:', selDay);

    const title = isManual ? manualTitle.trim() : (selWish?.title ?? '');

    if (!title) {
      console.log('[ADD TO PLANNING] BLOCKED: no title');
      Alert.alert('Titre requis', 'Donne un titre à cette activité.');
      return;
    }
    if (!selDay) {
      console.log('[ADD TO PLANNING] BLOCKED: no selDay');
      Alert.alert('Jour requis', 'Sélectionne un jour.');
      return;
    }
    if (endH <= startH) {
      console.log('[ADD TO PLANNING] BLOCKED: invalid time range');
      Alert.alert('Horaire invalide', "L'heure de fin doit être après l'heure de début.");
      return;
    }

    console.log('[ADD TO PLANNING] SELECTED DAY (post-check):', selDay);
    console.log('[ADD TO PLANNING] START TIME:', hourToTime(startH));
    console.log('[ADD TO PLANNING] END TIME:', hourToTime(endH));
    console.log('[ADD TO PLANNING] WISH:', selWish?.id, selWish?.title);
    console.log('[ADD TO PLANNING] TRIP ID:', tripId);

    const payload = {
      trip_id:    tripId,
      wish_id:    isManual ? null : (selWish?.id ?? null),
      title,
      day_date:   selDay,
      start_time: hourToTime(startH),
      end_time:   hourToTime(endH),
      is_locked:  locked,
      notes:      isManual ? (manualNotes.trim() || null) : null,
      added_by:   userId ?? null,
      sort_order: 0,
    };

    console.log('[ADD TO PLANNING] INSERT:', JSON.stringify(payload));
    setSaving(true);

    const { data, error } = await supabase
      .from('planning_items')
      .insert(payload)
      .select();

    console.log('[ADD TO PLANNING] ERROR:', JSON.stringify(error));
    console.log('[ADD TO PLANNING] DATA:', JSON.stringify(data));

    setSaving(false);

    if (error) {
      Alert.alert('Erreur', error.message ?? "Impossible d'ajouter au planning");
      return;
    }

    setSuccess(true);
    onAdded?.(selDay, (data as any)?.[0]?.id);
    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 1400);
  };

  /* ── Back ── */
  const handleBack = () => {
    if (defaultWish) {
      onClose();
    } else if (view === 'time' || view === 'manual') {
      setSelWish(null);
      setView('list');
    } else {
      onClose();
    }
  };

  /* ── Sub-component: day + time pickers (reused in time & manual) ── */
  const DayTimePicker = () => (
    <>
      <Text style={a.sectionLbl}>Jour</Text>
      {days.length === 0 ? (
        <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 12 }} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={a.dayRow}
          style={a.dayScroll}
        >
          {days.map(d => {
            const active   = selDay === d;
            const todayDot = isToday(d);
            return (
              <TouchableOpacity
                key={d}
                style={[a.dayChip, active && a.dayChipOn]}
                onPress={() => setSelDay(d)}
                activeOpacity={0.75}
              >
                <Text style={[a.dayChipTxt, active && a.dayChipTxtOn]}>
                  {formatDayChip(d)}
                </Text>
                {todayDot && <View style={[a.todayDot, active && a.todayDotOn]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={a.timeRow}>
        {/* Start */}
        <View style={a.timeBlock}>
          <Text style={a.sectionLbl}>Début</Text>
          <View style={a.picker}>
            <TouchableOpacity style={a.arrow} onPress={() => setStartH(h => Math.max(START_HOUR, h - 1))}>
              <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={a.timeVal}>{startH}h00</Text>
            <TouchableOpacity style={a.arrow} onPress={() => setStartH(h => {
              const n = Math.min(END_HOUR - 1, h + 1);
              if (n >= endH) setEndH(n + 1);
              return n;
            })}>
              <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <Ionicons name="arrow-forward" size={16} color={Colors.textTertiary} style={a.timeArrowIcon} />

        {/* End */}
        <View style={a.timeBlock}>
          <Text style={a.sectionLbl}>Fin</Text>
          <View style={a.picker}>
            <TouchableOpacity style={a.arrow} onPress={() => setEndH(h => Math.max(startH + 1, h - 1))}>
              <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={a.timeVal}>{endH}h00</Text>
            <TouchableOpacity style={a.arrow} onPress={() => setEndH(h => Math.min(END_HOUR, h + 1))}>
              <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Lock toggle */}
      <TouchableOpacity style={a.lockRow} onPress={() => setLocked(v => !v)} activeOpacity={0.75}>
        <Ionicons
          name={locked ? 'lock-closed' : 'lock-open-outline'}
          size={18}
          color={locked ? Colors.primary : Colors.textTertiary}
        />
        <Text style={[a.lockTxt, locked && a.lockTxtOn]}>Réservation fixe 🔒</Text>
        <View style={[a.toggle, locked && a.toggleOn]}>
          <View style={[a.thumb, locked && a.thumbOn]} />
        </View>
      </TouchableOpacity>
    </>
  );

  /* ── Confirm button ── */
  const ConfirmBtn = ({ isManual }: { isManual: boolean }) => (
    <TouchableOpacity
      style={[a.confirmBtn, saving && { opacity: 0.55 }]}
      onPress={() => handleSave(isManual)}
      disabled={saving}
      activeOpacity={0.85}
    >
      {saving
        ? <ActivityIndicator size="small" color="#fff" />
        : (
          <>
            <Ionicons name="calendar-outline" size={17} color="#fff" />
            <Text style={a.confirmTxt}>Ajouter au planning</Text>
          </>
        )
      }
    </TouchableOpacity>
  );

  /* ── Render ── */
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[a.root, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
        <View style={a.handle} />

        {/* ══ SUCCESS ══ */}
        {success && (
          <View style={a.successWrap}>
            <Text style={a.successIcon}>✅</Text>
            <Text style={a.successTxt}>Ajouté au planning !</Text>
          </View>
        )}

        {/* ══ LIST VIEW — choix d'une envie ══ */}
        {!success && view === 'list' && (
          <>
            <Text style={a.title}>Planifier une envie</Text>
            <Text style={a.sectionLbl}>Envies validées</Text>

            {loadingData ? (
              <View style={a.loadingWrap}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : wishes.length === 0 ? (
              <View style={a.emptyWrap}>
                <Text style={a.emptyTxt}>Aucune envie validée disponible</Text>
                <Text style={a.emptySub}>
                  Valide des envies dans "Vos Envies" pour les retrouver ici
                </Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={a.wishList}
                contentContainerStyle={{ paddingBottom: Spacing.sm }}
              >
                {wishes.map(w => {
                  const c   = getCat(w.category);
                  const img = w.image_url ?? w.cover_url;
                  return (
                    <TouchableOpacity
                      key={w.id}
                      style={a.wishRow}
                      onPress={() => handleSelectWish(w)}
                      activeOpacity={0.75}
                    >
                      {img ? (
                        <Image source={{ uri: img }} style={a.wishImg} />
                      ) : (
                        <View style={[a.wishImg, a.wishImgFallback, { backgroundColor: c.color + '33' }]}>
                          <Text style={a.wishImgEmoji}>{c.emoji}</Text>
                        </View>
                      )}
                      <View style={a.wishInfo}>
                        <Text style={a.wishTitle} numberOfLines={1}>{w.title}</Text>
                        {w.category && (
                          <Text style={a.wishCat}>{c.emoji} {w.category}</Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={a.divider} />

            <TouchableOpacity
              style={a.manualBtn}
              onPress={() => setView('manual')}
              activeOpacity={0.75}
            >
              <Ionicons name="create-outline" size={18} color={Colors.primary} />
              <Text style={a.manualBtnTxt}>Ajouter manuellement</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity style={a.closeBtn} onPress={onClose} activeOpacity={0.75}>
              <Text style={a.closeTxt}>Fermer</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ══ TIME VIEW — sélecteur jour/heure pour une envie ══ */}
        {!success && view === 'time' && selWish && (
          <>
            {/* Header */}
            <View style={a.header}>
              {!defaultWish && (
                <TouchableOpacity style={a.backBtn} onPress={handleBack} activeOpacity={0.7}>
                  <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
                </TouchableOpacity>
              )}
              <Text numberOfLines={1} style={[a.title, { flex: 1 }]}>
                {selWish.title}
              </Text>
            </View>

            {/* Wish mini card */}
            {(() => {
              const img = selWish.image_url ?? selWish.cover_url;
              const c   = getCat(selWish.category);
              return (
                <View style={a.wishCard}>
                  {img ? (
                    <Image source={{ uri: img }} style={a.wishCardImg} />
                  ) : (
                    <View style={[a.wishCardImg, a.wishImgFallback, { backgroundColor: c.color + '33' }]}>
                      <Text style={a.wishImgEmoji}>{c.emoji}</Text>
                    </View>
                  )}
                  <View style={a.wishCardInfo}>
                    <Text style={a.wishCardTitle} numberOfLines={1}>{selWish.title}</Text>
                    {selWish.category && (
                      <Text style={a.wishCat}>{c.emoji} {selWish.category}</Text>
                    )}
                  </View>
                </View>
              );
            })()}

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <DayTimePicker />
              <ConfirmBtn isManual={false} />
            </ScrollView>
          </>
        )}

        {/* ══ MANUAL VIEW — ajout sans envie ══ */}
        {!success && view === 'manual' && (
          <>
            <View style={a.header}>
              <TouchableOpacity style={a.backBtn} onPress={handleBack} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={a.title}>Ajouter manuellement</Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: Spacing.lg }}
            >
              <Text style={a.sectionLbl}>Titre</Text>
              <TextInput
                style={a.input}
                value={manualTitle}
                onChangeText={setManualTitle}
                placeholder="Ex: Visite du Colisée, Déjeuner..."
                placeholderTextColor={Colors.textTertiary}
                autoFocus
              />

              <DayTimePicker />

              <Text style={a.sectionLbl}>Notes (facultatif)</Text>
              <TextInput
                style={[a.input, a.inputMulti]}
                value={manualNotes}
                onChangeText={setManualNotes}
                placeholder="Adresse, informations utiles..."
                placeholderTextColor={Colors.textTertiary}
                multiline
              />

              <ConfirmBtn isManual={true} />
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const a = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: Spacing.md,
  },
  sectionLbl: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },

  /* Success */
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  successIcon: {
    fontSize: 48,
  },
  successTxt: {
    fontSize: 22,
    fontWeight: '700',
    color: '#22C55E',
    textAlign: 'center',
  },

  /* Loading / empty */
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 6,
  },
  emptyTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    maxWidth: 260,
  },

  /* Wish list */
  wishList: {
    flex: 1,
    marginBottom: Spacing.sm,
  },
  wishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  wishImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    flexShrink: 0,
  },
  wishImgFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishImgEmoji: {
    fontSize: 20,
  },
  wishInfo: {
    flex: 1,
    gap: 2,
  },
  wishTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  wishCat: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
    backgroundColor: Colors.primary + '0D',
    borderWidth: 1,
    borderColor: Colors.primary + '25',
    marginBottom: Spacing.sm,
  },
  manualBtnTxt: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  closeBtn: {
    paddingVertical: 14,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  closeTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },

  /* Header (time + manual views) */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  /* Wish card (time view) */
  wishCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  wishCardImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    flexShrink: 0,
  },
  wishCardInfo: {
    flex: 1,
    gap: 2,
  },
  wishCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  /* Day selector */
  dayScroll: {
    maxHeight: 68,
    marginBottom: Spacing.md,
  },
  dayRow: {
    gap: Spacing.sm,
    alignItems: 'flex-start',
    paddingBottom: 4,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 3,
  },
  dayChipOn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayChipTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  dayChipTxtOn: {
    color: Colors.white,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  todayDotOn: {
    backgroundColor: 'rgba(255,255,255,0.7)',
  },

  /* Time pickers */
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  timeBlock: {
    flex: 1,
  },
  timeArrowIcon: {
    marginTop: 30,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  arrow: {
    width: 40,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeVal: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },

  /* Lock */
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  lockTxt: {
    flex: 1,
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  lockTxtOn: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleOn: {
    backgroundColor: Colors.primary,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  thumbOn: {
    alignSelf: 'flex-end',
  },

  /* Manual add */
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  inputMulti: {
    height: 72,
    textAlignVertical: 'top',
  },

  /* Confirm button */
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: Radii.lg,
    backgroundColor: Colors.primary,
    marginBottom: Spacing.sm,
    ...Shadows.md,
  },
  confirmTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.3,
  },
});
