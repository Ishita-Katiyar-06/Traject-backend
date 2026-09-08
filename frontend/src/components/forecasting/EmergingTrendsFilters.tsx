import React from 'react';
import type { ForecastTier } from '../../types/forecasting';
import { SlidersHorizontal } from 'lucide-react';

interface EmergingTrendsFiltersProps {
  horizon: '24h' | '6h';
  onHorizonChange: (horizon: '24h' | '6h') => void;
  tier: ForecastTier | 'ALL';
  onTierChange: (tier: ForecastTier | 'ALL') => void;
  minScore: number;
  onMinScoreChange: (score: number) => void;
  limit: number;
  onLimitChange: (limit: number) => void;
  isLoading?: boolean;
}

export const EmergingTrendsFilters: React.FC<EmergingTrendsFiltersProps> = ({
  horizon,
  onHorizonChange,
  tier,
  onTierChange,
  minScore,
  onMinScoreChange,
  limit,
  onLimitChange,
  isLoading = false,
}) => {
  return (
    <div className="p-5 sm:p-6 rounded-[26px] sm:rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs space-y-4 font-sans select-none">
      {/* Top Row: Horizon Pill Dock */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400">
            Forecast Horizon:
          </span>
          <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-[#F5F1E5] dark:bg-[#1E2229] border border-[#E5DFD3] dark:border-[#2D333F] shadow-2xs">
            <button
              type="button"
              id="horizon-toggle-24h"
              onClick={() => onHorizonChange('24h')}
              disabled={isLoading}
              className={`px-4 py-1.5 rounded-full text-[12px] font-mono font-bold transition-all cursor-pointer ${
                horizon === '24h'
                  ? 'bg-white dark:bg-[#252B35] text-[#111727] dark:text-white shadow-xs'
                  : 'text-[#8591A5] hover:text-[#111727] dark:hover:text-white'
              }`}
            >
              24h Horizon (Primary)
            </button>
            <button
              type="button"
              id="horizon-toggle-6h"
              onClick={() => onHorizonChange('6h')}
              disabled={isLoading}
              className={`px-4 py-1.5 rounded-full text-[12px] font-mono font-bold transition-all cursor-pointer ${
                horizon === '6h'
                  ? 'bg-white dark:bg-[#252B35] text-[#111727] dark:text-white shadow-xs'
                  : 'text-[#8591A5] hover:text-[#111727] dark:hover:text-white'
              }`}
            >
              6h Horizon (Auxiliary)
            </button>
          </div>
          {horizon === '6h' && (
            <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
              Experimental View
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#8591A5] dark:text-slate-400">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Algorithmic Parameters</span>
        </div>
      </div>

      {/* Bottom Controls Row: Selectors & Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-[#252B32]">
        {/* Emergence Tier */}
        <div>
          <label
            htmlFor="tier-select"
            className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400 mb-1.5"
          >
            Emergence Tier
          </label>
          <select
            id="tier-select"
            value={tier}
            onChange={(e) => onTierChange(e.target.value as ForecastTier | 'ALL')}
            disabled={isLoading}
            className="w-full h-10 px-3.5 rounded-full text-[12px] font-mono font-semibold bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/80 dark:border-[#282F3A] text-[#111727] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2F65F6]/20 transition-all cursor-pointer shadow-2xs hover:border-slate-300 dark:hover:border-slate-600"
          >
            <option value="ALL">All Emergence Tiers</option>
            <option value="STRONG_EMERGENCE">Strong Emergence (≥ 0.70)</option>
            <option value="MODERATE_EMERGENCE">Moderate Emergence (0.50–0.69)</option>
            <option value="EARLY_SIGNAL">Early Signal (0.35–0.49)</option>
            <option value="LOW_MOMENTUM">Low Momentum (&lt; 0.35)</option>
          </select>
        </div>

        {/* Min Score Slider */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400 mb-1.5">
            <span>Min Emerging Score</span>
            <strong className="text-[#111727] dark:text-slate-100 font-mono text-[12px]">{minScore.toFixed(2)}</strong>
          </div>
          <div className="h-10 flex items-center px-2 bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/80 dark:border-[#282F3A] rounded-full">
            <input
              id="min-score-input"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minScore}
              onChange={(e) => onMinScoreChange(parseFloat(e.target.value))}
              disabled={isLoading}
              className="w-full accent-[#2F65F6] cursor-pointer h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"
            />
          </div>
        </div>

        {/* Trend Limit Selector */}
        <div>
          <label
            htmlFor="limit-select"
            className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400 mb-1.5"
          >
            Trend Limit
          </label>
          <select
            id="limit-select"
            value={limit}
            onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
            disabled={isLoading}
            className="w-full h-10 px-3.5 rounded-full text-[12px] font-mono font-semibold bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/80 dark:border-[#282F3A] text-[#111727] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2F65F6]/20 transition-all cursor-pointer shadow-2xs hover:border-slate-300 dark:hover:border-slate-600"
          >
            <option value={10}>Top 10 Trends</option>
            <option value={20}>Top 20 Trends</option>
            <option value={50}>Top 50 Trends</option>
            <option value={100}>Top 100 Trends</option>
          </select>
        </div>
      </div>
    </div>
  );
};
