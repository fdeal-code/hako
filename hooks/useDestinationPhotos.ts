// HAKO — Photos Unsplash des propositions (Trip Match)
// Fetch quand les propositions arrivent ; le cache module du service
// garantit une seule requête par destination malgré les refreshs Realtime.

import { useEffect, useState } from 'react';

import { DestinationPhoto, searchDestinationPhoto } from '@/services/unsplashService';
import { MatchProposal } from '@/types/tripMatch';

export type ProposalPhotos = Record<string, DestinationPhoto | null>;

export function useDestinationPhotos(proposals: readonly MatchProposal[]): ProposalPhotos {
  const [photos, setPhotos] = useState<ProposalPhotos>({});

  useEffect(() => {
    if (proposals.length === 0) return;
    let cancelled = false;
    void Promise.all(
      proposals.map(async p => [p.id, await searchDestinationPhoto(p.destination)] as const),
    ).then(entries => {
      if (!cancelled) setPhotos(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [proposals]);

  return photos;
}
