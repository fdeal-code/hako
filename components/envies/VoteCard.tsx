// HAKO — Envies : carte de vote (maquette « Envies · À voter »)
// Photo + type/ville + prix, avatars avec leur vote, barre de progression,
// et les deux boutons Bof / Partant ! directement sur la carte.

import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Motion, Fonts, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';

export type VoteValue = 'up' | 'down';

export interface VoteCardMember {
  user_id: string;
  nickname: string | null;
  avatar_url: string | null;
}

interface VoteCardProps {
  title: string;
  imageUri: string | null;
  tag: string;
  isVideo?: boolean;
  priceLabel?: string | null;
  votes: readonly { user_id: string; vote: VoteValue }[];
  members: readonly VoteCardMember[];
  currentUserId: string;
  onVote: (vote: VoteValue) => void;
  onPress: () => void;
}

const PHOTO_HEIGHT = 118;
const AVATAR = 28;
const DOT = 14;
const SEGMENT_HEIGHT = 5;

export function VoteCard({
  title, imageUri, tag, isVideo = false, priceLabel, votes, members, currentUserId, onVote, onPress,
}: VoteCardProps) {
  const voteOf = (userId: string) => votes.find(v => v.user_id === userId)?.vote ?? null;
  const yes = votes.filter(v => v.vote === 'up').length;
  const no = votes.filter(v => v.vote === 'down').length;
  const waiting = Math.max(0, members.length - yes - no);
  const myVote = voteOf(currentUserId);
  const ordered = [...members].sort((a, b) => {
    const rank = (v: VoteValue | null) => (v === 'up' ? 0 : v === 'down' ? 1 : 2);
    return rank(voteOf(a.user_id)) - rank(voteOf(b.user_id));
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      <View style={styles.photo}>
        {imageUri
          ? <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, styles.photoEmpty]} />}
        <View style={styles.photoDim} />
        <View style={styles.photoTop}>
          <View style={[styles.tag, isVideo && styles.tagDark]}>
            {isVideo && <Ionicons name="logo-tiktok" size={12} color={Colors.textInverted} />}
            <Text style={[styles.tagText, isVideo && styles.tagTextDark]} numberOfLines={1}>{tag}</Text>
          </View>
          {priceLabel ? (
            <View style={styles.price}>
              <Text style={styles.priceText}>{priceLabel}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {isVideo && (
          <View style={styles.play}>
            <Ionicons name="play" size={18} color={Colors.textPrimary} />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.statusRow}>
          <View style={styles.avatars}>
            {ordered.slice(0, 5).map((m, i) => {
              const v = voteOf(m.user_id);
              return (
                <View key={m.user_id} style={[styles.avatarWrap, i > 0 && styles.avatarOverlap]}>
                  {v === null ? (
                    <View style={[styles.avatar, styles.avatarPending]}>
                      <Text style={styles.avatarPendingText}>?</Text>
                    </View>
                  ) : m.avatar_url ? (
                    <Image source={{ uri: m.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarInitial]}>
                      <Text style={styles.avatarInitialText}>{(m.nickname ?? '?')[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  {v !== null && (
                    <View style={[styles.dot, { backgroundColor: v === 'up' ? Colors.accent : Colors.primary }]}>
                      <Ionicons name={v === 'up' ? 'checkmark' : 'close'} size={9} color={Colors.textInverted} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          <View style={styles.statusText}>
            <Text style={styles.count} numberOfLines={1}>
              {yes} partant{yes > 1 ? 's' : ''}{no > 0 ? ` · ${no} bof` : ''} · {waiting} en attente
            </Text>
            <View style={styles.segments}>
              {Array.from({ length: Math.max(members.length, 1) }, (_, i) => (
                <View
                  key={i}
                  style={[styles.segment, {
                    backgroundColor: i < yes ? Colors.accent : i < yes + no ? Colors.primary : Colors.line,
                  }]}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.buttons}>
          <AnimatedPressable
            style={[styles.btn, styles.btnGhost, myVote === 'down' && styles.btnGhostOn]}
            onPress={() => onVote('down')}
            scaleTo={Motion.pressScaleSmall}
            haptic="light"
            accessibilityRole="button"
            accessibilityState={{ selected: myVote === 'down' }}
          >
            {/* Le pouce « saute » quand on vient de voter */}
            <Animated.View key={`down-${myVote === 'down'}`} entering={myVote === 'down' ? ZoomIn.springify() : undefined}>
              <Ionicons name="thumbs-down-outline" size={18} color={myVote === 'down' ? Colors.textInverted : Colors.textPrimary} />
            </Animated.View>
            <Text style={[styles.btnText, myVote === 'down' && styles.btnTextOn]}>Bof</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.btn, styles.btnAccent, myVote === 'up' && styles.btnAccentOn]}
            onPress={() => onVote('up')}
            scaleTo={Motion.pressScaleSmall}
            haptic={myVote === 'up' ? 'light' : 'success'}
            accessibilityRole="button"
            accessibilityState={{ selected: myVote === 'up' }}
          >
            <Animated.View key={`up-${myVote === 'up'}`} entering={myVote === 'up' ? ZoomIn.springify() : undefined}>
              <Ionicons name={myVote === 'up' ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color={Colors.textInverted} />
            </Animated.View>
            <Text style={[styles.btnText, styles.btnTextOn]}>Partant !</Text>
          </AnimatedPressable>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    ...Shadows.card,
  },
  photo: { height: PHOTO_HEIGHT, justifyContent: 'space-between', padding: Spacing.sm2 + 2 },
  photoEmpty: { backgroundColor: Colors.primary },
  photoDim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.32)' },
  photoTop: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    flexShrink: 1,
    paddingHorizontal: Spacing.sm2, paddingVertical: 6,
    borderRadius: Radii.full, backgroundColor: Colors.background,
  },
  tagDark: { backgroundColor: Colors.primary },
  tagText: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  tagTextDark: { color: Colors.textInverted },
  price: { paddingHorizontal: Spacing.sm2, paddingVertical: 6, borderRadius: Radii.full, backgroundColor: Colors.accent },
  priceText: { fontSize: 12, fontWeight: '600', color: Colors.textInverted },
  title: { fontFamily: Fonts.displayBold, fontSize: 22, color: Colors.textInverted, paddingRight: 48 },
  play: {
    position: 'absolute', right: Spacing.md, bottom: Spacing.md,
    width: 40, height: 40, borderRadius: Radii.full,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  body: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm2 + 2, paddingBottom: Spacing.md, gap: Spacing.sm2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2 - 2 },
  avatars: { flexDirection: 'row' },
  avatarWrap: { width: AVATAR, height: AVATAR },
  avatarOverlap: { marginLeft: -6 },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: Radii.full, borderWidth: 1.5, borderColor: Colors.white },
  avatarPending: { backgroundColor: Colors.background, borderColor: Colors.textMuted, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  avatarPendingText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  avatarInitial: { backgroundColor: Colors.line, alignItems: 'center', justifyContent: 'center' },
  avatarInitialText: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  dot: {
    position: 'absolute', right: -3, bottom: -3,
    width: DOT, height: DOT, borderRadius: Radii.full,
    borderWidth: 1.5, borderColor: Colors.white, alignItems: 'center', justifyContent: 'center',
  },
  statusText: { flex: 1, gap: Spacing.xs },
  count: { fontSize: 13, fontWeight: '600', color: Colors.textInk },
  segments: { flexDirection: 'row', gap: Spacing.xs },
  segment: { flex: 1, height: SEGMENT_HEIGHT, borderRadius: Radii.full },
  buttons: { flexDirection: 'row', gap: Spacing.sm2 - 2 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: Radii.full,
  },
  btnGhost: { borderWidth: 1, borderColor: Colors.primary },
  btnGhostOn: { backgroundColor: Colors.primary },
  btnAccent: { backgroundColor: Colors.accent, ...Shadows.md },
  btnAccentOn: { borderWidth: 2, borderColor: Colors.primary },
  btnText: { ...Typography.body, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  btnTextOn: { color: Colors.textInverted },
});
