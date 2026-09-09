/**
 * Milestone 9A: Supabase Browser Client Initialization
 *
 * Implements the browser client using the official @supabase/supabase-js library.
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from frontend environment variables.
 *
 * SECURITY CONTRACT:
 * - Only the public Anon key is utilized.
 * - NEVER include or reference a Supabase service-role key in frontend code.
 * - If credentials are not configured, handles gracefully without fabricating user sessions or NTRO roles.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = (import.meta as unknown as { env?: Record<string, string> }).env;
const rawUrl = env?.VITE_SUPABASE_URL?.trim();
const rawAnonKey = env?.VITE_SUPABASE_ANON_KEY?.trim();

const isPlaceholder = (val?: string): boolean => {
  if (!val) return true;
  const lower = val.toLowerCase();
  return (
    lower === '' ||
    lower.includes('your_supabase') ||
    lower.includes('placeholder') ||
    lower.includes('example.com')
  );
};

export const isSupabaseConfigured: boolean =
  Boolean(rawUrl && rawAnonKey && !isPlaceholder(rawUrl) && !isPlaceholder(rawAnonKey));

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawUrl as string, rawAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const getSupabaseClient = (): SupabaseClient | null => supabase;
