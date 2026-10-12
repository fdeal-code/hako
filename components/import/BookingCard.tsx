// HAKO — Import : carte d'une réservation lue, à vérifier avant l'ajout
// En-tête (type, titre modifiable, case « ajouter »), dates, trajet,
// référence, prix ; alertes ; choix planning / dépense ; « Modifier » ouvre
// les champs (dates, heures, lieux, référence, montant).

import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Motion, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { BOOKING_KIND_META, BookingDraft } from '@/types/bookingImport';
import { BookingWarning, isTransport } from '@/utils/bookingImport';
import { parseAmount } from '@/utils/expenseForm';

const ICON = 40;
const CHECK = 26;
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const WARNING_LABEL: Record<BookingWarning | 'duplicate', string> = {
  duplicate: 'Déjà importée ?',
  outside_trip: 'Hors des dates du voyage',
  no_date: 'Date introuvable',
  no_price: 'Montant introuvable',
  foreign_currency: 'Montant en devise étrangère',
};

function shortDate(day: string | null, time: string | null): string | null {
  if (!day) return null;
  const [, m, d] = day.split('-').map(Number);
  return `${d ?? ''} ${MONTHS[(m ?? 1) - 1] ?? ''}${time ? ` · ${time}` : ''}`;
}

interface BookingCardProps {
  draft: BookingDraft;
  warnings: readonly (BookingWarning | 'duplicate')[];
  index: number;
  onChange: (patch: Partial<BookingDraft>) => void;
}

