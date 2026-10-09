// HAKO — Hook questionnaire Trip Match (state machine locale)
//
// 6 étapes : dates → durée → budget → périmètre → environnements → moods.
// submit() envoie la réponse puis, si tous les participants ont répondu,
// déclenche la génération des propositions (la Edge Function gère la
// concurrence via son verrou de status).

import { useCallback, useMemo, useState } from 'react';

import { generateProposals, getMatch, submitResponse } from '@/services/tripMatchService';
import { MatchAnswers } from '@/types/tripMatch';

export const QUESTIONNAIRE_FIRST_STEP = 1;
export const QUESTIONNAIRE_TOTAL_STEPS = 6;

/** Champ de MatchAnswers porté par chaque étape (1-indexé). */
const STEP_FIELDS: readonly (keyof MatchAnswers)[] = [
  'dates',
  'duration',
  'budget',
  'scope',
  'environments',
  'moods',
];

function isFieldComplete(answers: Partial<MatchAnswers>, field: keyof MatchAnswers): boolean {
  switch (field) {
    case 'dates':        return (answers.dates?.length ?? 0) > 0;
    case 'duration':     return (answers.duration ?? '').length > 0;
    case 'budget':       return typeof answers.budget === 'number' && answers.budget > 0;
    case 'scope':        return answers.scope !== undefined;
    // Swipe deck : tout refuser est une réponse valide (tableau vide défini)
    case 'environments': return answers.environments !== undefined;
    case 'moods':        return answers.moods !== undefined;
  }
}

interface UseMatchQuestionnaireResult {
  step: number;                       // étape courante (1 → TOTAL_STEPS)
  totalSteps: number;
  answers: Partial<MatchAnswers>;
  setAnswer: <K extends keyof MatchAnswers>(key: K, value: MatchAnswers[K]) => void;
  next: () => void;
  back: () => void;
  canGoNext: boolean;                 // l'étape courante est complète
  canSubmit: boolean;                 // toutes les étapes sont complètes
  submit: () => Promise<boolean>;     // true si la réponse est enregistrée
  submitting: boolean;
  submitted: boolean;
  error: string | null;
}

export function useMatchQuestionnaire(matchId: string): UseMatchQuestionnaireResult {
  const [step, setStep] = useState(QUESTIONNAIRE_FIRST_STEP);
  const [answers, setAnswers] = useState<Partial<MatchAnswers>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAnswer = useCallback(
    <K extends keyof MatchAnswers>(key: K, value: MatchAnswers[K]) => {
      setAnswers(prev => ({ ...prev, [key]: value }));
    },
    [],
  );

  const next = useCallback(() => {
    setStep(prev => Math.min(prev + 1, QUESTIONNAIRE_TOTAL_STEPS));
  }, []);

  const back = useCallback(() => {
    setStep(prev => Math.max(prev - 1, QUESTIONNAIRE_FIRST_STEP));
  }, []);

  const canGoNext = useMemo(() => {
    const field = STEP_FIELDS[step - 1];
    return field !== undefined && isFieldComplete(answers, field);
  }, [answers, step]);

  const canSubmit = useMemo(
    () => STEP_FIELDS.every(field => isFieldComplete(answers, field)),
    [answers],
  );

  const submit = useCallback(async (): Promise<boolean> => {
    if (submitting || submitted || !canSubmit) return false;
    setSubmitting(true);
    setError(null);

    // canSubmit garantit que tous les champs sont remplis
    const { error: submitError } = await submitResponse(matchId, answers as MatchAnswers);
    if (submitError !== null) {
      setError(submitError);
      setSubmitting(false);
      return false;
    }
    setSubmitted(true);

    // Dernier répondant → déclenche la génération des propositions.
    // En cas de course entre deux derniers répondants, la Edge Function
    // n'en laisse passer qu'un (verrou de status) : l'erreur de l'autre
    // n'invalide pas la soumission.
    const { data: match } = await getMatch(matchId);
    if (match && match.responses_count >= match.participants.length) {
      const { error: generationError } = await generateProposals(matchId);
      if (generationError !== null) setError(generationError);
    }

    setSubmitting(false);
    return true;
  }, [answers, canSubmit, matchId, submitted, submitting]);

  return {
    step,
    totalSteps: QUESTIONNAIRE_TOTAL_STEPS,
    answers,
    setAnswer,
    next,
    back,
    canGoNext,
    canSubmit,
    submit,
    submitting,
    submitted,
    error,
  };
}
