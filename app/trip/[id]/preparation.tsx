// HAKO — Préparatifs (page plein écran)
// Tout ce qu'il faut faire avant de partir, séparé des envies (qui, elles, se
// votent) : les essentiels (papiers, billets, logements, eSIM, assurance) et
// les tâches du groupe (« Louer la voiture ») avec qui s'en occupe.
// Paramètre add=1 : le champ « Ajouter une tâche » s'ouvre directement.

import { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Motion, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, SectionLabel, StepTitle, createCardStyles } from '@/components/createTrip/CreateTripChrome';
import { EssentialRow, TaskRow } from '@/components/preparation/PrepParts';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { usePreparation } from '@/hooks/usePreparation';
import { useTripOverview } from '@/hooks/useTripOverview';
import { CHECKLIST_ITEMS } from '@/types/checklist';
import { PrepTask } from '@/types/preparation';
import { localDayIso, nightsBetween } from '@/utils/tripStops';

const TRACK_HEIGHT = 8;
const ADD_BTN = 44;
const FIELD_HEIGHT = 56;
const MAX_TITLE = 80;
const IDEAS = ['Louer la voiture', 'Réserver le resto du premier soir', 'Acheter les adaptateurs', 'Faire le change'];

export default function PreparationScreen() {
  const { id, add } = useLocalSearchParams<{ id: string; add?: string }>();
  const tripId = id ?? '';
  const insets = useSafeAreaInsets();
  const p = usePreparation(tripId);
  const { overview } = useTripOverview(tripId);
  const [title, setTitle] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);

  const today = localDayIso(new Date());
  const daysLeft = overview?.start_date && overview.start_date > today ? nightsBetween(today, overview.start_date) : null;
  const ratio = p.progress.total > 0 ? p.progress.done / p.progress.total : 0;
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: withTiming(ratio, { duration: Motion.enter }) }] }));

  const submit = async (text = title) => {
    if (!text.trim() || adding) return;
    setAdding(true);
    if (await p.addTask(text, null)) setTitle('');
    setAdding(false);
  };

  const confirmDelete = (t: PrepTask) => {
    Alert.alert(t.title, undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer la tâche', style: 'destructive', onPress: () => p.removeTask(t) },
    ]);
  };

  const taskRows = (list: readonly PrepTask[]) => list.map((t, i) => (
    <TaskRow
      key={t.id}
      task={t}
      members={p.members}
      me={p.me}
      border={i > 0}
      onToggle={() => p.toggleTask(t)}
      onAssign={uid => p.assignTask(t, uid)}
      onLongPress={() => confirmDelete(t)}
    />
  ));

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CreateTripHeader title="Préparatifs" onClose={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StepTitle
          title="Prêt pour le départ ?"
          subtitle={daysLeft !== null ? `Départ dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}. On s’organise !` : 'Ce qu’il reste à faire pour le groupe.'}
        />

        {/* Avancement */}
        <View style={styles.progressCard}>
          <View style={styles.progressHead}>
            <Text style={styles.progressCount}>{p.progress.done}/{p.progress.total}</Text>
            <Text style={styles.progressLabel}>{ratio >= 1 ? 'tout est prêt, bon voyage !' : 'c’est fait'}</Text>
          </View>
          <View style={styles.track}><Animated.View style={[styles.fill, fill]} /></View>
        </View>

        {/* Tâches du groupe */}
        <View>
          <SectionLabel right={p.open.length > 0 ? `${p.open.length} à faire` : undefined}>À faire par le groupe</SectionLabel>

          <View style={[createCardStyles.whiteCard, styles.addField]}>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ajouter une tâche…"
              placeholderTextColor={Colors.textSecondary}
              maxLength={MAX_TITLE}
              autoFocus={add === '1'}
              returnKeyType="done"
              onSubmitEditing={() => { void submit(); }}
            />
            <AnimatedPressable
              style={[styles.addBtn, !title.trim() && styles.addBtnOff]}
              onPress={() => { void submit(); }}
              disabled={!title.trim() || adding}
              haptic="light"
              scaleTo={Motion.pressScaleSmall}
              accessibilityRole="button"
              accessibilityLabel="Ajouter la tâche"
            >
              {adding ? <ActivityIndicator color={Colors.white} /> : <Ionicons name="add" size={24} color={Colors.white} />}
            </AnimatedPressable>
          </View>

          {p.loading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : p.open.length === 0 && p.done.length === 0 ? (
            /* Idées pour démarrer */
            <Animated.View entering={FadeIn} style={styles.ideas}>
              <Text style={styles.ideasLabel}>Des idées pour commencer :</Text>
              <View style={styles.ideasRow}>
                {IDEAS.map(idea => (
                  <TouchableOpacity key={idea} style={styles.idea} onPress={() => { void submit(idea); }} activeOpacity={0.85}>
                    <Ionicons name="add" size={14} color={Colors.textPrimary} />
                    <Text style={styles.ideaText}>{idea}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          ) : (
            <>
              {p.open.length > 0 && <View style={[createCardStyles.whiteCard, styles.list]}>{taskRows(p.open)}</View>}
              {p.open.length === 0 && <Text style={styles.allDone}>Toutes les tâches sont faites.</Text>}
              <Text style={styles.hint}>Touche « Qui ? » pour dire qui s’en charge. Appui long pour supprimer.</Text>
            </>
          )}

          {p.done.length > 0 && (
            <>
              <TouchableOpacity style={styles.doneToggle} onPress={() => setShowDone(v => !v)} hitSlop={8}>
                <Text style={styles.doneToggleText}>{showDone ? 'Masquer' : 'Voir'} les tâches faites ({p.done.length})</Text>
                <Ionicons name={showDone ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              {showDone && <View style={[createCardStyles.whiteCard, styles.list]}>{taskRows(p.done)}</View>}
            </>
          )}
        </View>

        {/* Essentiels */}
        <View>
          <SectionLabel right={`${CHECKLIST_ITEMS.filter(i => p.essentialsDone.has(i.key)).length}/${CHECKLIST_ITEMS.length}`}>
            Les essentiels
          </SectionLabel>
          <View style={[createCardStyles.whiteCard, styles.list]}>
            {CHECKLIST_ITEMS.map((item, i) => (
              <EssentialRow
                key={item.key}
                item={item}
                done={p.essentialsDone.has(item.key)}
                onToggle={() => { void p.toggleEssential(item.key); }}
                border={i > 0}
              />
            ))}
          </View>
          <Text style={styles.hint}>Cochés pour tout le groupe.</Text>
        </View>

        {p.error ? <Text style={styles.error}>{p.error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.xl, gap: Spacing.lg },

  progressCard: { padding: Spacing.md2, borderRadius: Radii.lg, backgroundColor: Colors.primary, gap: Spacing.sm2, ...Shadows.md },
  progressHead: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  progressCount: { ...Typography.displayValue, color: Colors.white },
  progressLabel: { flex: 1, ...Typography.body, color: Colors.textOnDark },
  track: { height: TRACK_HEIGHT, borderRadius: Radii.full, backgroundColor: Colors.textMuted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radii.full, backgroundColor: Colors.accent, transformOrigin: 'left' },

  addField: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: FIELD_HEIGHT, paddingLeft: Spacing.md, paddingRight: Spacing.sm, marginBottom: Spacing.sm2 },
  input: { flex: 1, ...Typography.cardTitle, color: Colors.textInk, paddingVertical: Spacing.md },
  addBtn: { width: ADD_BTN, height: ADD_BTN, borderRadius: Radii.full, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  addBtnOff: { opacity: 0.35 },

  list: { paddingHorizontal: Spacing.md },
  loader: { marginTop: Spacing.md },
  hint: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: Spacing.sm, marginLeft: Spacing.xs },
  allDone: { ...Typography.body, color: Colors.positive, marginLeft: Spacing.xs },

  ideas: { gap: Spacing.sm },
  ideasLabel: { ...Typography.bodySmall, color: Colors.textMuted, marginLeft: Spacing.xs },
  ideasRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  idea: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.sm2, paddingVertical: Spacing.sm, borderRadius: Radii.full,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderDark,
  },
  ideaText: { ...Typography.chip, color: Colors.textPrimary },

  doneToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md, marginBottom: Spacing.sm, marginLeft: Spacing.xs },
  doneToggleText: { ...Typography.chip, color: Colors.textMuted },
  error: { ...Typography.body, color: Colors.negative },
});