export function BookingCard({ draft: d, warnings, index, onChange }: BookingCardProps) {
  const [editing, setEditing] = useState(false);
  const meta = BOOKING_KIND_META[d.kind];
  const start = shortDate(d.start_date, d.start_time);
  const end = shortDate(d.end_date, d.end_time);
  const route = d.from_place && d.to_place ? `${d.from_place} → ${d.to_place}` : d.address ?? d.city;
  const price = d.total_price !== null
    ? `${d.total_price.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${d.currency ?? '€'}`
    : null;
  const shown = warnings.filter(w => w !== 'foreign_currency' || d.addExpense)
    .map(w => (w === 'foreign_currency' && d.currency ? `Montant en ${d.currency} : vérifie-le en €` : WARNING_LABEL[w]));

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, Motion.maxStaggerItems) * Motion.stagger).duration(Motion.enter)}
      layout={LinearTransition}
      style={[styles.card, !d.include && styles.cardOff]}
    >
      {/* En-tête */}
      <View style={styles.head}>
        <View style={styles.icon}><Ionicons name={meta.icon} size={20} color={Colors.white} /></View>
        <View style={styles.flex}>
          <Text style={styles.kind}>{meta.label.toUpperCase()}{d.provider ? ` · ${d.provider}` : ''}</Text>
          <TextInput
            style={styles.title}
            value={d.title}
            onChangeText={title => onChange({ title })}
            multiline
            accessibilityLabel="Titre de la réservation"
          />
        </View>
        <AnimatedPressable
          onPress={() => onChange({ include: !d.include })}
          style={[styles.check, d.include && styles.checkOn]}
          scaleTo={Motion.pressScaleSmall}
          haptic="selection"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: d.include }}
          accessibilityLabel="Ajouter cette réservation"
        >
          {d.include && <Ionicons name="checkmark" size={16} color={Colors.white} />}
        </AnimatedPressable>
      </View>

      {/* Infos lues */}
      <View style={styles.facts}>
        {(start || end) && (
          <Fact icon="calendar-outline" text={[start, end && end !== start ? end : null].filter(Boolean).join('  →  ')} />
        )}
        {route ? <Fact icon={isTransport(d.kind) ? 'navigate-outline' : 'location-outline'} text={route} /> : null}
        {d.reference ? <Fact icon="pricetag-outline" text={`Réf. ${d.reference}`} /> : null}
        {d.travelers.length > 0 ? <Fact icon="people-outline" text={d.travelers.join(', ')} /> : null}
        {price ? <Fact icon="wallet-outline" text={price} /> : null}
      </View>

      {shown.length > 0 && (
        <View style={styles.warnings}>
          {shown.map(w => (
            <View key={w} style={styles.warning}>
              <Ionicons name="alert-circle" size={13} color={Colors.accent} />
              <Text style={styles.warningText}>{w}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Modifier */}
      {editing && <EditFields draft={d} onChange={onChange} />}

      {/* Où ranger */}
      {d.include && (
        <View style={styles.toggles}>
          <Toggle icon="document-text" label="Document" on locked />
          <Toggle icon="calendar" label="Planning" on={d.addPlanning} onPress={() => onChange({ addPlanning: !d.addPlanning })} />
          <Toggle
            icon="wallet"
            label="Dépense"
            on={d.addExpense && d.total_price !== null}
            disabled={d.total_price === null}
            onPress={() => onChange({ addExpense: !d.addExpense })}
          />
        </View>
      )}

      <TouchableOpacity onPress={() => setEditing(v => !v)} style={styles.editLink} hitSlop={8}>
        <Ionicons name={editing ? 'chevron-up' : 'create-outline'} size={14} color={Colors.textMuted} />
        <Text style={styles.editText}>{editing ? 'Fermer' : 'Modifier'}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function Fact({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={14} color={Colors.textMuted} />
      <Text style={styles.factText} numberOfLines={2}>{text}</Text>
    </View>
  );
}

function Toggle({ icon, label, on, locked, disabled, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; on: boolean; locked?: boolean; disabled?: boolean; onPress?: () => void;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={locked || disabled}
      style={[styles.toggle, on && styles.toggleOn, disabled && styles.toggleDisabled]}
      scaleTo={Motion.pressScaleSmall}
      haptic={locked ? undefined : 'selection'}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: locked || disabled }}
      accessibilityLabel={label}
    >
      <Ionicons name={on ? icon : (`${icon}-outline` as keyof typeof Ionicons.glyphMap)} size={14} color={on ? Colors.white : Colors.textPrimary} />
      <Text style={[styles.toggleText, on && styles.toggleTextOn]}>{label}</Text>
    </AnimatedPressable>
  );
}

// ─── Champs modifiables (validés à la saisie) ────────────────────────────────
function EditFields({ draft: d, onChange }: { draft: BookingDraft; onChange: (patch: Partial<BookingDraft>) => void }) {
  const [amount, setAmount] = useState(d.total_price !== null ? String(d.total_price).replace('.', ',') : '');
  const field = (label: string, value: string | null, onText: (v: string) => void, placeholder: string) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        defaultValue={value ?? ''}
        onChangeText={onText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
  const dateOrNull = (v: string) => (DATE_RE.test(v.trim()) ? v.trim() : null);
  const timeOrNull = (v: string) => (TIME_RE.test(v.trim()) ? v.trim() : null);

  return (
    <Animated.View entering={FadeIn.duration(Motion.enter)} style={styles.edit}>
      <View style={styles.row}>
        {field('Début', d.start_date, v => onChange({ start_date: dateOrNull(v) }), 'AAAA-MM-JJ')}
        {field('Heure', d.start_time, v => onChange({ start_time: timeOrNull(v) }), 'HH:MM')}
      </View>
      <View style={styles.row}>
        {field('Fin', d.end_date, v => onChange({ end_date: dateOrNull(v) }), 'AAAA-MM-JJ')}
        {field('Heure', d.end_time, v => onChange({ end_time: timeOrNull(v) }), 'HH:MM')}
      </View>
      {isTransport(d.kind) && (
        <View style={styles.row}>
          {field('Départ', d.from_place, v => onChange({ from_place: v.trim() || null }), 'Paris CDG')}
          {field('Arrivée', d.to_place, v => onChange({ to_place: v.trim() || null }), 'Tokyo HND')}
        </View>
      )}
      <View style={styles.row}>
        {field('Référence', d.reference, v => onChange({ reference: v.trim() || null }), 'ABC123')}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Montant (€)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={v => {
              setAmount(v);
              const n = parseAmount(v);
              onChange({ total_price: n, currency: n !== null ? 'EUR' : d.currency, addExpense: n !== null && d.addExpense });
            }}
            placeholder="0"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { padding: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.surface, gap: Spacing.sm2, ...Shadows.card },
  cardOff: { opacity: 0.5 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm2 },
  icon: { width: ICON, height: ICON, borderRadius: Radii.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  kind: { ...Typography.bodySmall, fontWeight: '700', color: Colors.textMuted },
  title: { ...Typography.cardTitle, color: Colors.textInk, padding: 0, marginTop: Spacing.xs / 2 },
  check: {
    width: CHECK, height: CHECK, borderRadius: Radii.full, borderWidth: 2, borderColor: Colors.borderDark,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },

  facts: { gap: Spacing.xs + 2 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  factText: { flex: 1, ...Typography.body, color: Colors.textInk },

  warnings: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs + 2 },
  warning: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.accent,
  },
  warningText: { ...Typography.bodySmall, fontWeight: '600', color: Colors.accent },

  toggles: { flexDirection: 'row', gap: Spacing.sm },
  toggle: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.sm, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.borderDark,
  },
  toggleOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleDisabled: { opacity: 0.35 },
  toggleText: { ...Typography.chip, color: Colors.textPrimary },
  toggleTextOn: { color: Colors.white },

  editLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start' },
  editText: { ...Typography.chip, color: Colors.textMuted },
  edit: { gap: Spacing.sm, paddingTop: Spacing.xs },
  row: { flexDirection: 'row', gap: Spacing.sm },
  field: { flex: 1, gap: Spacing.xs },
  fieldLabel: { ...Typography.bodySmall, color: Colors.textMuted },
  input: {
    ...Typography.body, color: Colors.textInk, paddingHorizontal: Spacing.sm2, paddingVertical: Spacing.sm,
    borderRadius: Radii.sm, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
});
