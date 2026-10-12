// HAKO — Création de voyage (maquettes Figma « Parcours V2 »)
// 1 Destinations · 2 Dates · 3 Une nuit, un lieu (si plusieurs villes) ·
// 4 Qui embarque · 5 Nom & couverture · 6 Votre style ?
// L'état et la logique vivent dans hooks/useCreateTripForm ; cet écran
// assemble les étapes (components/createTrip/steps) et gère la navigation.

import { ReactNode, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { useCreateTripForm } from '@/hooks/useCreateTripForm';
import {
  CreateTripHeader,
  ProgressSegments,
  StepActions,
  StepTitle,
} from '@/components/createTrip/CreateTripChrome';
import { NightsSplit } from '@/components/createTrip/NightsSplit';
import { StyleBudgetStep } from '@/components/createTrip/StyleBudgetStep';
import { DatesStep } from '@/components/createTrip/steps/DatesStep';
import { DestinationsStep } from '@/components/createTrip/steps/DestinationsStep';
import { NameCoverStep } from '@/components/createTrip/steps/NameCoverStep';
import { TravelersStep } from '@/components/createTrip/steps/TravelersStep';

const STEP_DESTINATIONS = 1;
const STEP_DATES = 2;
const STEP_NIGHTS = 3;
const STEP_TRAVELERS = 4;
const STEP_NAME_COVER = 5;
const STEP_STYLE = 6;
const TOTAL_SLIDES = 6;
const SLIDE_DURATION_MS = 340;
const ACTIONS_SPACE = 140; // place réservée à la barre ⟵ / Continuer

export default function CreateTripScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const form = useCreateTripForm();
  const [step, setStep] = useState(STEP_DESTINATIONS);

  /* L'étape « nuits par ville » n'existe que pour un voyage multi-villes */
  const visibleSteps = form.isMultiStop
    ? [STEP_DESTINATIONS, STEP_DATES, STEP_NIGHTS, STEP_TRAVELERS, STEP_NAME_COVER, STEP_STYLE]
    : [STEP_DESTINATIONS, STEP_DATES, STEP_TRAVELERS, STEP_NAME_COVER, STEP_STYLE];
  const progress = visibleSteps.indexOf(step) + 1;

  const offset = useSharedValue(0);
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const goToStep = (next: number) => {
    offset.set(withTiming(-(next - 1) * width, { duration: SLIDE_DURATION_MS, easing: Easing.out(Easing.cubic) }));
    setStep(next);
  };

  const handleBack = () => {
    if (step === STEP_DESTINATIONS) { router.back(); return; }
    if (step === STEP_TRAVELERS && !form.isMultiStop) { goToStep(STEP_DATES); return; }
    goToStep(step - 1);
  };

  const handleCreate = async (skipStyle: boolean) => {
    const error = await form.create(skipStyle);
    if (error) { Alert.alert('Oups', error); return; }
    router.back();
  };

  const handleNext = () => {
    switch (step) {
      case STEP_DESTINATIONS: goToStep(STEP_DATES); break;
      case STEP_DATES:
        if (form.isMultiStop) { form.ensureNightSplit(); goToStep(STEP_NIGHTS); }
        else goToStep(STEP_TRAVELERS);
        break;
      case STEP_NIGHTS: goToStep(STEP_TRAVELERS); break;
      case STEP_TRAVELERS: goToStep(STEP_NAME_COVER); break;
      case STEP_NAME_COVER: goToStep(STEP_STYLE); break;
      case STEP_STYLE: void handleCreate(false); break;
    }
  };

  const canContinue: Record<number, boolean> = {
    [STEP_DESTINATIONS]: form.stops.length > 0,
    [STEP_DATES]: form.datesValid,
    [STEP_NIGHTS]: form.nightSplitValid,
    [STEP_TRAVELERS]: true,
    [STEP_NAME_COVER]: form.tripName.trim().length > 0,
    [STEP_STYLE]: true,
  };

  const slide = (key: number, children: ReactNode) => (
    <ScrollView
      key={key}
      style={{ width }}
      contentContainerStyle={[styles.slide, { paddingBottom: ACTIONS_SPACE + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader />
      <ProgressSegments total={visibleSteps.length} current={progress} />

      <Animated.View style={[styles.slides, { width: width * TOTAL_SLIDES }, slideStyle]}>
        {slide(STEP_DESTINATIONS, <DestinationsStep form={form} />)}
        {slide(STEP_DATES, <DatesStep form={form} />)}
        {slide(STEP_NIGHTS, (
          <>
            <StepTitle
              title="Une nuit, un lieu"
              subtitle={`${form.totalNights} nuits à répartir entre tes ${form.stops.length} villes.`}
            />
            {form.startDate && form.isMultiStop && (
              <NightsSplit
                stops={form.stops}
                tripStartDate={form.startDate}
                totalNights={form.totalNights}
                onAdjust={form.adjustNights}
              />
            )}
          </>
        ))}
        {slide(STEP_TRAVELERS, <TravelersStep form={form} />)}
        {slide(STEP_NAME_COVER, (
          <NameCoverStep
            form={form}
            active={step === STEP_NAME_COVER}
            onPickError={message => Alert.alert('Galerie', message)}
          />
        ))}
        {slide(STEP_STYLE, (
          <>
            <StepTitle title="Votre style ?" subtitle="Pour des idées qui vous ressemblent. Optionnel." />
            <StyleBudgetStep
              vibes={form.vibes}
              onToggleVibe={form.toggleVibe}
              budget={form.budget}
              onBudgetChange={form.setBudget}
              totalNights={form.totalNights}
            />
            <TouchableOpacity
              style={styles.skip}
              onPress={() => { void handleCreate(true); }}
              disabled={form.creating}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>Passer cette étape →</Text>
            </TouchableOpacity>
          </>
        ))}
      </Animated.View>

      <StepActions
        onBack={handleBack}
        onNext={handleNext}
        label={step === STEP_STYLE ? 'Créer la Hako' : 'Continuer'}
        variant={step === STEP_STYLE ? 'accent' : 'dark'}
        disabled={!canContinue[step]}
        loading={form.creating}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  slides: {
    flex: 1,
    flexDirection: 'row',
  },
  slide: {
    paddingHorizontal: Spacing.md2,
    paddingTop: Spacing.lg,
  },
  skip: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.md,
  },
  skipText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
