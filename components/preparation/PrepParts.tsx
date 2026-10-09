// HAKO — Préparatifs : éléments de la page et bande résumé
// EssentialRow (checklist « Prêt pour le départ ? »), TaskRow (tâche d'orga
// + qui s'en occupe), PrepStrip (bande noire du dashboard / Documents).

import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { Colors, Motion, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { usePrepSummary } from '@/hooks/usePrepSummary';
import { ChecklistItemDef } from '@/types/checklist';
import { PrepMember, PrepTask } from '@/types/preparation';
import { checklistPartnerUrl } from '@/utils/affiliateLinks';
import { prepSummaryLabel } from '@/utils/preparation';

const CHECK = 26;
const AVATAR = 28;
const PICK_AVATAR = 36;
const STRIP_ICON = 36;
export const PREP_STRIP_HEIGHT = 60;

// ─── Case à cocher ronde ─────────────────────────────────────────────────────
function Check({ done, onPress, label }: { done: boolean; onPress: () => void; label: string }) {
  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.check, done && styles.checkDone]}
      scaleTo={Motion.pressScaleSmall}
      haptic={done ? 'light' : 'success'}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={label}
    >
      {done && <Animated.View entering={ZoomIn.springify()}><Ionicons name="checkmark" size={16} color={Colors.white} /></Animated.View>}
    </AnimatedPressable>
  );
}

// ─── Essentiel (papiers, billets, logements, eSIM, assurance) ────────────────
export function EssentialRow({ item, done, onToggle, border }: { item: ChecklistItemDef; done: boolean; onToggle: () => void; border: boolean }) {
  return (
    <View style={[styles.row, border && styles.rowBorder]}>
      <Check done={done} onPress={onToggle} label={item.label} />
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, done && styles.rowTitleDone]}>{item.label}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{item.hint}</Text>
      </View>
      {!done && item.partner ? (
        <TouchableOpacity
          style={styles.partner}
          onPress={() => { if (item.partner) void WebBrowser.openBrowserAsync(checklistPartnerUrl(item.partner)); }}
          activeOpacity={0.85}
        >
          <Text style={styles.partnerText}>{item.partner === 'esim' ? 'Voir les eSIM' : 'Comparer'}</Text>
        </TouchableOpacity>
      ) : (
        <Ionicons name={item.icon} size={20} color={done ? Colors.textSecondary : Colors.textMuted} />
      )}
    </View>
  );
}

// ─── Tâche d'orga ────────────────────────────────────────────────────────────
interface TaskRowProps {
  task: PrepTask;
  members: readonly PrepMember[];
  me: string;
  border: boolean;
  onToggle: () => void;
  onAssign: (userId: string | null) => void;
  onLongPress: () => void;
}

