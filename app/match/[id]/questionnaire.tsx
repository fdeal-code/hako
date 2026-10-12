// HAKO — Trip Match : questionnaire (6 questions)
// Container : progression 6 segments, transitions slide + fade
// (ReduceMotion.System respecté), une question par écran sans scroll.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  ReduceMotion,
} from 'react-native-reanimated';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, ProgressSegments, StepActions, StepTitle } from '@/components/createTrip/CreateTripChrome';
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
  { title: 'Ton décor idéal ?',  subtitle: 'Swipe à droite si ça te tente, à gauche sinon' },
  { title: 'L’ambiance ?',       subtitle: 'Swipe tes vibes de vacances' },
];

export default function MatchQuestionnaireScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const q = useMatchQuestionnaire(id ?? '');
  const [direction, setDirection] = useState<1 | -1>(1); // sens du slide (suivant / retour)
  const { session } = useAuth();
  const { responses } = useTripMatch(id);

  /* Déjà répondu (deep link, reprise…) → direction la salle d'attente */
  useEffect(() => {
    const userId = session?.user?.id;
    if (id && userId && !q.submitted && responses.some(r => r.user_id === userId)) {
      router.replace(`/match/${id}/waiting`);
    }
  }, [responses, session?.user?.id, id, q.submitted]);

  const goNext = () => { setDirection(1); q.next(); };
  const goBack = () => {
    if (q.step === 1) { router.back(); return; }
    setDirection(-1);
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
  const entering = (direction === 1 ? FadeInRight : FadeInLeft)
    .duration(ANIM_DURATION_MS)
    .reduceMotion(ReduceMotion.System);
  const exiting = (direction === 1 ? FadeOutLeft : FadeOutRight)
    .duration(ANIM_DURATION_MS)
    .reduceMotion(ReduceMotion.System);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader title={`Trip Match · ${q.step}/${q.totalSteps}`} />
      <ProgressSegments total={q.totalSteps} current={q.step} />

      {/* ── Question courante (slide + fade) ── */}
      <Animated.View key={q.step} entering={entering} exiting={exiting} style={styles.content}>
        <StepTitle title={header?.title ?? ''} subtitle={header?.subtitle} />
        <View style={styles.question}>{renderQuestion()}</View>
      </Animated.View>

      {q.error !== null && <Text style={styles.error}>{q.error}</Text>}

      <StepActions
        onBack={goBack}
        onNext={() => { void handleCta(); }}
        label={isLast ? CTA_SUBMIT : CTA_NEXT}
        icon={isLast ? 'sparkles' : 'arrow-forward'}
        variant={isLast ? 'accent' : 'dark'}
        disabled={ctaDisabled}
        loading={q.submitting}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, paddingHorizontal: Spacing.md2, paddingTop: Spacing.xl },
  question: { flex: 1 },
  error: { ...Typography.body, color: Colors.negative, textAlign: 'center', paddingHorizontal: Spacing.md2 },
});
