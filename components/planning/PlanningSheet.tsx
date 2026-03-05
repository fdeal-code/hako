/**
 * PlanningSheet — bottom sheet pour planifier une envie validée
 *
 * Utilisé depuis :
 *  - DetailSheet (envies.tsx)
 *  - ExpandedMapView (map)
 *
 * Props :
 *  visible  — contrôle l'affichage du Modal
 *  onClose  — ferme le sheet
 *  wish     — { id, title } de l'envie à planifier
 *  tripId   — UUID du voyage
 *  userId   — UUID de l'utilisateur connecté (facultatif)
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { supabase } from '@/services/supabase';

/* ─── Constants ──────────────────────────────────────────────── */
const START_HOUR = 7;
const END_HOUR   = 23;

/* ─── Helpers ────────────────────────────────────────────────── */
const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const DAYS   = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

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
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  return `${DAYS[d.getDay()]} ${day}/${mon}`;
}

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
}

function hourToTime(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

/* ─── Props ──────────────────────────────────────────────────── */
export interface PlanningSheetProps {
  visible: boolean;
  onClose: () => void;
  wish: { id: string; title: string };
  tripId: string;
  userId?: string;
}

/* ─── Component ──────────────────────────────────────────────── */
export function PlanningSheet({ visible, onClose, wish, tripId, userId }: PlanningSheetProps) {
  const insets = useSafeAreaInsets();

  const [days,     setDays]     = useState<string[]>([]);
  const [selDay,   setSelDay]   = useState('');
  const [startH,   setStartH]   = useState(9);
  const [endH,     setEndH]     = useState(10);
  const [locked,   setLocked]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [loadingDays, setLoadingDays] = useState(false);

  /* ── Load trip dates → generate days ── */
  const loadDays = useCallback(async () => {
    if (!tripId || !visible) return;
    setLoadingDays(true);
    const { data } = await supabase
      .from('trips')
      .select('start_date, end_date')
      .eq('id', tripId)
      .single();
    if (data?.start_date && data?.end_date) {
      const d = generateDays(data.start_date, data.end_date);
      setDays(d);
      // Pre-select today if in range, else first day
      const today = new Date().toISOString().split('T')[0];
      setSelDay(d.includes(today) ? today : d[0] ?? '');
    }
    setLoadingDays(false);
  }, [tripId, visible]);

  useEffect(() => {
    if (visible) {
      setSuccess(false);
      setLocked(false);
      setStartH(9);
      setEndH(10);
      loadDays();
    }
  }, [visible, loadDays]);

  /* ── Confirm ── */
  const handleConfirm = async () => {
    if (!selDay) {
      Alert.alert('Sélectionne un jour', 'Choisis le jour pour cette activité.');
      return;
    }
    if (endH <= startH) {
      Alert.alert('Horaire invalide', 'L\'heure de fin doit être après l\'heure de début.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('planning_items').insert({
        trip_id:    tripId,
        wish_id:    wish.id,
        title:      wish.title,
        day_date:   selDay,
        start_time: hourToTime(startH),
        end_time:   hourToTime(endH),
        is_locked:  locked,
        added_by:   userId ?? null,
        sort_order: 0,
      });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1400);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible d\'ajouter au planning');
    }
    setLoading(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[ps.root, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
        {/* Handle */}
        <View style={ps.handle} />

        {/* Title */}
        <Text style={ps.title}>Ajouter au planning</Text>
        <Text style={ps.subtitle} numberOfLines={2}>
          «&nbsp;{wish.title}&nbsp;»
        </Text>

        {/* ── Success state ── */}
        {success && (
          <View style={ps.successBanner}>
            <Text style={ps.successText}>✅ Ajouté au planning !</Text>
          </View>
        )}

        {!success && (
          <>
            {/* ── Day selector ── */}
            <Text style={ps.sectionLabel}>Choisir le jour</Text>
            {loadingDays ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: Spacing.md }} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={ps.dayRow}
                style={ps.dayScroll}
              >
                {days.map(d => {
                  const active  = selDay === d;
                  const todayDot = isToday(d);
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[ps.dayChip, active && ps.dayChipOn]}
                      onPress={() => setSelDay(d)}
                      activeOpacity={0.75}
                    >
                      <Text style={[ps.dayChipTxt, active && ps.dayChipTxtOn]}>
                        {formatDayChip(d)}
                      </Text>
                      {todayDot && <View style={[ps.todayDot, active && ps.todayDotOn]} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* ── Time pickers ── */}
            <View style={ps.timeRow}>
              {/* Start */}
              <View style={ps.timeBlock}>
                <Text style={ps.sectionLabel}>Début</Text>
                <View style={ps.picker}>
                  <TouchableOpacity
                    style={ps.arrow}
                    onPress={() => setStartH(h => Math.max(START_HOUR, h - 1))}
                  >
                    <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={ps.timeVal}>{startH}h00</Text>
                  <TouchableOpacity
                    style={ps.arrow}
                    onPress={() => {
                      setStartH(h => {
                        const next = Math.min(END_HOUR - 1, h + 1);
                        if (next >= endH) setEndH(next + 1);
                        return next;
                      });
                    }}
                  >
                    <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              <Ionicons name="arrow-forward" size={18} color={Colors.textTertiary} style={{ marginTop: 34 }} />

              {/* End */}
              <View style={ps.timeBlock}>
                <Text style={ps.sectionLabel}>Fin</Text>
                <View style={ps.picker}>
                  <TouchableOpacity
                    style={ps.arrow}
                    onPress={() => setEndH(h => Math.max(startH + 1, h - 1))}
                  >
                    <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={ps.timeVal}>{endH}h00</Text>
                  <TouchableOpacity
                    style={ps.arrow}
                    onPress={() => setEndH(h => Math.min(END_HOUR, h + 1))}
                  >
                    <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* ── Lock toggle ── */}
            <TouchableOpacity
              style={ps.lockRow}
              onPress={() => setLocked(v => !v)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={locked ? 'lock-closed' : 'lock-open-outline'}
                size={18}
                color={locked ? Colors.primary : Colors.textTertiary}
              />
              <Text style={[ps.lockTxt, locked && ps.lockTxtOn]}>
                Réservation fixe 🔒
              </Text>
              <View style={[ps.toggle, locked && ps.toggleOn]}>
                <View style={[ps.thumb, locked && ps.thumbOn]} />
              </View>
            </TouchableOpacity>

            {/* ── Actions ── */}
            <View style={ps.actions}>
              <TouchableOpacity style={ps.cancelBtn} onPress={onClose} activeOpacity={0.75}>
                <Text style={ps.cancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ps.confirmBtn, loading && { opacity: 0.55 }]}
                onPress={handleConfirm}
                disabled={loading || !selDay}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : (
                    <>
                      <Ionicons name="calendar-outline" size={17} color="#fff" />
                      <Text style={ps.confirmTxt}>Confirmer</Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const ps = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: Spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    marginBottom: Spacing.lg,
    fontWeight: '500',
  },

  /* Success */
  successBanner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  successText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#22C55E',
    textAlign: 'center',
  },

  /* Section label */
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },

  /* Day selector */
  dayScroll: {
    maxHeight: 68,
    marginBottom: Spacing.lg,
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
    marginBottom: Spacing.lg,
  },
  timeBlock: {
    flex: 1,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
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

  /* Actions */
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  cancelTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
