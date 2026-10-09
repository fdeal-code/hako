// HAKO — Section "Trip Match" de la sheet de notifications (cloche Home).
// Liste les notifications 'match_invite' ; le tap est géré par le parent
// (marque lue + ouvre le questionnaire du match).

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Shadows, Spacing } from '@/constants/theme';
import { MatchInviteNotification } from '@/types/notifications';

const ICON_SIZE = 20;
const CHEVRON_SIZE = 16;
const UNREAD_DOT_SIZE = 8;

interface MatchInviteListProps {
  notifications: MatchInviteNotification[];
  onPress: (notification: MatchInviteNotification) => void;
}

export function MatchInviteList({ notifications, onPress }: MatchInviteListProps) {
  if (notifications.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Trip Match</Text>
      {notifications.map(notification => (
        <TouchableOpacity
          key={notification.id}
          style={styles.card}
          onPress={() => onPress(notification)}
          activeOpacity={0.8}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="sparkles" size={ICON_SIZE} color={Colors.primary} />
          </View>
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>
              {notification.payload.title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {notification.payload.creator_nickname} t’invite à matcher — réponds au questionnaire !
            </Text>
          </View>
          {!notification.read && <View style={styles.unreadDot} />}
          <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={Colors.textTertiary} />
        </TouchableOpacity>
      ))}
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  unreadDot: {
    width: UNREAD_DOT_SIZE,
    height: UNREAD_DOT_SIZE,
    borderRadius: UNREAD_DOT_SIZE / 2,
    backgroundColor: Colors.negative,
  },
});
