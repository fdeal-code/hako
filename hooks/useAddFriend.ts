// HAKO — Hook « Ajouter un ami » (app/account/add-friend.tsx)
// Recherche par e-mail, puis envoi de la demande d'ami.

import { useCallback, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { FoundProfile, findProfileByEmail, sendFriendRequest } from '@/services/friendService';
import { isValidEmail } from '@/utils/authValidation';

export type SearchState = 'idle' | 'searching' | 'found' | 'missing';

export function useAddFriend() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? '';
  const myEmail = (session?.user?.email ?? '').toLowerCase();
  const [email, setEmailRaw] = useState('');
  const [state, setState] = useState<SearchState>('idle');
  const [found, setFound] = useState<FoundProfile | null>(null);
  const [sending, setSending] = useState(false);

  const setEmail = useCallback((value: string) => { setEmailRaw(value); setState('idle'); setFound(null); }, []);

  const search = useCallback(async (): Promise<string | null> => {
    const cleaned = email.trim().toLowerCase();
    if (!isValidEmail(cleaned)) return 'Entre une adresse e-mail valide.';
    if (cleaned === myEmail) return 'C’est ton adresse ! Entre celle d’un ami.';
    setState('searching');
    const { data, error } = await findProfileByEmail(userId, cleaned);
    if (error !== null) { setState('idle'); return error; }
    setFound(data);
    setState(data ? 'found' : 'missing');
    return null;
  }, [email, myEmail, userId]);

  const send = useCallback(async (): Promise<string | null> => {
    if (!found) return null;
    setSending(true);
    const { error } = await sendFriendRequest(userId, found.id);
    setSending(false);
    if (error !== null) return error;
    setFound({ ...found, link: 'pending' });
    return null;
  }, [found, userId]);

  return { email, setEmail, state, found, sending, search, send, canSearch: isValidEmail(email) };
}
