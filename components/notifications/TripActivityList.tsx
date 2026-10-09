// HAKO — Centre de notifications : activité des voyages
// « À faire » (envie validée → qui réserve ?) en haut, le fil d'activité
// en dessous. Le tap est géré par le parent (marque lue + navigation).

import { ComponentProps } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { TripActivityNotification } from '@/types/notifications';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface TripActivityListProps {
  notifications: TripActivityNotification[];
  onPress: (notification: TripActivityNotification) => void;
}

const ICON_WRAP = 36;
const UNREAD_DOT = 8;

interface Presented {
  icon: IoniconName;
  title: string;
  action?: string;
}

function present(n: TripActivityNotification): Presented {
  switch (n.type) {
    case 'wish_validated':
      return { icon: 'checkmark-circle', title: `« ${n.payload.title} » est validée !`, action: 'Qui réserve ?' };
    case 'wish_added':
      return { icon: 'heart-outline', title: `${n.payload.actor} propose « ${n.payload.title} »`, action: 'Voter' };
    case 'expense_added':
      return { icon: 'wallet-outline', title: `${n.payload.actor} a payé ${Math.round(n.payload.amount)} € · ${n.payload.title}` };
    case 'member_joined':
      return { icon: 'person-add-outline', title: `${n.payload.actor} a rejoint${n.payload.trip_name ? ` « ${n.payload.trip_name} »` : ' le voyage'}` };
  }
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

/** Vrai pour ce qui demande une action et n'a pas encore été vu. */
function isTodo(n: TripActivityNotification): boolean {
  return !n.read && (n.type === 'wish_validated' || n.type === 'wish_added');
}

export function TripActivityList({ notifications, onPress }: TripActivityListProps) {
  if (notifications.length === 0) return null;
  const todo = notifications.filter(isTodo);
  const activity = notifications.filter(n => !isTodo(n));

  const renderItem = (n: TripActivityNotification, highlighted: boolean) => {
    const p = present(n);
    return (
      <TouchableOpacity
        key={n.id}
        style={[styles.card, highlighted && styles.cardTodo]}
        onPress={() => onPress(n)}
        activeOpacity={0.8}
      >
        <View style={[styles.iconWrap, highlighted && styles.iconWrapTodo]}>
          <Ionicons name={p.icon} size={18} color={highlighted ? Colors.textInverted : Colors.textPrimary} />
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{p.title}</Text>
          <Text style={styles.meta}>{timeAgo(n.created_at)}</Text>
          {highlighted && p.action && (
            <View style={styles.action}>
              <Text style={styles.actionText}>{p.action}</Text>
            </View>
          )}
        </View>
        {!n.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.section}>
      {todo.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>À faire · {todo.length}</Text>
          {todo.map(n => renderItem(n, true))}
        </>
      )}
      {activity.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, todo.length > 0 && styles.sectionSpaced]}>Activité</Text>
          {activity.map(n => renderItem(n, false))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing.lg },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  sectionSpaced: { marginTop: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm2,
    padding: Spacing.sm2,
    marginBottom: Spacing.sm,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTodo: {
    borderColor: Colors.borderDark,
    ...Shadows.sm,
  },
  iconWrap: {
    width: ICON_WRAP,
    height: ICON_WRAP,
    borderRadius: Radii.full,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapTodo: { backgroundColor: Colors.accent },
  info: { flex: 1, gap: 2 },
  title: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary },
  meta: { ...Typography.bodySmall, color: Colors.textSecondary },
  action: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm2,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary,
  },
  actionText: { ...Typography.bodySmall, fontWeight: '700', color: Colors.textInverted },
  unreadDot: {
    width: UNREAD_DOT,
    height: UNREAD_DOT,
    borderRadius: Radii.full,
    backgroundColor: Colors.accent,
    marginTop: Spacing.xs,
  },
});