export function TaskRow({ task, members, me, border, onToggle, onAssign, onLongPress }: TaskRowProps) {
  const [picking, setPicking] = useState(false);
  const who = members.find(m => m.id === task.assignedTo) ?? null;

  return (
    <Animated.View layout={LinearTransition} entering={FadeInDown.duration(Motion.enter)} style={border && styles.rowBorder}>
      <TouchableOpacity style={styles.row} onLongPress={onLongPress} activeOpacity={1} delayLongPress={400}>
        <Check done={task.done} onPress={onToggle} label={task.title} />
        <View style={styles.flex}>
          <Text style={[styles.rowTitle, task.done && styles.rowTitleDone]}>{task.title}</Text>
          {task.note ? <Text style={styles.rowSub} numberOfLines={1}>{task.note}</Text> : null}
        </View>
        <AnimatedPressable
          onPress={() => setPicking(v => !v)}
          style={[styles.who, !who && styles.whoEmpty]}
          scaleTo={Motion.pressScaleSmall}
          accessibilityRole="button"
          accessibilityLabel={who ? `Pris en charge par ${who.id === me ? 'toi' : who.nickname}` : 'Qui s’en occupe ?'}
        >
          {who ? (
            <>
              <MemberAvatar member={{ avatar_url: who.avatarUrl, nickname: who.nickname }} size={AVATAR} />
              <Text style={styles.whoText} numberOfLines={1}>{who.id === me ? 'Moi' : who.nickname}</Text>
            </>
          ) : (
            <>
              <Ionicons name="person-add-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.whoTextEmpty}>Qui ?</Text>
            </>
          )}
        </AnimatedPressable>
      </TouchableOpacity>

      {picking && (
        <Animated.View entering={FadeIn.duration(Motion.enter)} style={styles.picker}>
          <Text style={styles.pickerLabel}>Qui s’en occupe ?</Text>
          <View style={styles.pickerRow}>
            {members.map(m => {
              const on = m.id === task.assignedTo;
              return (
                <AnimatedPressable
                  key={m.id}
                  onPress={() => { onAssign(on ? null : m.id); setPicking(false); }}
                  style={[styles.pick, on && styles.pickOn]}
                  scaleTo={Motion.pressScaleSmall}
                  haptic="selection"
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={m.nickname}
                >
                  <MemberAvatar member={{ avatar_url: m.avatarUrl, nickname: m.nickname }} size={PICK_AVATAR} />
                  <Text style={[styles.pickName, on && styles.pickNameOn]} numberOfLines={1}>{m.id === me ? 'Moi' : m.nickname}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ─── Bande résumé (dashboard, Documents) ─────────────────────────────────────
export function PrepStrip({ tripId, hideWhenDone = false }: { tripId: string; hideWhenDone?: boolean }) {
  const s = usePrepSummary(tripId);
  if (!s) return <View style={styles.stripPlaceholder} />;
  const allDone = s.openTasks === 0 && s.essentialsDone >= s.essentialsTotal;
  if (hideWhenDone && s.openTasks === 0) return null;

  return (
    <AnimatedPressable
      style={styles.strip}
      onPress={() => router.push({ pathname: '/trip/[id]/preparation', params: { id: tripId } })}
      accessibilityRole="button"
      accessibilityLabel="Préparatifs"
    >
      <View style={[styles.stripIcon, allDone && styles.stripIconDone]}>
        <Ionicons name={allDone ? 'checkmark-done' : 'checkbox-outline'} size={18} color={Colors.white} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.stripTitle}>PRÉPARATIFS</Text>
        <Text style={styles.stripSub} numberOfLines={1}>
          {s.myOpenTasks > 0 ? `${s.myOpenTasks} pour toi · ` : ''}{prepSummaryLabel(s.openTasks, s.essentialsDone, s.essentialsTotal)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.white} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, paddingVertical: Spacing.sm2 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  rowTitle: { ...Typography.rowTitle, color: Colors.textInk },
  rowTitleDone: { color: Colors.textSecondary, textDecorationLine: 'line-through' },
  rowSub: { ...Typography.bodySmall, color: Colors.textMuted },
  check: {
    width: CHECK, height: CHECK, borderRadius: Radii.full, borderWidth: 2, borderColor: Colors.borderDark,
    alignItems: 'center', justifyContent: 'center',
  },
  checkDone: { backgroundColor: Colors.positive, borderColor: Colors.positive },
  partner: { paddingHorizontal: Spacing.sm2, paddingVertical: Spacing.xs + 2, borderRadius: Radii.full, backgroundColor: Colors.accent },
  partnerText: { ...Typography.chip, color: Colors.white },

  who: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, maxWidth: '38%',
    paddingLeft: Spacing.xs, paddingRight: Spacing.sm2, paddingVertical: Spacing.xs,
    borderRadius: Radii.full, backgroundColor: Colors.surfaceAlt,
  },
  whoEmpty: { paddingLeft: Spacing.sm2, backgroundColor: Colors.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderDark },
  whoText: { flexShrink: 1, ...Typography.chip, color: Colors.textInk },
  whoTextEmpty: { ...Typography.chip, color: Colors.textMuted },

  picker: { paddingBottom: Spacing.sm2, gap: Spacing.sm },
  pickerLabel: { ...Typography.bodySmall, color: Colors.textMuted },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pick: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2,
    paddingLeft: Spacing.xs, paddingRight: Spacing.sm2, paddingVertical: Spacing.xs,
    borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.borderDark,
  },
  pickOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pickName: { ...Typography.chip, color: Colors.textInk },
  pickNameOn: { color: Colors.white },

  strip: {
    height: PREP_STRIP_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2,
    paddingHorizontal: Spacing.sm2, borderRadius: Radii.pill, backgroundColor: Colors.primary, ...Shadows.md,
  },
  stripPlaceholder: { height: PREP_STRIP_HEIGHT },
  stripIcon: { width: STRIP_ICON, height: STRIP_ICON, borderRadius: Radii.full, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  stripIconDone: { backgroundColor: Colors.positive },
  stripTitle: { ...Typography.displayLabel, color: Colors.white },
  stripSub: { ...Typography.bodySmall, color: Colors.textOnDark },
});
