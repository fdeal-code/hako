import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { AddFriendSheet } from '@/components/friends/AddFriendSheet';

/* ─── Types ─────────────────────────────────────────────────── */
interface Friend {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  email: string | null;
}

/* ─── Screen ─────────────────────────────────────────────────── */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const userId = session?.user?.id;

  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    session?.user?.user_metadata?.avatar_url,
  );
  const [nickname, setNickname] = useState(
    session?.user?.user_metadata?.nickname || 'Voyageur',
  );
  const email = session?.user?.email || '';

  /* ── Stats ── */
  const [tripsCount,  setTripsCount]  = useState(0);
  const [wishesCount, setWishesCount] = useState(0);
  const [friendsCount, setFriendsCount] = useState(0);

  /* ── Friends ── */
  const [friends,        setFriends]        = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  /* ── Sheets ── */
  const [showEdit,      setShowEdit]      = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);

  /* ── Load data ── */
  const loadData = useCallback(() => {
    if (!userId) return;

    (async () => {
      /* Trips count */
      const { count: tc } = await supabase
        .from('trip_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      setTripsCount(tc ?? 0);

      /* Wishes count */
      const { count: wc } = await supabase
        .from('wishes')
        .select('*', { count: 'exact', head: true })
        .eq('added_by', userId);
      setWishesCount(wc ?? 0);

      /* Friends (two-step) */
      setLoadingFriends(true);
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

      const friendIds = [
        ...(sentData ?? []).map(f => f.addressee_id),
        ...(receivedData ?? []).map(f => f.requester_id),
      ];
      setFriendsCount(friendIds.length);

      const profiles: Friend[] = [];
      for (const id of friendIds) {
        const { data } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_url, email')
          .eq('id', id)
          .single();
        if (data) profiles.push(data);
      }
      setFriends(profiles);
      setLoadingFriends(false);
    })();
  }, [userId]);

  useFocusEffect(loadData);

  /* ── Sign out ── */
  const handleSignOut = () => {
    Alert.alert('Se déconnecter', 'Tu vas être déconnecté(e). À bientôt !', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Header ── */}
        <View style={s.pageHeader}>
          <Text style={s.pageTitle}>Profil</Text>
        </View>

        {/* ── Avatar + infos ── */}
        <View style={s.profileCard}>
          <View style={s.avatarWrap}>
            <MemberAvatar
              member={{ avatar_url: avatarUrl, nickname, email }}
              size={100}
              index={0}
            />
          </View>
          <Text style={s.name}>{nickname}</Text>
          <Text style={s.emailText}>{email}</Text>
          <TouchableOpacity
            style={s.editBtn}
            onPress={() => setShowEdit(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={13} color={Colors.textSecondary} />
            <Text style={s.editBtnText}>Modifier le profil</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats ── */}
        <View style={s.statsRow}>
          <StatCard value={tripsCount}  label="Voyages" icon="airplane-outline" />
          <StatCard value={wishesCount} label="Envies"  icon="heart-outline" />
          <StatCard value={friendsCount} label="Amis"  icon="people-outline" />
        </View>

        {/* ── Mes amis ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Mes amis ({friendsCount})</Text>
            <TouchableOpacity
              onPress={() => setShowAddFriend(true)}
              activeOpacity={0.7}
              style={s.addFriendBtn}
            >
              <Ionicons name="person-add-outline" size={15} color={Colors.primary} />
              <Text style={s.addFriendBtnText}>Ajouter</Text>
            </TouchableOpacity>
          </View>

          {loadingFriends ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.md }} />
          ) : friends.length === 0 ? (
            <View style={s.emptyFriends}>
              <Text style={s.emptyFriendsText}>Pas encore d'amis ici...</Text>
            </View>
          ) : (
            <View style={s.friendsList}>
              {friends.map(f => (
                <View key={f.id} style={s.friendRow}>
                  <MemberAvatar member={f} size={44} index={0} />
                  <View style={s.friendInfo}>
                    <Text style={s.friendName}>{f.nickname ?? 'Utilisateur'}</Text>
                    {f.email ? <Text style={s.friendEmail}>{f.email}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Déconnexion ── */}
        <TouchableOpacity style={s.logoutBtn} activeOpacity={0.85} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color={Colors.vote.love} />
          <Text style={s.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>

        <Text style={s.version}>Hako v1.0.0</Text>
      </ScrollView>

      {/* ── Edit profile sheet ── */}
      <EditProfileSheet
        visible={showEdit}
        onClose={() => setShowEdit(false)}
        initialNickname={nickname}
        initialAvatarUrl={avatarUrl}
        userId={userId!}
        email={email}
        onSaved={(newNickname, newAvatar) => {
          setNickname(newNickname);
          setAvatarUrl(newAvatar);
        }}
      />

      {/* ── Add friend sheet ── */}
      <AddFriendSheet
        visible={showAddFriend}
        onClose={() => {
          setShowAddFriend(false);
          loadData();
        }}
      />
    </View>
  );
}

/* ─── StatCard ───────────────────────────────────────────────── */
function StatCard({
  value,
  label,
  icon,
}: {
  value: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={s.statCard}>
      <Ionicons name={icon} size={22} color="#888" />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

/* ─── EditProfileSheet ───────────────────────────────────────── */
interface EditSheetProps {
  visible: boolean;
  onClose: () => void;
  initialNickname: string;
  initialAvatarUrl?: string;
  userId: string;
  email: string;
  onSaved: (nickname: string, avatarUrl: string | undefined) => void;
}

function EditProfileSheet({
  visible,
  onClose,
  initialNickname,
  initialAvatarUrl,
  userId,
  email,
  onSaved,
}: EditSheetProps) {
  const insets = useSafeAreaInsets();

  const [editNickname, setEditNickname] = useState(initialNickname);
  const [localUri,     setLocalUri]     = useState<string | undefined>();
  const [saving,       setSaving]       = useState(false);

  /* Reset state when sheet opens */
  useEffect(() => {
    if (visible) {
      setEditNickname(initialNickname);
      setLocalUri(undefined);
    }
  }, [visible, initialNickname]);

  const displayAvatarUrl = localUri ?? initialAvatarUrl;

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorise l'accès à ta galerie.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setLocalUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let finalAvatarUrl = initialAvatarUrl;

      if (localUri) {
        const ext      = localUri.split('.').pop() ?? 'jpg';
        const filePath = `${userId}/profile.${ext}`;
        const formData = new FormData();
        formData.append('file', { uri: localUri, name: `profile.${ext}`, type: `image/${ext}` } as any);

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, formData, { upsert: true, contentType: `image/${ext}` });
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
        finalAvatarUrl = `${publicUrl}?t=${Date.now()}`;
      }

      await supabase.auth.updateUser({ data: { nickname: editNickname, avatar_url: finalAvatarUrl } });
      await supabase.from('profiles').upsert(
        { id: userId, nickname: editNickname, avatar_url: finalAvatarUrl, email },
        { onConflict: 'id' },
      );

      onSaved(editNickname, finalAvatarUrl);
      onClose();
    } catch (e: unknown) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={es.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={10}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[es.container, { paddingBottom: insets.bottom + Spacing.md }]}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />

          <View style={es.handleBar} />

          {/* Header */}
          <View style={es.header}>
            <Text style={es.title}>Modifier le profil</Text>
            <TouchableOpacity onPress={onClose} style={es.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={es.body}>
            {/* Avatar picker */}
            <TouchableOpacity
              onPress={handlePickPhoto}
              activeOpacity={0.8}
              style={es.avatarPickerWrap}
            >
              <MemberAvatar
                member={{ avatar_url: displayAvatarUrl, nickname: editNickname }}
                size={80}
                index={0}
              />
              <View style={es.cameraBtn}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.7}>
              <Text style={es.changePhotoText}>Changer la photo</Text>
            </TouchableOpacity>

            {/* Nickname */}
            <Text style={es.label}>Surnom</Text>
            <TextInput
              style={es.input}
              value={editNickname}
              onChangeText={setEditNickname}
              placeholder="Ton surnom"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
            />
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[es.saveBtn, (saving || !editNickname.trim()) && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving || !editNickname.trim()}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={es.saveBtnText}>Sauvegarder</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─── Styles (screen) ────────────────────────────────────────── */
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  pageHeader: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
  },

  /* Profile card */
  profileCard: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatarWrap: {
    marginBottom: Spacing.md,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  emailText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editBtnText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: 4,
    ...Shadows.sm,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  /* Friends section */
  section: {
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    ...Shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addFriendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    backgroundColor: Colors.surface,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addFriendBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyFriends: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  emptyFriendsText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  friendsList: { gap: Spacing.sm },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  friendInfo: { flex: 1 },
  friendName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  friendEmail: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },

  /* Logout */
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.vote.love,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
});

/* ─── Styles (edit sheet) ────────────────────────────────────── */
const es = StyleSheet.create({
  kav: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  container: {
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    overflow: 'hidden',
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  closeBtn: { padding: Spacing.xs },
  body: {
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatarPickerWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  changePhotoText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  label: {
    alignSelf: 'stretch',
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    alignSelf: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  saveBtn: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
