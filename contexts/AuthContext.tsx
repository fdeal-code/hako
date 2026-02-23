import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';

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
    // Session existante au démarrage
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Changements d'état auth en temps réel
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
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
