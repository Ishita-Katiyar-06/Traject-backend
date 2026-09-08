import React from 'react';
import type { ForecastTier } from '../../types/forecasting';

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
    <div className="bg-[#12161f]/80 border border-slate-800/80 rounded-xl p-4 md:p-5 backdrop-blur-sm shadow-lg space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Horizon Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Forecast Horizon:
          </span>
          <div className="inline-flex rounded-lg bg-slate-900/90 p-1 border border-slate-800">
            <button
              type="button"
              id="horizon-toggle-24h"
              onClick={() => onHorizonChange('24h')}
              disabled={isLoading}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                horizon === '24h'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              24h Horizon (Primary)
            </button>
            <button
              type="button"
              id="horizon-toggle-6h"
              onClick={() => onHorizonChange('6h')}
              disabled={isLoading}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                horizon === '6h'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              6h Horizon (Auxiliary)
            </button>
          </div>
          {horizon === '6h' && (
            <span className="text-[11px] text-amber-400/90 font-medium bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/50">
              Experimental View
            </span>
          )}
        </div>

        {/* Filters and Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Tier Dropdown */}
          <div className="flex flex-col gap-1">
            <label htmlFor="tier-select" className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Emergence Tier
            </label>
            <select
              id="tier-select"
              value={tier}
              onChange={(e) => onTierChange(e.target.value as ForecastTier | 'ALL')}
              disabled={isLoading}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Tiers</option>
              <option value="STRONG_EMERGENCE">Strong Emergence (≥ 0.70)</option>
              <option value="MODERATE_EMERGENCE">Moderate Emergence (0.50–0.69)</option>
              <option value="EARLY_SIGNAL">Early Signal (0.35–0.49)</option>
              <option value="LOW_MOMENTUM">Low Momentum (&lt; 0.35)</option>
            </select>
          </div>

          {/* Min Score Input */}
          <div className="flex flex-col gap-1">
            <label htmlFor="min-score-input" className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Min Score: {minScore.toFixed(2)}
            </label>
            <input
              id="min-score-input"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minScore}
              onChange={(e) => onMinScoreChange(parseFloat(e.target.value))}
              disabled={isLoading}
              className="accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer h-2 my-auto"
            />
          </div>

          {/* Limit Selector */}
          <div className="flex flex-col gap-1">
            <label htmlFor="limit-select" className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Topic Limit
            </label>
            <select
              id="limit-select"
              value={limit}
              onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
              disabled={isLoading}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value={10}>Top 10 Topics</option>
              <option value={20}>Top 20 Topics</option>
              <option value={50}>Top 50 Topics</option>
              <option value={100}>Top 100 Topics</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
