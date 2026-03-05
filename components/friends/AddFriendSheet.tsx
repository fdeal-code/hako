import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, Radii } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { MemberAvatar } from '@/components/ui/MemberAvatar';

/* ─── Types ─────────────────────────────────────────────────── */
interface FoundUser {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  email: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

/* ─── Component ─────────────────────────────────────────────── */
export function AddFriendSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const inputRef = useRef<TextInput>(null);

  const [searchEmail, setSearchEmail] = useState('');
  const [searching,   setSearching]   = useState(false);
  const [foundUser,   setFoundUser]   = useState<FoundUser | null>(null);
  const [notFound,    setNotFound]    = useState(false);
  const [sending,     setSending]     = useState(false);
  const [sent,        setSent]        = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSearchEmail('');
    setFoundUser(null);
    setNotFound(false);
    setSent(false);
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleSearch = async () => {
    const cleaned = searchEmail.trim().toLowerCase();
    if (!cleaned || !cleaned.includes('@')) {
      Alert.alert('Email invalide', 'Entre un email valide.');
      return;
    }
    if (cleaned === session?.user?.email?.toLowerCase()) {
      Alert.alert('Oups', "Tu ne peux pas t'ajouter toi-même !");
      return;
    }
    setSearching(true);
    setFoundUser(null);
    setNotFound(false);

    const { data } = await supabase
      .from('profiles')
      .select('id, nickname, avatar_url, email')
      .eq('email', cleaned)
      .single();

    console.log('FOUND USER:', JSON.stringify(data));

    if (data) {
      setFoundUser(data);
    } else {
      setNotFound(true);
    }
    setSearching(false);
  };

  const handleSendRequest = async () => {
    if (!foundUser || !session) return;
    setSending(true);
    const { error } = await supabase.from('friendships').insert({
      requester_id: session.user.id,
      addressee_id: foundUser.id,
      status: 'pending',
    });
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      setSent(true);
    }
    setSending(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={10}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[s.container, { paddingBottom: insets.bottom + Spacing.md }]}>

          <View style={s.handleBar} />

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Ajouter un ami</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={s.inputRow}>
            <TextInput
              ref={inputRef}
              style={s.input}
              value={searchEmail}
              onChangeText={text => {
                setSearchEmail(text);
                setFoundUser(null);
                setNotFound(false);
                setSent(false);
              }}
              placeholder="Email de ton ami"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity
              style={[s.searchBtn, searching && { opacity: 0.6 }]}
              onPress={handleSearch}
              disabled={searching}
              activeOpacity={0.85}
            >
              {searching
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="search" size={18} color="#fff" />
              }
            </TouchableOpacity>
          </View>

          {/* Not found */}
          {notFound && (
            <Text style={s.notFound}>Aucun utilisateur trouvé avec cet email.</Text>
          )}

          {/* Found user */}
          {foundUser && (
            <View style={s.userCard}>
              <MemberAvatar member={foundUser} size={48} index={0} />
              <View style={s.userInfo}>
                <Text style={s.userName}>{foundUser.nickname ?? 'Utilisateur'}</Text>
                <Text style={s.userEmail}>{foundUser.email}</Text>
              </View>
              {sent ? (
                <View style={s.sentBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                  <Text style={s.sentText}>Envoyé !</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[s.sendBtn, sending && { opacity: 0.6 }]}
                  onPress={handleSendRequest}
                  disabled={sending}
                  activeOpacity={0.85}
                >
                  {sending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.sendBtnText}>Ajouter</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  kav: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: Spacing.sm,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: 20,
    marginBottom: Spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: '#1A1A1A',
  },
  searchBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    paddingHorizontal: 20,
    color: '#888',
    fontSize: 14,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  userEmail: { fontSize: 12, color: '#888', marginTop: 2 },
  sendBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sentText: { color: '#22C55E', fontWeight: '600', fontSize: 13 },
});
