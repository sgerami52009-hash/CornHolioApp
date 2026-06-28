import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthState {
  user: User | null;
  displayName: string | null;
  loading: boolean;
  setDisplayName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  displayName: null,
  loading: true,
  setDisplayName: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayNameState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      // Check for existing session
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        await loadDisplayName(session.user.id);
      } else {
        // Sign in anonymously
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error('Anonymous sign-in failed:', error);
        } else if (data.user) {
          setUser(data.user);
        }
      }
      setLoading(false);
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadDisplayName(userId: string) {
    const { data } = await supabase
      .from('organizers')
      .select('display_name')
      .eq('id', userId)
      .single();
    if (data) {
      setDisplayNameState(data.display_name);
    }
  }

  async function setDisplayName(name: string) {
    if (!user) {
      console.error('setDisplayName called but user is null');
      throw new Error('Not signed in');
    }
    const { error } = await supabase
      .from('organizers')
      .upsert({ id: user.id, display_name: name }, { onConflict: 'id' });
    if (error) throw error;
    setDisplayNameState(name);
  }

  return (
    <AuthContext.Provider value={{ user, displayName, loading, setDisplayName }}>
      {children}
    </AuthContext.Provider>
  );
}
