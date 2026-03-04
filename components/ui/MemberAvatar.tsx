import { Image, Text, View } from 'react-native';

const COLORS = ['#E8C5A5', '#A5B8E0', '#A8D5B5', '#E0A5A5', '#C5A5E8', '#A5E0D5'];

function getInitialColor(name?: string | null): string {
  if (!name) return COLORS[0];
  return COLORS[name.charCodeAt(0) % COLORS.length];
}

interface MemberAvatarProps {
  member: {
    avatar_url?: string | null;
    nickname?: string | null;
    email?: string | null;
  };
  size?: number;
  index?: number;
}

export function MemberAvatar({ member, size = 40, index = 0 }: MemberAvatarProps) {
  const hasPhoto = !!member.avatar_url && member.avatar_url.length > 0;
  const initial = (member.nickname || member.email || '?')[0].toUpperCase();

  const sharedStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 2,
    borderColor: '#FFF',
    marginLeft: index > 0 ? -10 : 0,
  };

  if (hasPhoto) {
    return (
      <Image
        source={{ uri: member.avatar_url! + '?t=' + Date.now() }}
        style={sharedStyle}
      />
    );
  }

  return (
    <View style={[sharedStyle, {
      backgroundColor: getInitialColor(member.nickname),
      justifyContent: 'center',
      alignItems: 'center',
    }]}>
      <Text style={{ color: '#FFF', fontSize: size * 0.4, fontWeight: '700' }}>
        {initial}
      </Text>
    </View>
  );
}
