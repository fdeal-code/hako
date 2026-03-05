/**
 * PendingInvitationsSheet — Bottom sheet showing received trip invitations
 * and pending friend requests.
 */
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, Radii, Shadows } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { tripEvents } from '@/utils/events';
import { MemberAvatar } from '@/components/ui/MemberAvatar';

/* ─── Types ─────────────────────────────────────────────────── */
export interface PendingInvitation {
  id: string;
  trip_id: string;
  invited_by: string;
  trips: {
    name: string;
    destination: string;
    cover_image_url?: string | null;
    start_date: string;
    end_date: string;
  };
}

export interface FriendRequest {
  id: string;
  requester_id: string;
  requester: {
    id: string;
    nickname: string | null;
    avatar_url: string | null;
    email: string | null;
  } | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  invitations: PendingInvitation[];
  onRefresh: () => void;
  friendRequests: FriendRequest[];
  onFriendRequestsRefresh: () => void;
}

/* ─── Helpers ────────────────────────────────────────────────── */
const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

function formatDates(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end   + 'T00:00:00');
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} – ${e.getDate()} ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
  }
  return `${s.getDate()} ${MONTHS[s.getMonth()]} – ${e.getDate()} ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
}

/* ─── Component ─────────────────────────────────────────────── */
export function PendingInvitationsSheet({
  visible,
  onClose,
  invitations,
  onRefresh,
  friendRequests,
  onFriendRequestsRefresh,
}: Props) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [processing,       setProcessing]       = useState<string | null>(null);
  const [processingFriend, setProcessingFriend] = useState<string | null>(null);

  const isEmpty = invitations.length === 0 && friendRequests.length === 0;

  /* ── Trip invitation ── */
  const handleAccept = async (inv: PendingInvitation) => {
    setProcessing(inv.id);
    try {
      await supabase
        .from('invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', inv.id);

      await supabase.from('trip_members').insert({
        trip_id: inv.trip_id,
        user_id: session!.user.id,
        role:    'member',
      });

      tripEvents.emit();
      onRefresh();
      Alert.alert('🎉 Tu fais partie du voyage !', `Bienvenue dans "${inv.trips.name}" !`);
    } catch {
      Alert.alert('Erreur', "Impossible d'accepter l'invitation.");
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (inv: PendingInvitation) => {
    setProcessing(inv.id);
    await supabase
      .from('invitations')
      .update({ status: 'declined' })
      .eq('id', inv.id);
    setProcessing(null);
    onRefresh();
  };

  /* ── Friend request ── */
  const handleAcceptFriend = async (req: FriendRequest) => {
    setProcessingFriend(req.id);
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', req.id);
    setProcessingFriend(null);
    onFriendRequestsRefresh();
  };

  const handleDeclineFriend = async (req: FriendRequest) => {
    setProcessingFriend(req.id);
    await supabase
      .from('friendships')
      .delete()
      .eq('id', req.id);
    setProcessingFriend(null);
    onFriendRequestsRefresh();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[s.container, { paddingBottom: insets.bottom + Spacing.md }]}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />

          <View style={s.handleBar} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

            {/* Header */}
            <View style={s.header}>
              <Text style={s.title}>Notifications</Text>
              <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Empty state */}
            {isEmpty && (
              <View style={s.emptyState}>
                <Text style={s.emptyIcon}>🔔</Text>
                <Text style={s.emptyText}>Aucune notification pour l'instant.</Text>
              </View>
            )}

            {/* ── Demandes d'amis ── */}
            {friendRequests.length > 0 && (
              <>
                <Text style={s.sectionLabel}>Demandes d'amis</Text>
                {friendRequests.map(req => {
                  const isProc = processingFriend === req.id;
                  const name   = req.requester?.nickname ?? "Quelqu'un";
                  return (
                    <View key={req.id} style={s.friendReqCard}>
                      <MemberAvatar member={req.requester ?? {}} size={44} index={0} />
                      <View style={s.friendReqInfo}>
                        <Text style={s.friendReqName}>{name}</Text>
                        <Text style={s.friendReqSubtitle}>veut être ton ami(e)</Text>
                      </View>
                      <View style={s.friendReqBtns}>
                        <TouchableOpacity
                          style={[s.acceptFriendBtn, isProc && { opacity: 0.6 }]}
                          onPress={() => handleAcceptFriend(req)}
                          disabled={isProc}
                          activeOpacity={0.85}
                        >
                          {isProc
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Ionicons name="checkmark" size={16} color="#fff" />
                          }
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.declineFriendBtn, isProc && { opacity: 0.6 }]}
                          onPress={() => handleDeclineFriend(req)}
                          disabled={isProc}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="close" size={16} color={Colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {/* ── Invitations de voyage ── */}
            {invitations.length > 0 && (
              <>
                <Text style={[s.sectionLabel, friendRequests.length > 0 && { marginTop: Spacing.lg }]}>
                  Invitations de voyage
                </Text>
                {invitations.map(inv => {
                  const isProcessing = processing === inv.id;
                  return (
                    <View key={inv.id} style={s.card}>
                      {inv.trips.cover_image_url ? (
                        <Image
                          source={{ uri: inv.trips.cover_image_url }}
                          style={s.cover}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[s.cover, s.coverFallback]}>
                          <Text style={s.coverEmoji}>✈️</Text>
                        </View>
                      )}
                      <View style={s.cardContent}>
                        <Text style={s.tripName}>{inv.trips.name}</Text>
                        {inv.trips.destination ? (
                          <Text style={s.destination}>📍 {inv.trips.destination}</Text>
                        ) : null}
                        <Text style={s.dates}>
                          {formatDates(inv.trips.start_date, inv.trips.end_date)}
                        </Text>
                        <View style={s.btnRow}>
                          <TouchableOpacity
                            style={[s.acceptBtn, isProcessing && { opacity: 0.6 }]}
                            onPress={() => handleAccept(inv)}
                            disabled={isProcessing}
                            activeOpacity={0.85}
                          >
                            {isProcessing
                              ? <ActivityIndicator color="#fff" size="small" />
                              : <Text style={s.acceptBtnText}>✅ Accepter</Text>
                            }
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[s.declineBtn, isProcessing && { opacity: 0.6 }]}
                            onPress={() => handleDecline(inv)}
                            disabled={isProcessing}
                            activeOpacity={0.85}
                          >
                            <Text style={s.declineBtnText}>❌ Refuser</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  container: {
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    overflow: 'hidden',
    maxHeight: '85%',
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
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },

  /* Empty */
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: 15, color: Colors.textSecondary },

  /* Friend request */
  friendReqCard: {
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
  friendReqInfo: { flex: 1 },
  friendReqName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  friendReqSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  friendReqBtns: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  acceptFriendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineFriendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Trip invitation card */
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  cover: {
    width: '100%',
    height: 130,
  },
  coverFallback: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmoji: { fontSize: 40 },
  cardContent: {
    padding: Spacing.md,
    gap: 4,
  },
  tripName: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  destination: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  dates: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  btnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  declineBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.full,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  declineBtnText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
});
