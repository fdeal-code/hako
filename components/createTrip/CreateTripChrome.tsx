// HAKO — Création : éléments communs aux maquettes V2 (Figma « Parcours V2 »)
// En-tête « Nouveau voyage » + croix, segments de progression, titre
// d'étape (Bricolage Grotesque), barre d'actions ⟵ / « Continuer → ».

import { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Motion, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';

const CLOSE_SIZE = 56;
const ACTION_SIZE = 64;
const SEGMENT_HEIGHT = 4;
const SEGMENT_GAP = 6;
const CTA_MIN_WIDTH = 207;

// ─── En-tête ─────────────────────────────────────────────────────────────────
export function CreateTripHeader({ onClose, title = 'Nouveau voyage' }: { onClose: () => void; title?: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
      <AnimatedPressable
        style={styles.closeBtn}
        onPress={onClose}
        scaleTo={Motion.pressScaleSmall}
        accessibilityRole="button"
        accessibilityLabel="Fermer"
      >
        <Ionicons name="close" size={24} color={Colors.textPrimary} />
      </AnimatedPressable>
    </View>
  );
}

// ─── Progression ─────────────────────────────────────────────────────────────
export function ProgressSegments({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.segments} accessibilityLabel={`Étape ${current} sur ${total}`}>
      {Array.from({ length: total }, (_, i) => <Segment key={i} done={i < current} />)}
    </View>
  );
}

// Segment qui se remplit de gauche à droite quand l'étape est atteinte
function Segment({ done }: { done: boolean }) {
  const fill = useAnimatedStyle(() => ({
    transform: [{ scaleX: withTiming(done ? 1 : 0, { duration: Motion.enter }) }],
  }));
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, fill]} />
    </View>
  );
}

// ─── Titre d'étape ───────────────────────────────────────────────────────────
export function StepTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.titleWrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// ─── Libellé de section (« RÉSULTATS », « TES AMIS ») ────────────────────────
export function SectionLabel({ children, right }: { children: string; right?: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionLabel}>{children}</Text>
      {right ? <Text style={styles.sectionRight}>{right}</Text> : null}
    </View>
  );
}

// ─── Barre d'actions ─────────────────────────────────────────────────────────
interface StepActionsProps {
  onBack: () => void;
  onNext: () => void;
  label: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'dark' | 'accent';
  bottomInset: number;
  /** Icône après le libellé (flèche par défaut, « add » pour un ajout) */
  icon?: ComponentProps<typeof Ionicons>['name'];
}

export function StepActions({
  onBack, onNext, label, disabled = false, loading = false, variant = 'dark', bottomInset, icon = 'arrow-forward',
}: StepActionsProps) {
  return (
    <View style={[styles.actions, { paddingBottom: Math.max(bottomInset, Spacing.md) }]}>
      <AnimatedPressable
        style={styles.backBtn}
        onPress={onBack}
        scaleTo={Motion.pressScaleSmall}
        accessibilityRole="button"
        accessibilityLabel="Retour"
      >
        <Ionicons name="caret-back" size={22} color={Colors.textPrimary} />
      </AnimatedPressable>
      <AnimatedPressable
        style={[styles.cta, variant === 'accent' && styles.ctaAccent, (disabled || loading) && styles.ctaDisabled]}
        onPress={onNext}
        disabled={disabled || loading}
        haptic="light"
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
      >
        {loading ? (
          <ActivityIndicator color={Colors.textInverted} />
        ) : (
          <>
            <Text style={styles.ctaText}>{label}</Text>
            <Ionicons name={icon} size={22} color={Colors.textInverted} />
          </>
        )}
      </AnimatedPressable>
    </View>
  );
}

// ─── Styles partagés des cartes blanches (champs, listes) ────────────────────
export const createCardStyles = StyleSheet.create({
  whiteCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    ...Shadows.card,
  },
  creamTile: {
    backgroundColor: Colors.background,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.primary,
    ...Shadows.md,
  },
  darkTile: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.pill,
    ...Shadows.md,
  },
  cardTitle: {
    ...Typography.cardTitle,
    color: Colors.textInk,
  },
  cardSub: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md2,
    marginTop: Spacing.sm,
  },
  headerTitle: {
    ...Typography.headerSmall,
    color: Colors.textMuted,
  },
  closeBtn: {
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  segments: {
    flexDirection: 'row',
    gap: SEGMENT_GAP,
    paddingHorizontal: Spacing.md2,
    marginTop: Spacing.md2,
  },
  segment: {
    flex: 1,
    height: SEGMENT_HEIGHT,
    borderRadius: Radii.full,
    backgroundColor: Colors.line,
    overflow: 'hidden',
  },
  segmentFill: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary,
    transformOrigin: 'left',
  },
  titleWrap: {
    gap: 6,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.displayTitle,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textMuted,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.displayLabel,
    color: Colors.textPrimary,
    textTransform: 'uppercase',
  },
  sectionRight: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.md,
  },
  backBtn: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },
  cta: {
    minWidth: CTA_MIN_WIDTH,
    height: ACTION_SIZE,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadows.lg,
  },
  ctaAccent: {
    backgroundColor: Colors.accent,
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    ...Typography.button,
    color: Colors.offWhite,
  },
});
