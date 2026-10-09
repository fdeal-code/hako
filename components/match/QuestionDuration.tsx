// HAKO — Question 2 : durée (pills single-select)

import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { Spacing } from '@/constants/theme';

interface DurationOption {
  value: string;
  label: string;
}

export const DURATION_OPTIONS: readonly DurationOption[] = [
  { value: 'week-end',   label: 'Un week-end' },
  { value: '4-5-jours',  label: '4-5 jours' },
  { value: '1-semaine',  label: '1 semaine' },
  { value: '2-semaines', label: '2 semaines' },
];

interface QuestionDurationProps {
  value: string | undefined;
  onChange: (duration: string) => void;
}

export function QuestionDuration({ value, onChange }: QuestionDurationProps) {
  return (
    <View style={styles.list}>
      {DURATION_OPTIONS.map(option => (
        <Chip
          key={option.value}
          label={option.label}
          active={value === option.value}
          onPress={() => onChange(option.value)}
          style={styles.pill}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.sm2 },
  pill: { alignSelf: 'stretch', paddingVertical: Spacing.md },
});
