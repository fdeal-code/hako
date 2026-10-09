// HAKO — Briques de la page « Paramètres » d'un voyage (style maquettes V2)
// Couverture + suggestions, cartes blanches groupées, lignes, membres.

import { ComponentProps, ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors, Fonts, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { Avatar } from '@/components/ui/Avatar';
import { DestinationPhoto } from '@/services/unsplashService';
import { TripSettingsMember } from '@/types/tripSettings';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const COVER_HEIGHT = 190;
const THUMB_WIDTH = 76;
const THUMB_HEIGHT = 54;
const ICON_CIRCLE = 36;
const STEP_SIZE = 36;
const AVATAR_SIZE = 40;
const MAX_COVER_SUGGESTIONS = 8;

// ─── Couverture ──────────────────────────────────────────────────────────────
export function CoverEditor({ coverUrl, destination, suggestions, onPickGallery, onChoose }: {
  coverUrl: string | null;
  destination: string;
  suggestions: readonly DestinationPhoto[];
  onPickGallery: () => void;
  onChoose: (photo: DestinationPhoto) => void;
}) {
  return (
    <View style={styles.coverWrap}>
      <View style={styles.cover}>
        {coverUrl
          ? <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, styles.coverEmpty]} />}
        <LinearGradient colors={[Colors.scrimClear, Colors.scrimStrong]} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />
        <Text style={styles.coverDest} numberOfLines={1}>{destination.toUpperCase()}</Text>
        <TouchableOpacity style={styles.coverBtn} onPress={onPickGallery} activeOpacity={0.85} accessibilityRole="button">
          <Ionicons name="image-outline" size={14} color={Colors.textPrimary} />
          <Text style={styles.coverBtnText}>Ma galerie</Text>
        </TouchableOpacity>
      </View>
      {suggestions.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
          {suggestions.slice(0, MAX_COVER_SUGGESTIONS).map(photo => {
            const active = photo.url === coverUrl;
            return (
              <TouchableOpacity
                key={photo.url}
                onPress={() => onChoose(photo)}
                activeOpacity={0.85}
                style={[styles.thumb, active && styles.thumbActive]}
                accessibilityLabel={`Photo de ${photo.photographerName}`}
                accessibilityState={{ selected: active }}
              >
                <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Carte blanche groupée ───────────────────────────────────────────────────
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

// ─── Ligne (icône, titre, valeur, chevron) ───────────────────────────────────
export function SettingsRow({ icon, title, value, onPress, danger = false, right }: {
  icon: IoniconName;
  title: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: ReactNode;
}) {
  const content = (
    <>
      <View style={[styles.iconCircle, danger && styles.iconDanger]}>
        <Ionicons name={icon} size={18} color={danger ? Colors.negative : Colors.textInk} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]} numberOfLines={1}>{title}</Text>
        {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      {right ?? (onPress && !danger ? <Ionicons name="chevron-forward" size={18} color={Colors.textInk} /> : null)}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      {content}
    </TouchableOpacity>
  );
}

// ─── Nom du voyage (modifiable sur place) ────────────────────────────────────
export function NameRow({ value, onChange, onSubmit, editable }: {
  value: string; onChange: (text: string) => void; onSubmit: () => void; editable: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.iconCircle}>
        <Ionicons name="pencil-outline" size={18} color={Colors.textInk} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>Nom du voyage</Text>
        <TextInput
          style={styles.nameInput}
          value={value}
          onChangeText={onChange}
          onBlur={onSubmit}
          onSubmitEditing={onSubmit}
          editable={editable}
          returnKeyType="done"
          maxLength={60}
        />
      </View>
    </View>
  );
}

// ─── Décaler le voyage (− / +) ───────────────────────────────────────────────
export function ShiftStepper({ onShift, disabled }: { onShift: (days: number) => void; disabled: boolean }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity
        style={[styles.step, disabled && styles.stepDisabled]}
        onPress={() => onShift(-1)}
        disabled={disabled}
        accessibilityLabel="Avancer d’un jour"
      >
        <Ionicons name="remove" size={18} color={Colors.textPrimary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.step, disabled && styles.stepDisabled]}
        onPress={() => onShift(1)}
        disabled={disabled}
        accessibilityLabel="Repousser d’un jour"
      >
        <Ionicons name="add" size={18} color={Colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Membre ──────────────────────────────────────────────────────────────────
export function MemberRow({ member, isMe, canRemove, onRemove }: {
  member: TripSettingsMember; isMe: boolean; canRemove: boolean; onRemove: () => void;
}) {
  return (
    <View style={styles.row}>
      <Avatar name={member.nickname} uri={member.avatarUrl ?? undefined} size={AVATAR_SIZE} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{isMe ? `${member.nickname} (toi)` : member.nickname}</Text>
        {member.role === 'owner' && <Text style={styles.ownerTag}>Organisateur</Text>}
      </View>
      {canRemove && (
        <TouchableOpacity onPress={onRemove} hitSlop={8} accessibilityLabel={`Retirer ${member.nickname}`}>
          <Ionicons name="close-circle-outline" size={22} color={Colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  coverWrap: { gap: Spacing.sm2 },
  cover: {
    height: COVER_HEIGHT, borderRadius: Radii.pill, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.primary, ...Shadows.md,
  },
  coverEmpty: { backgroundColor: Colors.line },
  coverDest: {
    position: 'absolute', left: Spacing.md2, bottom: Spacing.md, right: 140,
    fontFamily: Fonts.displayBold, fontSize: 32, color: Colors.white,
  },
  coverBtn: {
    position: 'absolute', right: Spacing.md, bottom: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.sm2, paddingVertical: Spacing.sm,
    borderRadius: Radii.full, backgroundColor: Colors.background,
  },
  coverBtnText: { ...Typography.chip, color: Colors.textPrimary },
  thumbs: { gap: Spacing.sm },
  thumb: {
    width: THUMB_WIDTH, height: THUMB_HEIGHT, borderRadius: Radii.sm, overflow: 'hidden',
    borderWidth: 2, borderColor: Colors.background,
  },
  thumbActive: { borderColor: Colors.accent },
  group: { gap: Spacing.sm + 2 },
  groupTitle: { ...Typography.displayLabel, color: Colors.textPrimary },
  card: { borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.line, marginLeft: Spacing.md + ICON_CIRCLE + Spacing.sm2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm2,
  },
  iconCircle: {
    width: ICON_CIRCLE, height: ICON_CIRCLE, borderRadius: Radii.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background,
  },
  iconDanger: { backgroundColor: Colors.surfaceAlt },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...Typography.bodySmall, color: Colors.textMuted },
  rowTitle: { ...Typography.rowTitle, color: Colors.textInk },
  rowTitleDanger: { color: Colors.negative },
  rowValue: { ...Typography.bodySmall, color: Colors.textMuted },
  nameInput: { padding: 0, ...Typography.rowTitle, color: Colors.textInk },
  ownerTag: { ...Typography.bodySmall, fontWeight: '600', color: Colors.accent },
  stepper: { flexDirection: 'row', gap: Spacing.sm },
  step: {
    width: STEP_SIZE, height: STEP_SIZE, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  stepDisabled: { opacity: 0.4 },
});
