import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';

export default function CreateTripScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const canCreate = name.trim().length > 0 && destination.trim().length > 0;

  const handleCreate = () => {
    // TODO: Supabase insert
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Handle bar */}
      <View style={styles.handleBar} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Nouveau voyage</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Cover placeholder */}
        <TouchableOpacity style={styles.coverPicker} activeOpacity={0.8}>
          <Ionicons name="image-outline" size={36} color={Colors.textTertiary} />
          <Text style={styles.coverPickerText}>Ajouter une photo de couverture</Text>
        </TouchableOpacity>

        {/* Fields */}
        <View style={styles.form}>
          <Field
            label="Nom du voyage"
            placeholder="Ex : Road trip Italie"
            value={name}
            onChangeText={setName}
          />
          <Field
            label="Destination"
            placeholder="Ex : Italie"
            value={destination}
            onChangeText={setDestination}
          />
          <View style={styles.dateRow}>
            <Field
              label="Départ"
              placeholder="JJ/MM/AAAA"
              value={startDate}
              onChangeText={setStartDate}
              style={{ flex: 1 }}
            />
            <Field
              label="Retour"
              placeholder="JJ/MM/AAAA"
              value={endDate}
              onChangeText={setEndDate}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {/* Invite section (placeholder) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Inviter des amis</Text>
          <TouchableOpacity style={styles.inviteBtn} activeOpacity={0.8}>
            <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
            <Text style={styles.inviteBtnText}>Inviter par lien ou email</Text>
          </TouchableOpacity>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!canCreate}
          activeOpacity={0.85}
        >
          <Text style={styles.createBtnText}>Créer le voyage</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChangeText,
  style,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  style?: object;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  coverPicker: {
    height: 160,
    borderRadius: Radii.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  coverPickerText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  form: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  field: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  section: {
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inviteBtnText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500',
  },
  createBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.md,
  },
  createBtnDisabled: {
    opacity: 0.4,
  },
  createBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
