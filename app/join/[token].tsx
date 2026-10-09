// HAKO — Invitation reçue (lien WhatsApp) : l'écran d'acquisition clé
// Visible AVANT la création de compte : cover, qui invite, dates, budget,
// membres déjà dedans. « Rejoindre » → connexion si besoin → voyage.
// Spec : docs/FEATURES.md → « Accueil & invitation ».

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { getInvitePreview, joinTripWithToken } from '@/services/inviteLinkService';
import { InvitePreview } from '@/types/invite';
import { savePendingInvite } from '@/utils/pendingInvite';
import { nightsBetween } from '@/utils/tripStops';

const HERO_HEIGHT = 300;
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function shortDay(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${d ?? ''} ${MONTHS_SHORT[(m ?? 1) - 1] ?? ''}`;
}

function membersLine(preview: InvitePreview): string {
  const names = preview.member_names;
  const others = preview.member_count - names.length;
  if (names.length === 0) return 'Sois le premier à rejoindre';
  const shown = names.join(', ');
  return others > 0 ? `${shown} et ${others} autre${others > 1 ? 's' : ''} y sont déjà` : `${shown} y ${names.length > 1 ? 'sont' : 'est'} déjà`;
}

export default function JoinTripScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void getInvitePreview(token).then(({ data }) => {
      if (cancelled) return;
      setPreview(data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [token, session?.user?.id]);

  const handleJoin = async () => {
    if (!token || !preview) return;
    if (preview.already_member) {
      router.replace(`/trip/${preview.trip_id}/dashboard`);
      return;
    }
    if (!session) {
      await savePendingInvite(token);
      router.push('/(auth)/login');
      return;
    }
    setJoining(true);
    const { data: tripId, error } = await joinTripWithToken(token);
    setJoining(false);
    if (error !== null) { Alert.alert('Oups', error); return; }
    router.replace(`/trip/${tripId}/dashboard`);
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!preview) {
    return (
      <View style={[styles.root, styles.center, { padding: Spacing.lg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="link-outline" size={40} color={Colors.textTertiary} />
        <Text style={styles.invalidTitle}>Lien expiré</Text>
        <Text style={styles.invalidSub}>Demande un nouveau lien à la personne qui t’a invité.</Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.secondaryText}>Retour à l’accueil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const nights = preview.start_date && preview.end_date ? nightsBetween(preview.start_date, preview.end_date) : null;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Hero */}
      <View style={styles.hero}>
        {preview.cover_image_url
          ? <Image source={{ uri: preview.cover_image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.primary }]} />}
        <View style={styles.heroDim} />
        <View style={[styles.heroContent, { paddingTop: insets.top + Spacing.md }]}>
          <Text style={styles.heroTitle} adjustsFontSizeToFit numberOfLines={1}>
            {preview.destination.toUpperCase()}
          </Text>
          <View style={styles.inviterPill}>
            <Text style={styles.inviterText}>{preview.inviter} t’invite</Text>
          </View>
        </View>
      </View>

      {/* Contenu */}
      <View style={styles.sheet}>
        <Text style={styles.title}>{preview.name}</Text>
        <Text style={styles.subtitle}>{preview.destination}</Text>

        <View style={styles.boxes}>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>QUAND</Text>
            <Text style={styles.boxValue}>
              {preview.start_date && preview.end_date
                ? `${shortDay(preview.start_date)} → ${shortDay(preview.end_date)}`
                : 'À définir'}
            </Text>
            {nights !== null && <Text style={styles.boxSub}>{nights} nuit{nights > 1 ? 's' : ''}</Text>}
          </View>
          <View style={[styles.box, styles.boxDark]}>
            <Text style={[styles.boxLabel, styles.onDark]}>BUDGET</Text>
            <Text style={[styles.boxValue, styles.onDark]}>
              {preview.budget_per_person ? `≈ ${preview.budget_per_person} €` : 'Libre'}
            </Text>
            <Text style={styles.boxSubAccent}>par personne</Text>
          </View>
        </View>

        <View style={styles.members}>
          <Ionicons name="people" size={20} color={Colors.textPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.membersTitle}>{membersLine(preview)}</Text>
            {preview.wish_count > 0 && (
              <Text style={styles.membersSub}>
                {preview.wish_count} envie{preview.wish_count > 1 ? 's' : ''} déjà proposée{preview.wish_count > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>

        {!session && (
          <Text style={styles.note}>Pas encore de compte ? Inscription en 30 secondes.</Text>
        )}

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={[styles.cta, { marginBottom: Math.max(insets.bottom, Spacing.md) }]}
          onPress={() => { void handleJoin(); }}
          disabled={joining}
          activeOpacity={0.85}
        >
          {joining
            ? <ActivityIndicator color={Colors.textInverted} />
            : (
              <>
                <Ionicons name={preview.already_member ? 'arrow-forward' : 'add'} size={20} color={Colors.textInverted} />
                <Text style={styles.ctaText}>
                  {preview.already_member ? 'Ouvrir le voyage' : 'Rejoindre le voyage'}
                </Text>
              </>
            )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceAlt },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.sm2 },
  hero: { height: HERO_HEIGHT, overflow: 'hidden' },
  heroDim: { ...StyleSheet.absoluteFill, backgroundColor: Colors.overlay },
  heroContent: { flex: 1, paddingHorizontal: Spacing.md2, justifyContent: 'space-between', paddingBottom: Spacing.xl },
  heroTitle: { ...Typography.titleHero, color: Colors.textInverted, opacity: 0.9 },
  inviterPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm2,
    borderRadius: Radii.full,
    backgroundColor: Colors.background,
  },
  inviterText: { ...Typography.filter, fontWeight: '700', color: Colors.textPrimary },
  sheet: {
    flex: 1,
    marginTop: -Spacing.lg,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.md2,
    gap: Spacing.md,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    backgroundColor: Colors.surfaceAlt,
  },
  title: { ...Typography.titlePage, color: Colors.textPrimary },
  subtitle: { ...Typography.body, color: Colors.textSecondary, marginTop: -Spacing.sm },
  boxes: { flexDirection: 'row', gap: Spacing.sm2 },
  box: {
    flex: 1,
    gap: 2,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    backgroundColor: Colors.background,
  },
  boxDark: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  boxLabel: { ...Typography.bodySmall, fontWeight: '800', color: Colors.textPrimary },
  boxValue: { ...Typography.section, color: Colors.textPrimary, marginTop: Spacing.sm },
  boxSub: { ...Typography.bodySmall, color: Colors.textSecondary },
  boxSubAccent: { ...Typography.bodySmall, color: Colors.accent },
  onDark: { color: Colors.textInverted },
  members: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm2,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    ...Shadows.sm,
  },
  membersTitle: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
  membersSub: { ...Typography.bodySmall, color: Colors.accent },
  note: { ...Typography.bodySmall, color: Colors.textSecondary },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 56,
    borderRadius: Radii.full,
    backgroundColor: Colors.accent,
    ...Shadows.lg,
  },
  ctaText: { ...Typography.body, fontWeight: '700', color: Colors.textInverted },
  invalidTitle: { ...Typography.section, color: Colors.textPrimary },
  invalidSub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  secondaryBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm2,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondaryText: { ...Typography.filter, fontWeight: '700', color: Colors.textPrimary },
});
