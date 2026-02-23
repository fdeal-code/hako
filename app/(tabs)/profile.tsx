import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const [uploading,  setUploading]  = useState(false);
  const [avatarUrl,  setAvatarUrl]  = useState<string | undefined>(
    session?.user?.user_metadata?.avatar_url,
  );

  const nickname = session?.user?.user_metadata?.nickname || 'Voyageur';
  const email    = session?.user?.email || '';

  /* ── Photo de profil ─────────────────────────────────────── */
  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorise l'accès à ta galerie pour changer ta photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    try {
      setUploading(true);
      const uri      = result.assets[0].uri;
      const userId   = session!.user.id;
      const ext      = uri.split('.').pop() ?? 'jpg';
      const filePath = `${userId}/profile.${ext}`;

      const formData = new FormData();
      formData.append('file', { uri, name: `profile.${ext}`, type: `image/${ext}` } as any);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, formData, { upsert: true, contentType: `image/${ext}` });

      console.log('UPLOAD ERROR:', uploadError);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const timestampedUrl = `${publicUrl}?t=${Date.now()}`;
      console.log('AVATAR URL:', timestampedUrl);

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: timestampedUrl },
      });

      if (updateError) throw updateError;

      // Mise à jour immédiate sans attendre onAuthStateChange
      setAvatarUrl(timestampedUrl);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erreur lors du chargement.';
      Alert.alert('Erreur', message);
    } finally {
      setUploading(false);
    }
  };

  /* ── Déconnexion ─────────────────────────────────────────── */
  const handleSignOut = () => {
    Alert.alert(
      'Se déconnecter',
      'Tu vas être déconnecté(e). À bientôt !',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter', style: 'destructive', onPress: signOut },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profil</Text>
        </View>

        {/* Avatar + name */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            onPress={handlePickAvatar}
            activeOpacity={0.8}
            style={styles.avatarContainer}
            disabled={uploading}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>
                  {nickname.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.editAvatarBtn}>
              {uploading
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Ionicons name="camera" size={14} color={Colors.white} />
              }
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{nickname}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        {/* Menu */}
        <View style={styles.menuSection}>
          <MenuItem icon="notifications-outline" label="Notifications" />
          <MenuItem icon="shield-checkmark-outline" label="Confidentialité" />
          <MenuItem icon="help-circle-outline" label="Aide & Support" />
          <MenuItem icon="information-circle-outline" label="À propos de Hako" />
        </View>

        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.85} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color={Colors.vote.love} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function MenuItem({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
      <Ionicons name={icon} size={20} color={Colors.textSecondary} />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  header: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  email: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  menuSection: {
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
    ...Shadows.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.vote.love,
  },
});
