// HAKO — Règle de validation des envies (fonction pure)
// Spec docs/FEATURES.md → « Envies, votes… » :
//  - Validée  : la majorité des membres est partante
//  - Écartée  : la majorité des membres n'est pas partante (status 'archived')
//  - En débat : des votes, mais pas encore de majorité
//  - À voter  : aucun vote
// Avant : un seul « pour » sans « contre » suffisait à valider.

export type WishVoteValue = 'up' | 'down';
export type ComputedWishStatus = 'pending' | 'debate' | 'validated' | 'archived';

/** Nombre de voix nécessaires pour une majorité (4 membres → 3, 3 → 2, 1 → 1). */
export function majorityThreshold(memberCount: number): number {
  return Math.floor(Math.max(1, memberCount) / 2) + 1;
}

export function computeWishStatus(
  votes: readonly { vote: WishVoteValue }[],
  memberCount: number,
): ComputedWishStatus {
  const ups = votes.filter(v => v.vote === 'up').length;
  const downs = votes.filter(v => v.vote === 'down').length;
  const threshold = majorityThreshold(memberCount);
  if (ups >= threshold) return 'validated';
  if (downs >= threshold) return 'archived';
  if (ups === 0 && downs === 0) return 'pending';
  return 'debate';
}

/** Envies encore ouvertes au vote (À voter, En débat) où `userId` n'a pas voté. */
export function countUnvoted(
  wishes: readonly { status: string; wish_votes: readonly { user_id: string }[] | null }[],
  userId: string,
): number {
  return wishes.filter(w =>
    (w.status === 'pending' || w.status === 'debate')
    && !(w.wish_votes ?? []).some(v => v.user_id === userId),
  ).length;
}
