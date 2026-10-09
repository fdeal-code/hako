// HAKO — Cover d'une proposition : photo Unsplash de la destination,
// gradient en fallback (pas de clé, pas de résultat, erreur, chargement).
// Overlay sombre en bas pour la lisibilité + attribution photographe
// (guidelines Unsplash : nom + liens avec UTM).

import { ImageBackground, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors, Radii, Spacing } from '@/constants/theme';
import { DestinationPhoto, UNSPLASH_HOME_URL } from '@/services/unsplashService';
import { MatchProposal } from '@/types/tripMatch';

const OVERLAY_GRADIENT: readonly [string, string] = ['transparent', 'rgba(0,0,0,0.65)'];

interface ProposalCoverProps {
  proposal: MatchProposal;
  gradient: readonly [string, string];
  photo: DestinationPhoto | null;
}

function CoverContent({ proposal }: { proposal: MatchProposal }) {
  return (
    <>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Match {proposal.match_score}%</Text>
      </View>
      <Text style={styles.destination}>{proposal.destination}</Text>
      <Text style={styles.country}>{proposal.country_code}</Text>
    </>
  );
}

export function ProposalCover({ proposal, gradient, photo }: ProposalCoverProps) {
  if (!photo) {
    return (
      <LinearGradient colors={gradient} style={styles.cover}>
        <CoverContent proposal={proposal} />
      </LinearGradient>
    );
  }

  return (
    <ImageBackground source={{ uri: photo.url }} style={styles.cover}>
      <LinearGradient colors={OVERLAY_GRADIENT} style={StyleSheet.absoluteFill} />
      <CoverContent proposal={proposal} />
      <View style={styles.attribution}>
        <TouchableOpacity onPress={() => { void Linking.openURL(photo.photographerUrl); }} activeOpacity={0.7}>
          <Text style={styles.attributionText}>Photo : {photo.photographerName}</Text>
        </TouchableOpacity>
        <Text style={styles.attributionText}> · </Text>
        <TouchableOpacity onPress={() => { void Linking.openURL(UNSPLASH_HOME_URL); }} activeOpacity={0.7}>
          <Text style={styles.attributionText}>Unsplash</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  cover: {
    padding: Spacing.md,
    minHeight: 130,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: Spacing.sm2,
    right: Spacing.sm2,
    backgroundColor: Colors.surface,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.sm2,
    paddingVertical: Spacing.xs,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  destination: { fontSize: 26, fontWeight: '900', color: Colors.textInverted },
  country: { fontSize: 13, fontWeight: '600', color: Colors.borderLight },
  attribution: {
    position: 'absolute',
    bottom: Spacing.xs,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  attributionText: { fontSize: 10, fontWeight: '500', color: Colors.textTertiary },
});
