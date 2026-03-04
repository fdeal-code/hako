/**
 * InviteSheet — Bottom sheet for inviting friends to a trip.
 * Owner only. Shows:
 *  1. "Mes amis" section — one-tap invite with status (member / invited / invite)
 *  2. "Par email" section — manual email invite
 *  3. Sent invitations list
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
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
interface Invitation {
  id: string;
  invited_email: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

interface FriendDisplay {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  email: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  tripId: string;
}

/* ─── Status config ─────────────────────────────────────────── */
const STATUS: Record<string, { icon: string; label: string; color: string }> = {
  pending:  { icon: '⏳', label: 'En attente', color: '#9CA3AF' },
  accepted: { icon: '✅', label: 'Acceptée',   color: '#22C55E' },
  declined: { icon: '❌', label: 'Refusée',    color: '#EF4444' },
};

/* ─── Component ─────────────────────────────────────────────── */
export function InviteSheet({ visible, onClose, tripId }: Props) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const emailInputRef = useRef<TextInput>(null);
  const [email,       setEmail]       = useState('');
  const [sending,     setSending]     = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading,     setLoading]     = useState(false);

  /* Friends */
  const [friends,          setFriends]          = useState<FriendDisplay[]>([]);
  const [memberIds,        setMemberIds]        = useState<Set<string>>(new Set());
  const [sendingFriendId,  setSendingFriendId]  = useState<string | null>(null);

  /* Auto-focus email after bottom sheet animation */
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => emailInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [visible]);

  const fetchInvitations = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    const { data } = await supabase
      .from('invitations')
      .select('id, invited_email, status, created_at')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });
    setInvitations(data ?? []);
    setLoading(false);
  }, [tripId]);

  const loadFriendsAndMembers = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId || !tripId) return;

    /* Members of this trip */
    const { data: membersData } = await supabase
      .from('trip_members')
      .select('user_id')
      .eq('trip_id', tripId);
    setMemberIds(new Set((membersData ?? []).map(m => m.user_id)));

    /* Friends (two-step) */
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

    const profiles: FriendDisplay[] = [];
    for (const id of friendIds) {
      const { data } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url, email')
        .eq('id', id)
        .single();
      if (data) profiles.push(data);
    }
    setFriends(profiles);
  }, [session?.user?.id, tripId]);

  useEffect(() => {
    if (visible) {
      setEmail('');
      fetchInvitations();
      loadFriendsAndMembers();
    }
  }, [visible, fetchInvitations, loadFriendsAndMembers]);

  /* Derive invited emails from invitations state */
  const invitedEmails = new Set(
    invitations
      .filter(inv => inv.status !== 'declined')
      .map(inv => inv.invited_email),
  );

  /* ── Email invite ── */
  const handleSend = async () => {
    const cleaned = email.trim().toLowerCase();
    if (!cleaned || !cleaned.includes('@')) {
      Alert.alert('Email invalide', 'Entre un email valide.');
      return;
    }
    setSending(true);
    console.log('SENDING INVITE TO:', cleaned);
    const { data, error } = await supabase.from('invitations').insert({
      trip_id:       tripId,
      invited_by:    session!.user.id,
      invited_email: cleaned,
      status:        'pending',
    }).select();
    console.log('INVITE ERROR:', JSON.stringify(error));
    console.log('INVITE DATA:', JSON.stringify(data));
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      setEmail('');
      fetchInvitations();
    }
    setSending(false);
  };

  /* ── Friend invite ── */
  const handleInviteFriend = async (friend: FriendDisplay) => {
    if (!friend.email) return;
    setSendingFriendId(friend.id);
    const { error } = await supabase.from('invitations').insert({
      trip_id:       tripId,
      invited_by:    session!.user.id,
      invited_email: friend.email,
      status:        'pending',
    });
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      fetchInvitations();
    }
    setSendingFriendId(null);
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
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />

          <View style={s.handleBar} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={s.header}>
              <Text style={s.title}>Inviter des amis</Text>
              <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* ── Mes amis ── */}
            {friends.length > 0 && (
              <>
                <Text style={s.sectionLabel}>Mes amis</Text>
                {friends.map(friend => {
                  const isMember  = memberIds.has(friend.id);
                  const isInvited = friend.email ? invitedEmails.has(friend.email) : false;
                  const isSending = sendingFriendId === friend.id;

                  return (
                    <View key={friend.id} style={s.friendRow}>
                      <MemberAvatar member={friend} size={36} index={0} />
                      <Text style={s.friendName} numberOfLines={1}>
                        {friend.nickname ?? 'Ami'}
                      </Text>
                      {isMember ? (
                        <Text style={s.tagText}>Déjà membre</Text>
                      ) : isInvited ? (
                        <Text style={s.tagText}>Invitation envoyée</Text>
                      ) : (
                        <TouchableOpacity
                          style={[s.inviteBtn, isSending && { opacity: 0.6 }]}
                          onPress={() => handleInviteFriend(friend)}
                          disabled={sendingFriendId !== null}
                          activeOpacity={0.85}
                        >
                          {isSending
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={s.inviteBtnText}>Inviter</Text>
                          }
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
                <View style={s.divider} />
              </>
            )}

            {/* ── Par email ── */}
            <Text style={s.sectionLabel}>Par email</Text>
            <View style={s.inputRow}>
              <TextInput
                ref={emailInputRef}
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email de ton ami"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus={false}
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity
                style={[s.sendBtn, sending && { opacity: 0.6 }]}
                onPress={handleSend}
                disabled={sending}
                activeOpacity={0.85}
              >
                {sending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.sendBtnText}>Envoyer</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Sent invitations */}
            {loading && invitations.length === 0 ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.md }} />
            ) : invitations.length > 0 ? (
              <>
                <Text style={[s.sectionLabel, { marginTop: Spacing.md }]}>Invitations envoyées</Text>
                {invitations.map(inv => {
                  const cfg = STATUS[inv.status] ?? STATUS.pending;
                  return (
                    <View key={inv.id} style={s.invRow}>
                      <Text style={s.invEmail} numberOfLines={1}>{inv.invited_email}</Text>
                      <View style={s.statusBadge}>
                        <Text style={s.statusIcon}>{cfg.icon}</Text>
                        <Text style={[s.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : null}

          </ScrollView>
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
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    overflow: 'hidden',
    maxHeight: '80%',
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
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  closeBtn: { padding: Spacing.xs },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },

  /* Friends list */
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
  },
  friendName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  tagText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  inviteBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  inviteBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },

  /* Email input */
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  /* Sent invitations */
  invRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  invEmail: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
    marginRight: Spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusIcon: { fontSize: 12 },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
