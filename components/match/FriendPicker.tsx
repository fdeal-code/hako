// HAKO — Sélecteur d'amis multi-sélection (Trip Match)
// Pattern de chargement identique à l'étape invitation de trip/create.tsx
// (friendships acceptées dans les deux sens → profiles).

import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Shadows, Spacing } from '@/constants/theme';
import { Avatar } from '@/components/ui/Avatar';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

const AVATAR_SIZE = 40;
const EMPTY_TEXT = 'Ajoute des amis depuis ton profil pour les embarquer !';

interface FriendProfile {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
}

interface FriendPickerProps {
  selectedIds: string[];
  onToggle: (friendId: string) => void;
}

export function FriendPicker({ selectedIds, onToggle }: FriendPickerProps) {
  const { session } = useAuth();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) { setLoading(false); return; }
    (async () => {
      const { data: sentData } = await supabase
        .from('friendships')
        .select('addressee_id')
        .eq('requester_id', userId)
        .eq('status', 'accepted');
      const { data: receivedData } = await supabase
        .from('friendships')
        .select('requester_id')
        .eq('addressee_id', userId)
        .eq('status', 'accepted');
      const ids = [
        ...(sentData ?? []).map((f: { addressee_id: string }) => f.addressee_id),
        ...(receivedData ?? []).map((f: { requester_id: string }) => f.requester_id),
      ];
      const profiles: FriendProfile[] = [];
      for (const id of ids) {
        const { data } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_url')
          .eq('id', id)
          .single();
        if (data) profiles.push(data as FriendProfile);
      }
      setFriends(profiles);
      setLoading(false);
    })();
  }, [session?.user?.id]);

  if (loading) {
    return <ActivityIndicator size="small" color={Colors.primary} style={styles.loader} />;
  }
  if (friends.length === 0) {
    return <Text style={styles.empty}>{EMPTY_TEXT}</Text>;
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {friends.map(friend => {
        const selected = selectedIds.includes(friend.id);
        return (
          <TouchableOpacity
            key={friend.id}
            style={styles.row}
            onPress={() => onToggle(friend.id)}
            activeOpacity={0.75}
          >
            <Avatar name={friend.nickname ?? undefined} uri={friend.avatar_url ?? undefined} size={AVATAR_SIZE} />
            <Text style={styles.name} numberOfLines={1}>
              {friend.nickname ?? 'Voyageur'}
            </Text>
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={selected ? Colors.primary : Colors.textTertiary}
            />
          </TouchableOpacity>
        );
      })}
      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: Spacing.lg },
  empty: {
    marginTop: Spacing.lg,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm2,
    backgroundColor: Colors.surface,
    borderRadius: Radii.sm,
    padding: Spacing.sm2,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  bottomSpace: { height: Spacing.md },
});
