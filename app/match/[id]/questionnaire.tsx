// HAKO — Trip Match : questionnaire (6 questions)
// Container : progression 6 segments, transitions slide + fade
// (ReduceMotion.System respecté), une question par écran sans scroll.

import { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  ReduceMotion,
} from 'react-native-reanimated';

import { Colors, Radii, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useMatchQuestionnaire } from '@/hooks/useMatchQuestionnaire';
import { useTripMatch } from '@/hooks/useTripMatch';
import { QuestionDates } from '@/components/match/QuestionDates';
import { QuestionDuration } from '@/components/match/QuestionDuration';
import { QuestionBudget } from '@/components/match/QuestionBudget';
import { QuestionScope } from '@/components/match/QuestionScope';
import { QuestionEnvironments } from '@/components/match/QuestionEnvironments';
import { QuestionMoods } from '@/components/match/QuestionMoods';

const ANIM_DURATION_MS = 260;
const CTA_NEXT = 'Continuer';
const CTA_SUBMIT = 'C’est parti !';

interface StepHeader {
  title: string;
  subtitle: string;
}

const STEP_HEADERS: readonly StepHeader[] = [
  { title: 'On part quand ?',    subtitle: 'Coche tous les créneaux qui te vont' },
  { title: 'Combien de temps ?', subtitle: 'Ta durée idéale' },
  { title: 'Ton budget ?',       subtitle: 'Transport + logement, on reste honnête' },
  { title: 'On va jusqu’où ?',   subtitle: 'Ton périmètre de jeu' },
  { title: 'Ton décor idéal ?',  subtitle: 'Swipe : ❤️ si ça te tente, ✕ sinon' },
  { title: 'L’ambiance ?',       subtitle: 'Swipe tes vibes de vacances' },
];

export default function MatchQuestionnaireScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const q = useMatchQuestionnaire(id ?? '');
  const directionRef = useRef<1 | -1>(1);
  const { session } = useAuth();
  const { responses } = useTripMatch(id);

  /* Déjà répondu (deep link, reprise…) → direction la salle d'attente */
  useEffect(() => {
    const userId = session?.user?.id;
    if (id && userId && !q.submitted && responses.some(r => r.user_id === userId)) {
      router.replace(`/match/${id}/waiting`);
    }
  }, [responses, session?.user?.id, id, q.submitted]);

  const goNext = () => { directionRef.current = 1; q.next(); };
  const goBack = () => {
    if (q.step === 1) { router.back(); return; }
    directionRef.current = -1;
    q.back();
  };

  const isLast = q.step === q.totalSteps;
  const ctaDisabled = isLast ? !q.canSubmit || q.submitting : !q.canGoNext;

  const handleCta = async () => {
    if (!isLast) { goNext(); return; }
    const ok = await q.submit();
    if (ok && id) router.replace(`/match/${id}/waiting`);
  };

  const renderQuestion = () => {
    switch (q.step) {
      case 1: return <QuestionDates value={q.answers.dates ?? []} onChange={v => q.setAnswer('dates', v)} />;
      case 2: return <QuestionDuration value={q.answers.duration} onChange={v => q.setAnswer('duration', v)} />;
      case 3: return <QuestionBudget value={q.answers.budget} onChange={v => q.setAnswer('budget', v)} />;
      case 4: return <QuestionScope value={q.answers.scope} onChange={v => q.setAnswer('scope', v)} />;
      case 5: return <QuestionEnvironments onChange={v => q.setAnswer('environments', v)} />;
      case 6: return <QuestionMoods onChange={v => q.setAnswer('moods', v)} />;
      default: return null;
    }
  };

  const header = STEP_HEADERS[q.step - 1];
  const entering = (directionRef.current === 1 ? FadeInRight : FadeInLeft)
    .duration(ANIM_DURATION_MS)
    .reduceMotion(ReduceMotion.System);
  const exiting = (directionRef.current === 1 ? FadeOutLeft : FadeOutRight)
    .duration(ANIM_DURATION_MS)
    .reduceMotion(ReduceMotion.System);

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.sm }]}>
      {/* ── Barre du haut : retour + progression ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={goBack}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.progress}>
          {STEP_HEADERS.map((step, i) => (
            <View
              key={step.title}
              style={[styles.segment, i < q.step && styles.segmentActive]}
            />
          ))}
        </View>
        <Text style={styles.stepLabel}>{q.step}/{q.totalSteps}</Text>
      </View>

      {/* ── Question courante (slide + fade) ── */}
      <Animated.View key={q.step} entering={entering} exiting={exiting} style={styles.content}>
        <Text style={styles.title}>{header?.title}</Text>
        <Text style={styles.subtitle}>{header?.subtitle}</Text>
        <View style={styles.question}>{renderQuestion()}</View>
      </Animated.View>

      {q.error !== null && <Text style={styles.error}>{q.error}</Text>}

      {/* ── CTA ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <TouchableOpacity
          style={[styles.cta, ctaDisabled && styles.ctaDisabled]}
          onPress={handleCta}
          disabled={ctaDisabled}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaLabel}>
            {isLast ? (q.submitting ? 'Envoi…' : CTA_SUBMIT) : CTA_NEXT}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md2,
    gap: Spacing.sm2,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: { flex: 1, flexDirection: 'row', gap: Spacing.xs },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: Radii.full,
    backgroundColor: Colors.border,
  },
  segmentActive: { backgroundColor: Colors.primary },
  stepLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  content: { flex: 1, paddingHorizontal: Spacing.md2, paddingTop: Spacing.lg },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  question: { flex: 1 },
  error: {
    textAlign: 'center',
    color: Colors.negative,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: Spacing.md2,
  },
  footer: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.sm },
  cta: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.35 },
  ctaLabel: { color: Colors.textInverted, fontSize: 16, fontWeight: '700' },
});
