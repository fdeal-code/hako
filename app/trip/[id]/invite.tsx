// HAKO — Inviter des amis (page plein écran, remplace InviteSheet)
// Lien d'invitation à partager (WhatsApp…) en premier, puis les amis en un
// tap, l'invitation par e-mail et le suivi des invitations envoyées.

import { ComponentProps } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, SectionLabel, StepTitle, createCardStyles } from '@/components/createTrip/CreateTripChrome';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { EmailIssue, useTripInvite } from '@/hooks/useTripInvite';
import { InvitationStatus } from '@/services/invitationService';

type IconName = ComponentProps<typeof Ionicons>['name'];

const AVATAR = 44;
const LEAD = 48;
const SEND = 44;
const FIELD_HEIGHT = 60;

const STATUS: Record<InvitationStatus, { label: string; icon: IconName; color: string }> = {
  pending: { label: 'En attente', icon: 'time-outline', color: Colors.textMuted },
  accepted: { label: 'Acceptée', icon: 'checkmark-circle', color: Colors.positive },
  declined: { label: 'Refusée', icon: 'close-circle', color: Colors.negative },
};

const EMAIL_HINT: Record<EmailIssue, string> = {
  invalid: 'Adresse e-mail incomplète.',
  self: 'C’est ton adresse !',
  already: 'Déjà invité(e) à ce voyage.',
};

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = id ?? '';
  const insets = useSafeAreaInsets();
  const v = useTripInvite(tripId);

  const canSend = !!v.email.trim() && !v.emailIssue;

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CreateTripHeader title="Inviter des amis" onClose={() => router.back()} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StepTitle
          title="Qui vient ?"
          subtitle={v.tripName
            ? `${v.memberCount} voyageur${v.memberCount > 1 ? 's' : ''} pour « ${v.tripName} » pour l’instant.`
            : 'Invite tes potes à rejoindre le voyage.'}
        />

        {/* Lien d'invitation */}
        <Animated.View entering={FadeInDown.duration(350)}>
          <TouchableOpacity style={styles.linkCard} onPress={() => { void v.shareLink(); }} disabled={v.busyId === 'link'} activeOpacity={0.85}>
            <View style={styles.linkIcon}>
              {v.busyId === 'link'
                ? <ActivityIndicator color={Colors.accent} />
                : <Ionicons name="logo-whatsapp" size={24} color={Colors.accent} />}
            </View>
            <View style={styles.flex}>
              <Text style={styles.linkTitle}>Partager un lien d’invitation</Text>
              <Text style={styles.linkSub}>WhatsApp, Messages… un tap pour rejoindre.</Text>
            </View>
            <Ionicons name="share-outline" size={20} color={Colors.white} />
          </TouchableOpacity>
        </Animated.View>

        {/* Amis */}
        <Animated.View entering={FadeInDown.delay(80).duration(350)} style={styles.section}>
          <SectionLabel>Tes amis</SectionLabel>
          {v.friends.length === 0 ? (
            <TouchableOpacity style={styles.emptyFriends} onPress={() => router.push('/account/add-friend')} activeOpacity={0.85}>
              <Ionicons name="person-add-outline" size={22} color={Colors.accent} />
              <Text style={styles.emptyText}>Ajoute tes potes en amis pour les inviter en un tap la prochaine fois.</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <View style={[createCardStyles.whiteCard, styles.list]}>
              {v.friends.map((f, i) => {
                const state = v.friendState(f);
                return (
                  <Animated.View key={f.id} layout={LinearTransition} style={[styles.row, i > 0 && styles.rowBorder]}>
                    <MemberAvatar member={f} size={AVATAR} />
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{f.nickname ?? 'Voyageur'}</Text>
                      {f.email ? <Text style={styles.rowSub} numberOfLines={1}>{f.email}</Text> : null}
                    </View>
                    {state === 'available' ? (
                      <TouchableOpacity
                        style={styles.inviteBtn}
                        onPress={() => v.inviteFriend(f)}
                        disabled={v.busyId !== null}
                        activeOpacity={0.85}
                      >
                        {v.busyId === f.id ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.inviteText}>Inviter</Text>}
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.tag}>
                        <Ionicons name={state === 'member' ? 'checkmark-circle' : 'paper-plane'} size={14} color={Colors.textMuted} />
                        <Text style={styles.tagText}>{state === 'member' ? 'Dans le voyage' : 'Invité'}</Text>
                      </View>
                    )}
                  </Animated.View>
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* Par e-mail */}
        <Animated.View entering={FadeInDown.delay(160).duration(350)} style={styles.section}>
          <SectionLabel>Par e-mail</SectionLabel>
          <View style={[createCardStyles.whiteCard, styles.field]}>
            <Ionicons name="mail-outline" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={v.email}
              onChangeText={v.setEmail}
              placeholder="email@exemple.com"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={() => { void v.inviteEmail(); }}
            />
            <TouchableOpacity
              style={[styles.send, !canSend && styles.sendOff]}
              onPress={() => { void v.inviteEmail(); }}
              disabled={!canSend || v.busyId !== null}
              accessibilityLabel="Envoyer l’invitation"
            >
              {v.busyId === 'email' ? <ActivityIndicator color={Colors.white} /> : <Ionicons name="paper-plane" size={18} color={Colors.white} />}
            </TouchableOpacity>
          </View>
          {v.emailIssue && v.emailIssue !== 'invalid' ? <Text style={styles.hint}>{EMAIL_HINT[v.emailIssue]}</Text> : null}
          <Text style={styles.note}>Ton ami verra l’invitation dans Hako en s’inscrivant avec cette adresse.</Text>
        </Animated.View>

        {v.error ? <Text style={styles.error}>{v.error}</Text> : null}

        {/* Invitations envoyées */}
        {v.invitations === null ? (
          <ActivityIndicator color={Colors.primary} />
        ) : v.invitations.length > 0 ? (
          <View style={styles.section}>
            <SectionLabel right={`${v.invitations.length}`}>Invitations envoyées</SectionLabel>
            <View style={[createCardStyles.whiteCard, styles.list]}>
              {v.invitations.map((inv, i) => {
                const st = STATUS[inv.status] ?? STATUS.pending;
                return (
                  <Animated.View key={inv.id} layout={LinearTransition} entering={FadeInDown} style={[styles.row, i > 0 && styles.rowBorder]}>
                    <View style={styles.lead}><Ionicons name="mail-outline" size={18} color={Colors.textPrimary} /></View>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{inv.invited_email}</Text>
                      <View style={styles.statusRow}>
                        <Ionicons name={st.icon} size={12} color={st.color} />
                        <Text style={[styles.rowSub, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>
                    {inv.status === 'pending' && (
                      <TouchableOpacity onPress={() => { void v.cancel(inv); }} disabled={v.busyId !== null} hitSlop={10} accessibilityLabel="Annuler l’invitation">
                        {v.busyId === inv.id
                          ? <ActivityIndicator color={Colors.textMuted} />
                          : <Ionicons name="close" size={20} color={Colors.textMuted} />}
                      </TouchableOpacity>
                    )}
                  </Animated.View>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.xl, gap: Spacing.lg },
  section: { gap: 0 },

  linkCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.md,
    borderRadius: Radii.lg, backgroundColor: Colors.accent, ...Shadows.md,
  },
  linkIcon: { width: LEAD, height: LEAD, borderRadius: Radii.full, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  linkTitle: { ...Typography.cardTitle, color: Colors.white },
  linkSub: { ...Typography.bodySmall, color: Colors.white, opacity: 0.85 },

  emptyFriends: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.md,
    borderRadius: Radii.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderDark,
  },
  emptyText: { flex: 1, ...Typography.body, color: Colors.textMuted },

  list: { paddingHorizontal: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, paddingVertical: Spacing.sm2 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  rowTitle: { ...Typography.rowTitle, color: Colors.textInk },
  rowSub: { ...Typography.bodySmall, color: Colors.textMuted },
  inviteBtn: {
    minWidth: SEND * 2, height: SEND - Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: Radii.full,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  inviteText: { ...Typography.chip, color: Colors.white },
  tag: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  tagText: { ...Typography.chip, color: Colors.textMuted },
  lead: { width: AVATAR, height: AVATAR, borderRadius: Radii.full, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },

  field: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, minHeight: FIELD_HEIGHT, paddingLeft: Spacing.md, paddingRight: Spacing.sm },
  input: { flex: 1, ...Typography.cardTitle, color: Colors.textInk, paddingVertical: Spacing.md },
  send: { width: SEND, height: SEND, borderRadius: Radii.full, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.35 },
  hint: { ...Typography.bodySmall, color: Colors.negative, marginTop: Spacing.sm, marginLeft: Spacing.xs },
  note: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: Spacing.sm, marginLeft: Spacing.xs },
  error: { ...Typography.body, color: Colors.negative },
});
