// HAKO — Onglet Profil (maquettes V2)
// Carte d'identité noire (photo, pseudo, e-mail, « Modifier »), trois
// compteurs, la liste des amis (+ ajouter, demandes reçues) et les réglages.
// Modifier le profil et ajouter un ami ouvrent des pages plein écran.

import { ComponentProps } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { SectionLabel, createCardStyles } from '@/components/createTrip/CreateTripChrome';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { useProfile } from '@/hooks/useProfile';
import { Friend } from '@/services/friendService';

type IconName = ComponentProps<typeof Ionicons>['name'];

const AVATAR = 88;
const FRIEND_AVATAR = 44;
const ROW_ICON = 36;
const TAB_BAR_SPACE = 120;
const APP_VERSION = '1.0.0';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const p = useProfile();

  const confirmSignOut = () => {
    Alert.alert('Se déconnecter', 'Tu vas être déconnecté(e). À bientôt !', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => { void p.signOut(); } },
    ]);
  };

  const confirmUnfriend = (friend: Friend) => {
    const name = friend.nickname ?? 'cet ami';
    Alert.alert(name, friend.email ?? undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer de mes amis', style: 'destructive',
        onPress: () => { void p.unfriend(friend.id).then(err => { if (err) Alert.alert('Oups', err); }); },
      },
    ]);
  };

  const pending = p.stats?.pendingRequests ?? 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + TAB_BAR_SPACE }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Profil</Text>

        {/* Carte d'identité */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.idCard}>
          <MemberAvatar member={{ avatar_url: p.avatarUrl, nickname: p.nickname, email: p.email }} size={AVATAR} />
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>{p.nickname}</Text>
            <Text style={styles.email} numberOfLines={1}>{p.email}</Text>
            <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/account/edit')} activeOpacity={0.85}>
              <Ionicons name="pencil" size={14} color={Colors.textPrimary} />
              <Text style={styles.editText}>Modifier</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Compteurs */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.stats}>
          <Stat value={p.stats?.trips} label="Voyages" icon="airplane" />
          <Stat value={p.stats?.wishes} label="Envies" icon="heart" />
          <Stat value={p.friends?.length} label="Amis" icon="people" />
        </Animated.View>

        {p.error ? <Text style={styles.errorText}>{p.error}</Text> : null}

        {/* Amis */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={styles.flex}><SectionLabel>Tes amis</SectionLabel></View>
            <TouchableOpacity style={styles.addPill} onPress={() => router.push('/account/add-friend')} activeOpacity={0.85}>
              <Ionicons name="person-add" size={14} color={Colors.white} />
              <Text style={styles.addPillText}>Ajouter</Text>
            </TouchableOpacity>
          </View>

          {pending > 0 && (
            <TouchableOpacity style={styles.requests} onPress={() => router.push('/notifications')} activeOpacity={0.85}>
              <View style={styles.requestsBadge}><Text style={styles.requestsCount}>{pending}</Text></View>
              <Text style={styles.requestsText}>
                {pending > 1 ? `${pending} demandes d’ami en attente` : '1 demande d’ami en attente'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.white} />
            </TouchableOpacity>
          )}

          <View style={[createCardStyles.whiteCard, styles.list]}>
            {p.friends === null ? (
              <ActivityIndicator color={Colors.primary} style={styles.loader} />
            ) : p.friends.length === 0 ? (
              <TouchableOpacity style={styles.empty} onPress={() => router.push('/account/add-friend')} activeOpacity={0.85}>
                <Ionicons name="people-outline" size={28} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>Pas encore d’amis ici</Text>
                <Text style={styles.emptyText}>Ajoute tes potes pour les inviter en un tap à tes prochains voyages.</Text>
              </TouchableOpacity>
            ) : p.friends.map((f, i) => (
              <TouchableOpacity
                key={f.id}
                style={[styles.friend, i > 0 && styles.rowBorder]}
                onPress={() => confirmUnfriend(f)}
                activeOpacity={0.85}
              >
                <MemberAvatar member={f} size={FRIEND_AVATAR} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{f.nickname ?? 'Voyageur'}</Text>
                  {f.email ? <Text style={styles.rowSub} numberOfLines={1}>{f.email}</Text> : null}
                </View>
                <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Réglages */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)} style={styles.section}>
          <SectionLabel>Réglages</SectionLabel>
          <View style={[createCardStyles.whiteCard, styles.list]}>
            <SettingRow icon="notifications-outline" label="Notifications" onPress={() => router.push('/settings/notifications')} />
            <SettingRow icon="mail-outline" label="Boîte de réception" onPress={() => router.push('/notifications')} border />
            <SettingRow icon="log-out-outline" label="Se déconnecter" onPress={confirmSignOut} border danger />
          </View>
        </Animated.View>

        <Text style={styles.version}>Hako v{APP_VERSION}</Text>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label, icon }: { value: number | undefined; label: string; icon: IconName }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={Colors.accent} />
      <Text style={styles.statValue}>{value ?? '–'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SettingRow({ icon, label, onPress, border, danger }: { icon: IconName; label: string; onPress: () => void; border?: boolean; danger?: boolean }) {
  return (
    <TouchableOpacity style={[styles.setting, border && styles.rowBorder]} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>
        <Ionicons name={icon} size={18} color={danger ? Colors.negative : Colors.textPrimary} />
      </View>
      <Text style={[styles.rowTitle, styles.flex, danger && styles.danger]}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.md, gap: Spacing.lg },
  pageTitle: { ...Typography.displayTitle, color: Colors.textPrimary },

  idCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md2,
    borderRadius: Radii.pill, backgroundColor: Colors.primary, ...Shadows.md,
  },
  name: { ...Typography.displayValue, color: Colors.white },
  email: { ...Typography.bodySmall, color: Colors.textOnDark, marginTop: Spacing.xs / 2 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, alignSelf: 'flex-start', marginTop: Spacing.sm2,
    paddingHorizontal: Spacing.sm2, paddingVertical: Spacing.xs + 2, borderRadius: Radii.full, backgroundColor: Colors.background,
  },
  editText: { ...Typography.chip, color: Colors.textPrimary },

  stats: { flexDirection: 'row', gap: Spacing.sm2 },
  stat: {
    flex: 1, alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md,
    ...createCardStyles.creamTile,
  },
  statValue: { ...Typography.displayValue, color: Colors.textPrimary },
  statLabel: { ...Typography.bodySmall, color: Colors.textMuted },

  section: { gap: Spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center' },
  addPill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm2, paddingVertical: Spacing.xs + 2, borderRadius: Radii.full, backgroundColor: Colors.accent,
  },
  addPillText: { ...Typography.chip, color: Colors.white },

  requests: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, padding: Spacing.sm2,
    borderRadius: Radii.lg, backgroundColor: Colors.accent, ...Shadows.md,
  },
  requestsBadge: { minWidth: ROW_ICON, height: ROW_ICON, borderRadius: Radii.full, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  requestsCount: { ...Typography.rowTitle, color: Colors.accent },
  requestsText: { flex: 1, ...Typography.rowTitle, color: Colors.white },

  list: { paddingHorizontal: Spacing.md },
  loader: { paddingVertical: Spacing.lg },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  friend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, paddingVertical: Spacing.sm2 },
  rowTitle: { ...Typography.rowTitle, color: Colors.textInk },
  rowSub: { ...Typography.bodySmall, color: Colors.textMuted },
  empty: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.lg },
  emptyTitle: { ...Typography.cardTitle, color: Colors.textInk },
  emptyText: { ...Typography.bodySmall, color: Colors.textMuted, textAlign: 'center' },

  setting: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, paddingVertical: Spacing.sm2 },
  settingIcon: { width: ROW_ICON, height: ROW_ICON, borderRadius: Radii.full, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  settingIconDanger: { backgroundColor: Colors.background },
  danger: { color: Colors.negative },

  errorText: { ...Typography.bodySmall, color: Colors.negative },
  version: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'center' },
});
