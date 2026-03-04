import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';

/* ─── Sync profile ───────────────────────────────────────────── */
async function syncProfile(user: User) {
  const profileData = {
    id:         user.id,
    nickname:   user.user_metadata?.nickname || 'Voyageur',
    avatar_url: user.user_metadata?.avatar_url || null,
    email:      user.email,
  };

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (existing) {
    await supabase.from('profiles').update(profileData).eq('id', user.id);
  } else {
    await supabase.from('profiles').insert(profileData);
  }

  console.log('PROFILE SYNCED:', JSON.stringify(profileData));
}

/* ─── Types ──────────────────────────────────────────────────── */
interface AuthContextType {
  user:     User | null;
  session:  Session | null;
  loading:  boolean;
  signUp:   (email: string, password: string, nickname?: string) => Promise<void>;
  signIn:   (email: string, password: string) => Promise<void>;
  signOut:  () => Promise<void>;
}

/* ─── Context ────────────────────────────────────────────────── */
const AuthContext = createContext<AuthContextType>({
  user:    null,
  session: null,
  loading: true,
  signUp:  async () => {},
  signIn:  async () => {},
  signOut: async () => {},
});

/* ─── Provider ───────────────────────────────────────────────── */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const DEV_EMAIL    = process.env.EXPO_PUBLIC_DEV_EMAIL;
    const DEV_PASSWORD = process.env.EXPO_PUBLIC_DEV_PASSWORD;

    // Session existante au démarrage
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        setLoading(false);
      } else if (DEV_EMAIL && DEV_PASSWORD) {
        // Auto-login dev
        const { data, error } = await supabase.auth.signInWithPassword({
          email:    DEV_EMAIL,
          password: DEV_PASSWORD,
        });
        if (!error && data.session) {
          setSession(data.session);
          setUser(data.session.user);
        }
        setLoading(false);
      } else {
        setLoading(false);
      }
    });

    // Changements d'état auth en temps réel
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (_event === 'SIGNED_IN' && session?.user) {
          syncProfile(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, nickname?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: nickname ? { data: { nickname } } : undefined,
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
