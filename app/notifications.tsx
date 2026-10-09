// HAKO — Centre de notifications (maquette « Notifications · Centre »)
// Page plein écran (remplace la feuille de la cloche). En haut « À FAIRE »
// avec l'action directement dans la carte (Rejoindre, Accepter, Voter,
// Qui réserve ?…), puis le fil d'activité.

import { ComponentProps, ReactNode, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { useInbox } from '@/hooks/useInbox';
import { FriendRequest, PendingInvitation } from '@/types/inbox';
import { AppNotification, TripActivityNotification, isTripActivity } from '@/types/notifications';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const LEAD_SIZE = 40;
const CLOSE_SIZE = 56;
const UNREAD_DOT = 8;
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function shortDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d ?? ''} ${MONTHS_SHORT[(m ?? 1) - 1] ?? ''}`;
}

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'hier' : `il y a ${days} j`;
}

/** Texte, icône et action d'une notification in-app. */
function describe(n: AppNotification): { icon: IoniconName; title: string; action?: string; todo: boolean } {
  switch (n.type) {
    case 'match_invite':
      return { icon: 'sparkles', title: `${n.payload.creator_nickname} t’invite au Trip Match « ${n.payload.title} »`, action: 'Répondre', todo: !n.read };
    case 'wish_validated':
      return { icon: 'checkmark', title: `« ${n.payload.title} » est validée ! Qui réserve ?`, action: 'Je m’en occupe', todo: !n.read };
    case 'wish_added':
      return { icon: 'heart-outline', title: `${n.payload.actor} propose « ${n.payload.title} »`, action: 'Voter', todo: !n.read };
    case 'expense_added':
      return { icon: 'wallet-outline', title: `${n.payload.actor} a payé ${Math.round(n.payload.amount)} € · ${n.payload.title}`, todo: false };
    case 'member_joined':
      return { icon: 'person-add-outline', title: `${n.payload.actor} a rejoint${n.payload.trip_name ? ` « ${n.payload.trip_name} »` : ' le voyage'}`, todo: false };
  }
}

function openNotification(n: AppNotification) {
  if (n.type === 'match_invite') { router.push(`/match/${n.payload.match_id}/questionnaire`); return; }
  const trip = (n as TripActivityNotification).payload.trip_id;
  if (n.type === 'expense_added') router.push(`/trip/${trip}/budget`);
  else if (n.type === 'member_joined') router.push(`/trip/${trip}/dashboard`);
  else router.push(`/trip/${trip}/envies`);
}

// ─── Briques visuelles ───────────────────────────────────────────────────────
function Lead({ uri, icon, accent }: { uri?: string | null; icon?: IoniconName; accent?: boolean }) {
  if (uri) return <Image source={{ uri }} style={styles.lead} />;
  return (
    <View style={[styles.lead, styles.leadIcon, accent ? styles.leadAccent : styles.leadDark]}>
      <Ionicons name={icon ?? 'notifications-outline'} size={18} color={Colors.textInverted} />
    </View>
  );
}

function TodoCard({ lead, title, meta, unread = true, children, onPress }: {
  lead: ReactNode; title: string; meta: string; unread?: boolean; children?: ReactNode; onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={onPress ? 0.9 : 1} disabled={!onPress}>
      {lead}
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.meta}>{meta}</Text>
        {children ? <View style={styles.actions}>{children}</View> : null}
      </View>
      {unread && <View style={styles.dot} />}
    </TouchableOpacity>
  );
}

function Pill({ label, kind, onPress, icon }: { label: string; kind: 'accent' | 'dark' | 'ghost'; onPress: () => void; icon?: IoniconName }) {
  const color = kind === 'ghost' ? Colors.textPrimary : Colors.textInverted;
  return (
    <TouchableOpacity style={[styles.pill, styles[`pill_${kind}`]]} onPress={onPress} activeOpacity={0.85}>
      {icon && <Ionicons name={icon} size={14} color={color} />}
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Écran ───────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const inbox = useInbox();
  const [busyId, setBusyId] = useState<string | null>(null);

  const todoNotifs = inbox.notifications.filter(n => describe(n).todo);
  const activity = inbox.notifications.filter(n => !describe(n).todo);
  const todoCount = inbox.invitations.length + inbox.friendRequests.length + todoNotifs.length;

  const run = async (id: string, action: () => Promise<string | null>, success?: string) => {
    setBusyId(id);
    const error = await action();
    setBusyId(null);
    if (error) Alert.alert('Oups', error);
    else if (success) Alert.alert(success);
  };

  const markAllRead = () => {
    inbox.notifications.filter(n => !n.read).forEach(n => { void inbox.markRead(n.id); });
  };

  const invitationCard = (inv: PendingInvitation) => (
    <TodoCard
      key={inv.id}
      lead={<Lead uri={inv.trips.cover_image_url} icon="airplane" accent />}
      title={`Invitation · ${inv.trips.name}`}
      meta={`${inv.trips.destination} · ${shortDay(inv.trips.start_date)} → ${shortDay(inv.trips.end_date)}`}
    >
      <Pill
        label={busyId === inv.id ? '…' : 'Rejoindre'}
        kind="accent"
        onPress={() => { void run(inv.id, () => inbox.acceptTripInvitation(inv), `Bienvenue dans « ${inv.trips.name} » !`); }}
      />
      <Pill label="Refuser" kind="ghost" onPress={() => { void run(inv.id, () => inbox.declineTripInvitation(inv.id)); }} />
    </TodoCard>
  );

  const friendCard = (req: FriendRequest) => (
    <TodoCard
      key={req.id}
      lead={<Lead uri={req.requester?.avatar_url} icon="person" />}
      title={`${req.requester?.nickname ?? 'Quelqu’un'} veut t’ajouter en ami`}
      meta={req.requester?.email ?? 'Demande d’ami'}
    >
      <Pill label="Accepter" kind="dark" onPress={() => { void run(req.id, () => inbox.acceptFriend(req.id)); }} />
      <Pill label="Refuser" kind="ghost" onPress={() => { void run(req.id, () => inbox.declineFriend(req.id)); }} />
    </TodoCard>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} activeOpacity={0.85} accessibilityLabel="Fermer">
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]} showsVerticalScrollIndicator={false}>
        {todoCount > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>À FAIRE · {todoCount}</Text>
              {todoNotifs.length > 0 && (
                <TouchableOpacity onPress={markAllRead}><Text style={styles.sectionLink}>Tout marquer lu</Text></TouchableOpacity>
              )}
            </View>
            {inbox.invitations.map(invitationCard)}
            {inbox.friendRequests.map(friendCard)}
            {todoNotifs.map(n => {
              const d = describe(n);
              return (
                <TodoCard
                  key={n.id}
                  lead={<Lead icon={d.icon} accent={n.type !== 'match_invite'} />}
                  title={d.title}
                  meta={timeAgo(n.created_at)}
                  onPress={() => { void inbox.markRead(n.id); openNotification(n); }}
                >
                  {d.action && (
                    <Pill
                      label={d.action}
                      kind={n.type === 'wish_validated' ? 'dark' : 'accent'}
                      icon={n.type === 'wish_added' ? 'thumbs-up' : undefined}
                      onPress={() => { void inbox.markRead(n.id); openNotification(n); }}
                    />
                  )}
                </TodoCard>
              );
            })}
          </View>
        )}

        {activity.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ACTIVITÉ</Text>
            {activity.map(n => {
              const d = describe(n);
              return (
                <TouchableOpacity
                  key={n.id}
                  style={styles.activityRow}
                  onPress={() => { void inbox.markRead(n.id); openNotification(n); }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.lead, styles.leadIcon, styles.leadCream]}>
                    <Ionicons name={d.icon} size={18} color={Colors.textInk} />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={styles.activityTitle}>{d.title}</Text>
                    <Text style={styles.meta}>{timeAgo(n.created_at)}</Text>
                  </View>
                  {!n.read && isTripActivity(n) && <View style={styles.dot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {todoCount === 0 && activity.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={36} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>Rien de neuf pour l’instant</Text>
            <Text style={styles.emptySub}>Les votes, invitations et dépenses du groupe arriveront ici.</Text>
          </View>
        )}

        <TouchableOpacity style={styles.settings} onPress={() => router.push('/settings/notifications')} activeOpacity={0.8}>
          <Ionicons name="options-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.settingsText}>Réglages des notifications</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md2, marginTop: Spacing.sm,
  },
  headerTitle: { ...Typography.headerSmall, color: Colors.textMuted },
  closeBtn: {
    width: CLOSE_SIZE, height: CLOSE_SIZE, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center', ...Shadows.md,
  },
  content: { paddingHorizontal: Spacing.md2, paddingTop: Spacing.lg, gap: Spacing.lg },
  section: { gap: Spacing.sm2 - 2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { ...Typography.displayLabel, color: Colors.textPrimary },
  sectionLink: { fontSize: 12, fontWeight: '600', color: Colors.accent },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm2,
    padding: Spacing.sm2, borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card,
  },
  lead: { width: LEAD_SIZE, height: LEAD_SIZE, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.primary },
  leadIcon: { alignItems: 'center', justifyContent: 'center' },
  leadAccent: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  leadDark: { backgroundColor: Colors.primary },
  leadCream: { backgroundColor: Colors.surface, borderColor: Colors.line },
  cardText: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: Colors.textInk },
  meta: { ...Typography.bodySmall, color: Colors.textMuted },
  actions: { flexDirection: 'row', gap: Spacing.sm, paddingTop: Spacing.sm },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radii.full,
  },
  pill_accent: { backgroundColor: Colors.accent },
  pill_dark: { backgroundColor: Colors.primary },
  pill_ghost: { borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.background },
  pillText: { fontSize: 13, fontWeight: '600' },
  dot: { width: UNREAD_DOT, height: UNREAD_DOT, borderRadius: Radii.full, backgroundColor: Colors.accent, marginTop: Spacing.xs },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2, paddingHorizontal: Spacing.sm2, paddingVertical: 6 },
  activityTitle: { ...Typography.body, color: Colors.textInk },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl },
  emptyTitle: { ...Typography.cardTitle, color: Colors.textPrimary },
  emptySub: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  settings: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.md },
  settingsText: { ...Typography.body, fontWeight: '600', color: Colors.textMuted },
});
