import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn, AlertCircle, CheckCircle2, ArrowRight, Shield, Info, Lock } from 'lucide-react';
import { useAuth } from '../../auth';
import { useRole } from '../../contexts/RoleContext';

export const LoginPage: React.FC = () => {
  const { signIn, user, isLoading, isConfigured, error, clearError, signOut } = useAuth();
  const { isNtroAnalyst } = useRole();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email.trim() || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: signInError, user: signedInUser } = await signIn(email, password);
      if (signInError) {
        setLocalError(signInError.message || 'Failed to sign in. Please verify your credentials.');
      } else {
        const appMetaRole = (signedInUser?.app_metadata as Record<string, unknown> | undefined)?.role;
        const rawWhitelist = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_NTRO_ANALYST_EMAILS || 'analyst@ntro.gov.in,admin@ntro.gov.in';
        const whitelist = rawWhitelist.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
        const isAnalyst = appMetaRole === 'ntro_analyst' || (signedInUser?.email && whitelist.includes(signedInUser.email.toLowerCase()));

        const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;
        if (from) {
          navigate(from, { replace: true });
        } else if (isAnalyst) {
          navigate('/console/overview', { replace: true });
        } else {
          navigate('/trends', { replace: true });
        }
      }
    } catch (err: any) {
      setLocalError(err?.message || 'An unexpected error occurred during sign-in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // State 1: Initializing auth state
  if (isLoading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-6 select-none font-sans">
        <div className="w-8 h-8 border-2 border-[#2F65F6] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-[13px] text-slate-500 font-mono">Initializing authentication...</p>
      </div>
    );
  }

  // State 2: Already authenticated
  if (user) {
    return (
      <div className="w-full min-h-[70vh] flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white dark:bg-[#181D24] border border-slate-200/90 dark:border-[#2B323D] rounded-3xl p-7 shadow-xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-slate-900 dark:text-white">Already Signed In</h2>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">Active Supabase session</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#12161C] border border-slate-100 dark:border-slate-800 text-[13px] text-slate-700 dark:text-slate-300">
            <div className="text-[11px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
              Authenticated Account
            </div>
            <div className="font-mono font-semibold text-[#2F65F6] truncate">{user.email}</div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(isNtroAnalyst ? '/console/overview' : '/trends')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#2F65F6] hover:bg-[#2452D6] text-white font-medium text-[13px] transition-all shadow-sm cursor-pointer"
            >
              <span>{isNtroAnalyst ? 'Go to NTRO Console' : 'Explore Public Trends'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#20262E] dark:hover:bg-[#28303B] text-slate-700 dark:text-slate-200 font-medium text-[13px] transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State 3 & 4: Unauthenticated / Configuration notice / Login Form
  return (
    <div className="w-full min-h-[75vh] flex items-center justify-center p-4 font-sans select-none">
      <div className="w-full max-w-md bg-white dark:bg-[#181D24] border border-slate-200/90 dark:border-[#2B323D] rounded-3xl p-7 shadow-xl space-y-6">
        {/* Header */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 text-[11px] font-mono font-semibold text-blue-700 dark:text-blue-300 mb-1">
            <Lock className="w-3 h-3" />
            <span>Supabase Authentication</span>
          </div>
          <h1 className="text-[22px] font-brand font-bold text-slate-900 dark:text-white tracking-tight">
            Sign In to TRAJECT
          </h1>
          <p className="text-[13px] text-slate-500 dark:text-slate-400">
            Authenticate using your registered email and password credentials.
          </p>
        </div>

        {/* Missing configuration banner (Phase 7 safeguard) */}
        {!isConfigured && (
          <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 space-y-1.5 text-[12px] text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-1.5 font-bold">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Supabase Not Configured</span>
            </div>
            <p className="leading-snug text-[11.5px] text-amber-800 dark:text-amber-300">
              <code className="font-mono font-bold">VITE_SUPABASE_URL</code> or{' '}
              <code className="font-mono font-bold">VITE_SUPABASE_ANON_KEY</code> is not set. The platform runs in
              unauthenticated preview mode. Missing credentials do not grant NTRO privileges.
            </p>
          </div>
        )}

        {/* Error notification */}
        {(localError || error) && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2 text-[12px] text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <span className="leading-snug">{localError || error?.message}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-[12px] font-semibold text-slate-700 dark:text-slate-300 font-sans"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="analyst@domain.com"
              disabled={isSubmitting || !isConfigured}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#333C48] bg-slate-50/50 dark:bg-[#12161C] text-slate-900 dark:text-white placeholder:text-slate-400 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2F65F6]/30 focus:border-[#2F65F6] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-[12px] font-semibold text-slate-700 dark:text-slate-300 font-sans"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              disabled={isSubmitting || !isConfigured}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#333C48] bg-slate-50/50 dark:bg-[#12161C] text-slate-900 dark:text-white placeholder:text-slate-400 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2F65F6]/30 focus:border-[#2F65F6] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !isConfigured}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#2F65F6] hover:bg-[#2452D6] active:scale-[0.99] text-white font-medium text-[13px] shadow-sm hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        {/* Footer info & Navigation */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center space-y-2">
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="text-[#2F65F6] dark:text-blue-400 font-semibold hover:underline"
            >
              Sign Up
            </Link>
          </p>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            <Shield className="w-3 h-3" />
            <span>Milestone 9A: Authentication foundation only. Role authorization deferred to 9B.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
