// HAKO — Ajouter au planning (page plein écran, remplace AddToPlanningSheet)
// 1. « On planifie quoi ? » : une envie validée (celles de la ville du jour
//    d'abord) ou un créneau libre.
// 2. « C'est quand ? » : jour (limité à la ville de l'envie), début au quart
//    d'heure + raccourcis (matin, midi…, premier créneau libre), durée (celle
//    de l'envie par défaut), et ce qui est déjà prévu ce jour-là — les
//    chevauchements sont signalés.
// Paramètres : wishId (envie à planifier), day (jour proposé), manual=1.

import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, StepActions } from '@/components/createTrip/CreateTripChrome';
import { OptionRow } from '@/components/envies/NewWishParts';
import { placeMeta } from '@/components/map/TripMapParts';
import { DayChip } from '@/components/planning/PlanningParts';
import { usePlanAdd } from '@/hooks/usePlanAdd';
import { PlanCandidate } from '@/services/planAddService';
import { nudge } from '@/utils/planSlot';
import { localDayIso, stopColor, stopsForDay } from '@/utils/tripStops';
import { formatStopRange } from '@/utils/wishLinks';
import { DURATION_PRESETS, formatMinutes, formatPrice } from '@/utils/wishPriceDuration';

const ACTIONS_SPACE = 120;
const THUMB = 56;
const STEP = 15;
const QUICK_TIMES: { label: string; time: string }[] = [
  { label: 'Matin', time: '09:00' },
  { label: 'Midi', time: '12:30' },
  { label: 'Après-midi', time: '15:00' },
  { label: 'Soir', time: '19:30' },
];

