import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, ArrowRight } from 'lucide-react';
import { useLiveStream } from '../../contexts/LiveStreamContext';

export const LiveAlertToast: React.FC = () => {
  const { liveAlerts, dismissLiveAlert } = useLiveStream();

  // Auto-dismiss the oldest live alert after 8 seconds
  useEffect(() => {
    if (liveAlerts.length > 0) {
      const topAlert = liveAlerts[0];
      const timer = setTimeout(() => {
        dismissLiveAlert(topAlert.id);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [liveAlerts, dismissLiveAlert]);

  if (liveAlerts.length === 0) {
    return null;
  }

  // Display the most recent active live alert
  const alert = liveAlerts[0];

  return (
    <div className="fixed top-20 right-6 z-[70] max-w-sm w-full animate-in fade-in slide-in-from-top-4 duration-200">
      <div className="p-4 rounded-[20px] bg-white dark:bg-[#13171C] border-2 border-rose-500/80 shadow-2xl space-y-2.5 font-sans">
        {/* Header: Severity & Dismiss */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600" />
            </span>
            <span className="font-mono text-[11px] font-bold uppercase text-rose-700 dark:text-rose-400">
              {alert.severity} LIVE ALERT
            </span>
          </div>

          <button
            type="button"
            onClick={() => dismissLiveAlert(alert.id)}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Dismiss alert toast"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Title & Headline Claim */}
        <div>
          <h4 className="text-[13px] font-bold text-[#111727] dark:text-[#F8FAFC] leading-snug">
            {alert.title}
          </h4>
          <p className="text-[12px] text-[#475569] dark:text-[#94A3B8] line-clamp-2 mt-0.5">
            {alert.claim}
          </p>
        </div>

        {/* Telemetry Indicator Tags */}
        <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40">
            Score: {alert.priority_score.toFixed(3)}
          </span>
          {alert.indicators.slice(0, 1).map((ind, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate max-w-[180px]"
            >
              {ind}
            </span>
          ))}
        </div>

        {/* Action Button */}
        <div className="pt-1 flex items-center justify-end">
          <Link
            to="/alerts"
            onClick={() => dismissLiveAlert(alert.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#2F65F6] hover:bg-[#2554D4] text-white text-[11px] font-semibold font-sans shadow-xs transition-colors"
          >
            <span>Triage in Alerts</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};
