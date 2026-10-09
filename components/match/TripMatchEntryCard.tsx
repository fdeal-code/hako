// HAKO — Point d'entrée Trip Match (Home)
// Aucun match en cours → écran de création. Match en cours → reprise
// avec libellé de statut, routé vers le bon écran du flow.

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors, Radii, Shadows, Spacing } from '@/constants/theme';
import { useMyMatches } from '@/hooks/useMyMatches';
import { MatchStatus, TripMatch } from '@/types/tripMatch';

const CARD_GRADIENT: readonly [string, string] = ['#2E2C4A', '#1c1c1c'];
const PITCH = 'Pas d’inspi ? Répondez à 6 questions, l’IA trouve où partir.';

const STATUS_LABELS: Record<MatchStatus, string> = {
  collecting: 'Questionnaire en cours — à toi de jouer !',
  proposing:  'L’IA prépare vos destinations…',
  voting:     'Les propositions sont là — votez !',
  completed:  'Match terminé',
};

function routeForMatch(match: TripMatch): Href {
  switch (match.status) {
    case 'collecting': return `/match/${match.id}/questionnaire`;
    case 'proposing':  return `/match/${match.id}/waiting`;
    case 'voting':     return `/match/${match.id}/reveal`;
    // Filtré en amont — si un match complété passe malgré tout (liste
    // périmée), proposals affiche l'état final, jamais une reprise.
    case 'completed':  return `/match/${match.id}/proposals`;
  }
}

export function TripMatchEntryCard() {
  const { matches, loading } = useMyMatches();

  // Ceinture + bretelles : le service exclut déjà 'completed', mais la
  // liste peut être périmée entre deux focus → on re-filtre localement.
  const current = matches.find(m => m.status !== 'completed') ?? null;
  if (loading && !current) return null;

  const handlePress = () => {
    router.push(current ? routeForMatch(current) : '/match/create');
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
      <LinearGradient colors={CARD_GRADIENT} style={styles.card}>
        <View style={styles.iconBox}>
          <Ionicons name="sparkles" size={20} color={Colors.textInverted} />
        </View>
        <View style={styles.textBox}>
          <Text style={styles.title}>Trip Match</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {current ? STATUS_LABELS[current.status] : PITCH}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm2,
    borderRadius: Radii.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: Radii.full,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBox: { flex: 1, gap: Spacing.xs },
  title: { fontSize: 16, fontWeight: '800', color: Colors.textInverted },
  subtitle: { fontSize: 13, fontWeight: '500', color: Colors.textTertiary },
});
