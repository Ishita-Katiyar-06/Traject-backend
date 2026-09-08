import React from 'react';
import { Clock, CheckCircle2, AlertCircle, Database } from 'lucide-react';
import type { ForecastingStatusResponse, ForecastArtifactSummary } from '../../types/forecasting';
import { formatUtcDateTime } from '../../utils/forecastingFormatters';

interface ForecastingStatusBannerProps {
  status: ForecastingStatusResponse | null;
  artifactSummary?: ForecastArtifactSummary | null;
  isLoading?: boolean;
}

export const ForecastingStatusBanner: React.FC<ForecastingStatusBannerProps> = ({
  status,
  artifactSummary,
  isLoading,
}) => {
  if (isLoading && !status && !artifactSummary) {
    return (
      <div className="p-4 rounded-[18px] bg-slate-50 dark:bg-[#161B21] border border-slate-200/80 dark:border-[#252B32] animate-pulse">
        <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
        <div className="h-3 w-96 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
    );
  }

  const isAvailable = status?.artifact_available ?? (artifactSummary !== null);
  const cutoffTime = artifactSummary?.cutoff_at_utc || status?.cutoff_at_utc;
  const generatedTime = artifactSummary?.generated_at_utc || status?.generated_at_utc;
  const strategy = artifactSummary?.forecasting_strategy || status?.forecasting_strategy || 'volume_velocity_hybrid';
  const totalTopics = artifactSummary?.total_candidate_topics ?? status?.total_candidate_topics ?? 0;

  return (
    <div className="p-4 sm:p-5 rounded-[20px] bg-slate-50/90 dark:bg-[#161B21]/90 border border-slate-200/80 dark:border-[#252B32] shadow-2xs font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Operational Status & Batch Freshness */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isAvailable ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-800/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Forecast Available</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-amber-100/70 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/50 dark:border-amber-800/60">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Forecast Unavailable</span>
              </span>
            )}

            <span className="text-[12px] font-medium text-slate-600 dark:text-slate-400">
              Batch Forecast · Evaluated over {totalTopics} candidate topics
            </span>
          </div>

          <div className="flex items-center gap-4 text-[12px] text-slate-500 dark:text-slate-400 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Observation Cutoff: <strong className="font-mono text-slate-700 dark:text-slate-200">{formatUtcDateTime(cutoffTime)}</strong></span>
            </span>
            <span className="hidden md:inline text-slate-300 dark:text-slate-700">|</span>
            <span className="inline-flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>Generated: <strong className="font-mono text-slate-700 dark:text-slate-200">{formatUtcDateTime(generatedTime)}</strong></span>
            </span>
          </div>
        </div>

        {/* Right: Strategy Provenance Pill */}
        <div className="shrink-0 text-right">
          <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Strategy
          </div>
          <div className="text-[12px] font-mono font-medium text-slate-700 dark:text-slate-300">
            {strategy}
          </div>
        </div>
      </div>
    </div>
  );
};
