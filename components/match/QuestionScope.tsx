// HAKO — Question 4 : périmètre géographique (pills single-select)

import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { Spacing } from '@/constants/theme';
import { MatchScope } from '@/types/tripMatch';

interface ScopeOption {
  value: MatchScope;
  label: string;
}

export const SCOPE_OPTIONS: readonly ScopeOption[] = [
  { value: 'region', label: 'Tout près 🚗' },
  { value: 'pays',   label: 'En France 🥖' },
  { value: 'europe', label: 'En Europe ✈️' },
  { value: 'monde',  label: 'Le monde entier 🌍' },
];

interface QuestionScopeProps {
  value: MatchScope | undefined;
  onChange: (scope: MatchScope) => void;
}

export function QuestionScope({ value, onChange }: QuestionScopeProps) {
  return (
    <View style={styles.list}>
      {SCOPE_OPTIONS.map(option => (
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
