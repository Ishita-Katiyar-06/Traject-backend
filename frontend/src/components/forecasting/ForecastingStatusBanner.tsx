import React from 'react';
import { Clock, CheckCircle2, AlertCircle, Database, Cpu } from 'lucide-react';
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
      <div className="p-5 sm:p-6 rounded-[26px] sm:rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs animate-pulse">
        <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700 rounded-full mb-3" />
        <div className="h-4 w-96 bg-slate-200 dark:bg-slate-700 rounded-full" />
      </div>
    );
  }

  const isAvailable = status?.artifact_available ?? (artifactSummary !== null);
  const cutoffTime = artifactSummary?.cutoff_at_utc || status?.cutoff_at_utc;
  const generatedTime = artifactSummary?.generated_at_utc || status?.generated_at_utc;
  const strategy = artifactSummary?.forecasting_strategy || status?.forecasting_strategy || 'volume_velocity_hybrid';
  const totalTopics = artifactSummary?.total_candidate_topics ?? status?.total_candidate_topics ?? 0;

  return (
    <div className="p-5 sm:p-6 rounded-[26px] sm:rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs hover:border-amber-400/80 dark:hover:border-amber-500/50 transition-all duration-300 font-sans">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Operational Status & Batch Freshness */}
        <div className="space-y-2.5 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            {isAvailable ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Forecast Engine Live</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wide uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 shadow-2xs">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Forecast Awaiting Artifact</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] text-[#8591A5] dark:text-slate-400">
              Evaluated over <strong className="text-[#111727] dark:text-slate-200 font-bold">{totalTopics}</strong> candidate topics
            </span>
          </div>

          <div className="flex items-center gap-3 text-[12px] text-[#8591A5] dark:text-slate-400 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] text-[11px] font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Cutoff: <strong className="font-bold text-[#111727] dark:text-slate-200">{formatUtcDateTime(cutoffTime)}</strong></span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] text-[11px] font-mono">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>Batch Run: <strong className="font-bold text-[#111727] dark:text-slate-200">{formatUtcDateTime(generatedTime)}</strong></span>
            </span>
          </div>
        </div>

        {/* Right: Strategy Provenance Pill */}
        <div className="shrink-0 flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-[#252B32]">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-[#2F65F6] dark:text-[#93C5FD]" />
            <span>Engine Strategy</span>
          </div>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] text-[11px] font-mono font-semibold text-[#111727] dark:text-slate-200 shadow-2xs">
            {strategy}
          </div>
        </div>
      </div>
    </div>
  );
};

