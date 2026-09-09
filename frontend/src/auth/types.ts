import type { User, Session, AuthError } from '@supabase/supabase-js';

/**
 * Milestone 9A: Authentication State Definition.
 *
 * AuthContext tracks authentication/session status ONLY.
 * Authorization and trusted institutional roles are strictly deferred to Milestone 9B.
 * `role` is deliberately null/unknown in this milestone to prevent any client-side privilege assumption.
 */
export interface AuthState {
  /** The authenticated Supabase User object, or null if unauthenticated */
  user: User | null;
  /** Active Supabase session or null */
  session: Session | null;
  /** True while the initial session lookup / restore is in-flight */
  isLoading: boolean;
  /** True if VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present */
  isConfigured: boolean;
  /** Any active authentication error from sign-in, sign-up, or session refresh */
  error: AuthError | Error | null;
  /**
   * Strictly null in Milestone 9A.
   * Authorization roles must NEVER be user-controlled or derived from client state.
   * Trusted backend role verification is scheduled for Milestone 9B.
   */
  role: null;
}

export interface AuthContextValue extends AuthState {
  /** Sign in with email and password via Supabase Auth */
  signIn: (email: string, password: string) => Promise<{ error: AuthError | Error | null; user: User | null }>;
  /** Sign up with email and password ONLY (no role parameter allowed) */
  signUp: (email: string, password: string) => Promise<{ error: AuthError | Error | null; user: User | null }>;
  /** Terminate session and sign out */
  signOut: () => Promise<{ error: AuthError | Error | null }>;
  /** Manually request session refresh from Supabase */
  refreshSession: () => Promise<void>;
  /** Clear any displayed authentication error */
  clearError: () => void;
}
