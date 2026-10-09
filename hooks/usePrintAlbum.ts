// HAKO — Hook Album imprimé : ma demande, celles du groupe, envoi

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { getPrintRequests, requestPrintAlbum } from '@/services/printAlbumService';
import { PrintAlbumRequest, PrintFormat } from '@/types/printAlbum';

export function usePrintAlbum(tripId: string | undefined) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [mine, setMine] = useState<PrintAlbumRequest | null>(null);
  const [groupCount, setGroupCount] = useState(0);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!tripId || !userId) return;
    const { data } = await getPrintRequests(tripId, userId);
    if (data) { setMine(data.mine); setGroupCount(data.groupCount); }
  }, [tripId, userId]);

  useEffect(() => {
    if (!tripId || !userId) return;
    void getPrintRequests(tripId, userId).then(({ data }) => {
      if (data) { setMine(data.mine); setGroupCount(data.groupCount); }
    });
  }, [tripId, userId]);

  const request = useCallback(async (format: PrintFormat, photoCount: number): Promise<string | null> => {
    if (!tripId || !userId) return 'Connecte-toi pour continuer.';
    setSending(true);
    const { error } = await requestPrintAlbum(tripId, userId, format, photoCount);
    setSending(false);
    if (error !== null) return error;
    await load();
    return null;
  }, [tripId, userId, load]);

  return { mine, groupCount, sending, request };
}