export default function PlanAddScreen() {
  const { id, wishId, day, manual } = useLocalSearchParams<{ id: string; wishId?: string; day?: string; manual?: string }>();
  const tripId = id ?? '';
  const insets = useSafeAreaInsets();
  const p = usePlanAdd(tripId, { wishId, day, manual: manual === '1' });
  const today = localDayIso(new Date());

  const onSave = async () => {
    const result = await p.save();
    if ('error' in result) { Alert.alert('Oups', result.error); return; }
    // Retour au planning, sur le bon jour, avec le nouveau créneau mis en avant
    router.dismissTo({ pathname: '/trip/[id]/planning', params: { id: tripId, highlightDay: result.day, highlightId: result.id } });
  };

  const candidateLine = (c: PlanCandidate) => [
    placeMeta(c.category).label,
    c.duration_minutes ? formatMinutes(c.duration_minutes) : null,
    c.price_per_person !== null ? formatPrice(c.price_per_person) : null,
  ].filter(Boolean).join(' · ');
  const stopOf = (stopId: string | null) => p.stops.find(s => s.id === stopId) ?? null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader title="Au planning" />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: ACTIONS_SPACE + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {p.error ? <Text style={styles.muted}>{p.error}</Text> : null}

          {/* ── 1. Quoi ── */}
          {p.step === 'choose' && (
            <>
              <View style={styles.titleBlock}>
                <Text style={styles.title}>On planifie quoi ?</Text>
                <Text style={styles.subtitle}>Une envie validée par le groupe, ou un créneau libre.</Text>
              </View>
              <OptionRow icon="time-outline" title="Un créneau libre" subtitle="Resto improvisé, temps libre, trajet…" onPress={p.chooseManual} />
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>ENVIES VALIDÉES · {p.candidates.length}</Text>
                {p.loaded && p.candidates.length === 0 && (
                  <Text style={styles.muted}>Toutes les envies validées sont déjà au planning.</Text>
                )}
                {p.candidates.map(c => {
                  const stop = stopOf(c.stop_id);
                  return (
                    <TouchableOpacity key={c.id} style={styles.candidate} onPress={() => p.chooseWish(c)} activeOpacity={0.85}>
                      {c.image_url
                        ? <Image source={{ uri: c.image_url }} style={styles.thumb} />
                        : <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name={placeMeta(c.category).icon} size={22} color={Colors.white} /></View>}
                      <View style={styles.flex}>
                        <Text style={styles.candidateTitle} numberOfLines={1}>{c.title}</Text>
                        <Text style={styles.small} numberOfLines={1}>{candidateLine(c)}</Text>
                        {stop && (
                          <View style={styles.cityRow}>
                            <View style={[styles.dot, { backgroundColor: stopColor(stop.position, Colors.stopPalette) }]} />
                            <Text style={styles.small}>{stop.place_name}</Text>
                          </View>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.textInk} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* ── 2. Quand ── */}
          {p.step === 'schedule' && (
            <>
              <View style={styles.titleBlock}>
                <Text style={styles.title}>C’est quand ?</Text>
                <Text style={styles.subtitle}>
                  {p.wishStop ? `${p.wishStop.place_name} · ${formatStopRange(p.wishStop.start_date, p.wishStop.end_date)}` : 'Choisis le jour et l’heure.'}
                </Text>
              </View>

              {p.wish ? (
                <View style={styles.selected}>
                  {p.wish.image_url
                    ? <Image source={{ uri: p.wish.image_url }} style={styles.thumb} />
                    : <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name={placeMeta(p.wish.category).icon} size={22} color={Colors.white} /></View>}
                  <View style={styles.flex}>
                    <Text style={styles.selectedTitle} numberOfLines={2}>{p.wish.title}</Text>
                    <Text style={styles.selectedSub} numberOfLines={1}>{candidateLine(p.wish)}</Text>
                  </View>
                  <TouchableOpacity onPress={p.backToChoose} hitSlop={8}><Text style={styles.change}>Changer</Text></TouchableOpacity>
                </View>
              ) : p.manual ? (
                <View style={styles.card}>
                  <TextInput
                    style={styles.manualTitle}
                    value={p.title}
                    onChangeText={p.setTitle}
                    placeholder="Ex. Pause café, resto improvisé"
                    placeholderTextColor={Colors.textMuted}
                    autoFocus
                  />
                  <TextInput
                    style={styles.manualNotes}
                    value={p.notes}
                    onChangeText={p.setNotes}
                    placeholder="Détails (optionnel)"
                    placeholderTextColor={Colors.textMuted}
                    multiline
                  />
                </View>
              ) : null}

              {/* Jour */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>QUEL JOUR ?</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
                  {p.allowedDays.map(d => (
                    <DayChip
                      key={d}
                      day={d}
                      active={d === p.selectedDay}
                      isToday={d === today}
                      dotColors={stopsForDay(p.stops, d).map(s => stopColor(s.position, Colors.stopPalette))}
                      onPress={() => p.setDay(d)}
                    />
                  ))}
                </ScrollView>
              </View>

              {/* Heure */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>À QUELLE HEURE ?</Text>
                <View style={styles.timeCard}>
                  <TouchableOpacity style={styles.step} onPress={() => p.setStart(t => nudge(t, -STEP))} accessibilityLabel="Plus tôt">
                    <Ionicons name="remove" size={20} color={Colors.textPrimary} />
                  </TouchableOpacity>
                  <View style={styles.timeCenter}>
                    <Text style={styles.time}>{p.start}</Text>
                    <Text style={styles.small}>jusqu’à {p.end}</Text>
                  </View>
                  <TouchableOpacity style={styles.step} onPress={() => p.setStart(t => nudge(t, STEP))} accessibilityLabel="Plus tard">
                    <Ionicons name="add" size={20} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.chips}>
                  {p.freeStart && (
                    <TouchableOpacity style={[styles.chip, styles.chipAccent]} onPress={() => p.setStart(p.freeStart ?? p.start)}>
                      <Text style={[styles.chipText, styles.onAccent]}>1er créneau libre · {p.freeStart}</Text>
                    </TouchableOpacity>
                  )}
                  {QUICK_TIMES.map(q => (
                    <TouchableOpacity key={q.time} style={[styles.chip, p.start === q.time && styles.chipActive]} onPress={() => p.setStart(q.time)}>
                      <Text style={[styles.chipText, p.start === q.time && styles.onDark]}>{q.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Durée */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>DURÉE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {DURATION_PRESETS.map(d => (
                    <TouchableOpacity key={d.minutes} style={[styles.chip, p.duration === d.minutes && styles.chipActive]} onPress={() => p.setDuration(d.minutes)}>
                      <Text style={[styles.chipText, p.duration === d.minutes && styles.onDark]}>{d.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Ce jour-là */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>CE JOUR-LÀ</Text>
                {p.conflicts.length > 0 && (
                  <View style={styles.warning}>
                    <Ionicons name="alert-circle" size={18} color={Colors.accent} />
                    <Text style={styles.warningText}>Ça chevauche « {p.conflicts.map(c => c.title).join(' », « ')} »</Text>
                  </View>
                )}
                <View style={styles.card}>
                  {p.daySlots.length === 0 ? (
                    <Text style={styles.muted}>Rien de prévu, la journée est libre.</Text>
                  ) : p.daySlots.map(s => {
                    const clash = p.conflicts.some(c => c.id === s.id);
                    return (
                      <View key={s.id} style={styles.slotRow}>
                        <Text style={[styles.slotTime, clash && styles.clash]}>
                          {s.start_time?.slice(0, 5) ?? '—'}{s.end_time ? `–${s.end_time.slice(0, 5)}` : ''}
                        </Text>
                        <Text style={[styles.slotTitle, clash && styles.clash]} numberOfLines={1}>{s.title}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {p.step === 'schedule' && (
        <StepActions
          onBack={() => (wishId || manual === '1' ? router.back() : p.backToChoose())}
          onNext={() => { void onSave(); }}
          label="Ajouter au planning"
          icon="add"
          variant="accent"
          disabled={!p.canSave}
          loading={p.saving}
          bottomInset={insets.bottom}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.lg, gap: Spacing.lg },
  titleBlock: { gap: 6 },
  title: { ...Typography.displayTitle, color: Colors.textPrimary },
  subtitle: { ...Typography.body, color: Colors.textMuted },
  muted: { ...Typography.body, color: Colors.textMuted },
  small: { ...Typography.bodySmall, color: Colors.textMuted },
  section: { gap: Spacing.sm2 },
  sectionLabel: { ...Typography.displayLabel, color: Colors.textPrimary },
  candidate: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.sm2,
    borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card,
  },
  thumb: { width: THUMB, height: THUMB, borderRadius: Radii.sm, backgroundColor: Colors.line },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
  candidateTitle: { ...Typography.rowTitle, color: Colors.textInk },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: Radii.full },
  selected: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.sm2,
    borderRadius: Radii.lg, backgroundColor: Colors.primary, ...Shadows.md,
  },
  selectedTitle: { ...Typography.rowTitle, color: Colors.white },
  selectedSub: { ...Typography.bodySmall, color: Colors.textOnDark },
  change: { ...Typography.chip, color: Colors.accent },
  card: { gap: Spacing.sm, padding: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card },
  manualTitle: { padding: 0, ...Typography.cardTitle, fontSize: 18, color: Colors.textInk },
  manualNotes: { padding: 0, minHeight: 44, ...Typography.body, color: Colors.textInk },
  days: { gap: 5 },
  timeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md, borderRadius: Radii.pill, backgroundColor: Colors.surface, ...Shadows.card,
  },
  step: {
    width: 44, height: 44, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background,
  },
  timeCenter: { alignItems: 'center' },
  time: { fontFamily: Fonts.displayBold, fontSize: 40, color: Colors.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.background,
  },
  chipActive: { backgroundColor: Colors.primary },
  chipAccent: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { ...Typography.chip, color: Colors.textPrimary },
  onDark: { color: Colors.white },
  onAccent: { color: Colors.white },
  warning: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm2,
    borderRadius: Radii.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.accent,
  },
  warningText: { flex: 1, ...Typography.body, color: Colors.accent },
  slotRow: { flexDirection: 'row', gap: Spacing.sm2 },
  slotTime: { width: 90, ...Typography.bodySmall, fontWeight: '700', color: Colors.textInk },
  slotTitle: { flex: 1, ...Typography.bodySmall, color: Colors.textInk },
  clash: { color: Colors.accent },
});
