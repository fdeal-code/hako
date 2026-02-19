import { View, Image, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radii } from '@/constants/theme';

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: number;
  style?: ViewStyle;
}

export function Avatar({ uri, name, size = 36, style }: AvatarProps) {
  const initials = name
    ? name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.38 }]}>
          {initials}
        </Text>
      )}
    </View>
  );
}

interface AvatarGroupProps {
  users: Array<{ id: string; name?: string; avatar_url?: string }>;
  max?: number;
  size?: number;
  style?: ViewStyle;
}

export function AvatarGroup({ users, max = 3, size = 32, style }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - max;
  const overlap = size * 0.35;

  return (
    <View style={[styles.group, style]}>
      {visible.map((user, i) => (
        <View
          key={user.id}
          style={{ marginLeft: i === 0 ? 0 : -overlap, zIndex: i }}
        >
          <Avatar
            uri={user.avatar_url}
            name={user.name}
            size={size}
            style={styles.avatarBorder}
          />
        </View>
      ))}
      {overflow > 0 && (
        <View
          style={[
            styles.overflow,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -overlap,
            },
          ]}
        >
          <Text style={[styles.overflowText, { fontSize: size * 0.32 }]}>
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  avatarBorder: {
    borderWidth: 2,
    borderColor: Colors.white,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overflow: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
