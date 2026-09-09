import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, AlertCircle, CheckCircle2, ArrowRight, Shield, Info, Lock } from 'lucide-react';
import { useAuth } from '../../auth';

export const SignupPage: React.FC = () => {
  const { signUp, user, isLoading, isConfigured, error, clearError } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessNotice(null);
    clearError();

    if (!email.trim() || !password) {
      setLocalError('Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Strictly passes email and password ONLY. No role parameter exists.
      const { error: signUpError, user: newUser } = await signUp(email, password);
      if (signUpError) {
        setLocalError(signUpError.message || 'Failed to create account.');
      } else {
        setSuccessNotice(
          'Account created successfully! If email confirmation is enabled on your Supabase instance, please check your inbox.'
        );
        if (newUser) {
          setTimeout(() => navigate('/trends'), 2000);
        }
      }
    } catch (err: any) {
      setLocalError(err?.message || 'An unexpected error occurred during account creation.');
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
              <h2 className="text-[17px] font-bold text-slate-900 dark:text-white">Already Authenticated</h2>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">Signed in as {user.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/trends')}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#2F65F6] hover:bg-[#2452D6] text-white font-medium text-[13px] transition-all shadow-sm cursor-pointer"
          >
            <span>Continue to Public Trends</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[75vh] flex items-center justify-center p-4 font-sans select-none">
      <div className="w-full max-w-md bg-white dark:bg-[#181D24] border border-slate-200/90 dark:border-[#2B323D] rounded-3xl p-7 shadow-xl space-y-6">
        {/* Header */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 text-[11px] font-mono font-semibold text-blue-700 dark:text-blue-300 mb-1">
            <Lock className="w-3 h-3" />
            <span>Supabase Registration</span>
          </div>
          <h1 className="text-[22px] font-brand font-bold text-slate-900 dark:text-white tracking-tight">
            Create Account
          </h1>
          <p className="text-[13px] text-slate-500 dark:text-slate-400">
            Register a standard user account using email and password.
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
              <code className="font-mono font-bold">VITE_SUPABASE_ANON_KEY</code> is not set in your environment.
              Signup requires active Supabase credentials.
            </p>
          </div>
        )}

        {/* Success notification */}
        {successNotice && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2 text-[12px] text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <span className="leading-snug">{successNotice}</span>
          </div>
        )}

        {/* Error notification */}
        {(localError || error) && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2 text-[12px] text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <span className="leading-snug">{localError || error?.message}</span>
          </div>
        )}

        {/* Form (Email + Password ONLY) */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="signup-email"
              className="block text-[12px] font-semibold text-slate-700 dark:text-slate-300 font-sans"
            >
              Email Address
            </label>
            <input
              id="signup-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@domain.com"
              disabled={isSubmitting || !isConfigured}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#333C48] bg-slate-50/50 dark:bg-[#12161C] text-slate-900 dark:text-white placeholder:text-slate-400 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2F65F6]/30 focus:border-[#2F65F6] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="signup-password"
              className="block text-[12px] font-semibold text-slate-700 dark:text-slate-300 font-sans"
            >
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              disabled={isSubmitting || !isConfigured}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#333C48] bg-slate-50/50 dark:bg-[#12161C] text-slate-900 dark:text-white placeholder:text-slate-400 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2F65F6]/30 focus:border-[#2F65F6] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="signup-confirm-password"
              className="block text-[12px] font-semibold text-slate-700 dark:text-slate-300 font-sans"
            >
              Confirm Password
            </label>
            <input
              id="signup-confirm-password"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
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
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create Account</span>
              </>
            )}
          </button>
        </form>

        {/* Footer info & Security Disclosure */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center space-y-2">
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            Already registered?{' '}
            <Link
              to="/login"
              className="text-[#2F65F6] dark:text-blue-400 font-semibold hover:underline"
            >
              Sign In
            </Link>
          </p>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            <Shield className="w-3 h-3" />
            <span>Role authorization is strictly deferred to 9B. Signup cannot specify or claim roles.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
