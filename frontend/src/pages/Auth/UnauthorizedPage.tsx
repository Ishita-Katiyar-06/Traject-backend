import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { useAuth } from '../../auth';
import { useRole } from '../../contexts/RoleContext';

export const UnauthorizedPage: React.FC = () => {
  const { user } = useAuth();
  const { role } = useRole();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white/80 dark:bg-[#111620]/90 backdrop-blur-xl border border-rose-500/30 dark:border-rose-500/30 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Ambient warning radial glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="font-mono text-xs text-rose-500 tracking-wider font-semibold uppercase">
              SECURITY BOUNDARY // ACCESS FORBIDDEN (403)
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Institutional Clearance Required
            </h1>
          </div>
        </div>

        <div className="space-y-4 mb-8 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <p>
            The route you attempted to access is governed under the{' '}
            <strong className="text-slate-800 dark:text-slate-100">
              NTRO Operational Intelligence Mandate (SIH-26152)
            </strong>{' '}
            and requires verified Analyst clearance.
          </p>
          <div className="bg-slate-100 dark:bg-[#0A0D14] border border-slate-200 dark:border-slate-800 rounded-lg p-3 font-mono text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Session User:</span>
              <span className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                {user?.email || 'Anonymous / Unauthenticated'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Resolved Role:</span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold uppercase">
                {role || 'public_user'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Required Clearance:</span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold uppercase">
                ntro_analyst (Level-4)
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Public accounts are strictly granted read access to public trends and emerging trend
            forecasts. Forensic intelligence, coordination anomalies, and raw message records cannot
            be viewed with public privileges.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/trends"
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Explore Public Trends
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <Lock className="w-4 h-4 mr-2" />
            Sign In with Other Account
          </Link>
        </div>
      </div>
    </div>
  );
};
