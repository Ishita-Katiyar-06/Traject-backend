import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { AuthContextValue } from './types';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<AuthError | Error | null>(null);

  // Clear authentication error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 1. Initial session hydration and active listener subscription
  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured || !supabase) {
      // Configuration missing: explicitly resolve as unauthenticated without fabricating sessions
      setIsLoading(false);
      return;
    }

    // Retrieve active session from Supabase client (authoritative source of truth)
    supabase.auth
      .getSession()
      .then(({ data: { session: activeSession }, error: sessionError }) => {
        if (!isMounted) return;
        if (sessionError) {
          setError(sessionError);
        } else {
          setSession(activeSession);
          setUser(activeSession?.user ?? null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    // Subscribe to continuous auth state events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Sign In (Email + Password ONLY)
  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: AuthError | Error | null; user: User | null }> => {
      setError(null);

      if (!isSupabaseConfigured || !supabase) {
        const notConfiguredError = new Error(
          'Supabase authentication is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
        );
        setError(notConfiguredError);
        return { error: notConfiguredError, user: null };
      }

      try {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          setError(signInError);
          return { error: signInError, user: null };
        }

        setSession(data.session);
        setUser(data.user);
        return { error: null, user: data.user };
      } catch (err) {
        const caught = err instanceof Error ? err : new Error(String(err));
        setError(caught);
        return { error: caught, user: null };
      }
    },
    []
  );

  // 3. Sign Up (Email + Password ONLY - NO role parameter accepted)
  const signUp = useCallback(
    async (email: string, password: string): Promise<{ error: AuthError | Error | null; user: User | null }> => {
      setError(null);

      if (!isSupabaseConfigured || !supabase) {
        const notConfiguredError = new Error(
          'Supabase authentication is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
        );
        setError(notConfiguredError);
        return { error: notConfiguredError, user: null };
      }

      try {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (signUpError) {
          setError(signUpError);
          return { error: signUpError, user: null };
        }

        // If auto-confirm is enabled or session is immediately returned:
        if (data.session) {
          setSession(data.session);
          setUser(data.user);
        }

        return { error: null, user: data.user };
      } catch (err) {
        const caught = err instanceof Error ? err : new Error(String(err));
        setError(caught);
        return { error: caught, user: null };
      }
    },
    []
  );

  // 4. Sign Out
  const signOut = useCallback(async (): Promise<{ error: AuthError | Error | null }> => {
    setError(null);

    if (!isSupabaseConfigured || !supabase) {
      setUser(null);
      setSession(null);
      return { error: null };
    }

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError(signOutError);
        return { error: signOutError };
      }

      setUser(null);
      setSession(null);
      return { error: null };
    } catch (err) {
      const caught = err instanceof Error ? err : new Error(String(err));
      setError(caught);
      return { error: caught };
    }
  }, []);

  // 5. Manual session refresh
  const refreshSession = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        setError(refreshError);
      } else if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoading,
      isConfigured: isSupabaseConfigured,
      error,
      // Strictly null in 9A to prevent any client-side privilege assumption:
      role: null,
      signIn,
      signUp,
      signOut,
      refreshSession,
      clearError,
    }),
    [user, session, isLoading, error, signIn, signUp, signOut, refreshSession, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
