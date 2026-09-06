import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { PriorityTier } from '../../types/api';
import { Select } from '../ui/Select';
import { COORDINATION_WORDING } from '../../utils/telemetryFormatters';

export interface NarrativeApiFilterParams {
  priority_tier?: PriorityTier | 'all';
  has_coordination_signal?: boolean | 'all';
  sort_by?: 'priority_signal_score' | 'spread_score' | 'coordination_score' | 'reach_score' | 'friction_score' | 'first_observed_at' | 'last_observed_at';
  order?: 'asc' | 'desc';
  query?: string;
  page?: number;
  page_size?: number;
}

export interface NarrativeFiltersProps {
  filters: NarrativeApiFilterParams;
  onChange: (updated: NarrativeApiFilterParams) => void;
  onReset: () => void;
  totalCount: number;
  filteredCount: number;
}

export const NarrativeFilters: React.FC<NarrativeFiltersProps> = ({
  filters,
  onChange,
  onReset,
  totalCount,
  filteredCount,
}) => {
  const isFiltered =
    (filters.priority_tier && filters.priority_tier !== 'all') ||
    (filters.has_coordination_signal !== undefined && filters.has_coordination_signal !== 'all') ||
    (filters.query && filters.query.trim() !== '') ||
    (filters.sort_by && filters.sort_by !== 'priority_signal_score') ||
    (filters.order && filters.order !== 'desc');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, query: e.target.value, page: 1 });
  };

  const handleClearQuery = () => {
    onChange({ ...filters, query: '', page: 1 });
  };

  return (
    <div className="p-5 sm:p-6 rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white shadow-xs space-y-5 font-sans select-none">
      {/* Search Input Bar + Counts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-lg">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8591A5] pointer-events-none">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={filters.query || ''}
            onChange={handleSearch}
            placeholder="Search narrative candidates by label or representative text..."
            className="w-full h-10 pl-10 pr-9 bg-white border border-[rgba(228,233,245,0.85)] rounded-full text-[13px] font-medium text-[#111727] placeholder:text-[#8591A5] shadow-xs hover:border-slate-300 focus:outline-none focus:border-[#2F65F6] focus:ring-2 focus:ring-[#2F65F6]/20 transition-all"
          />
          {filters.query && (
            <button
              type="button"
              onClick={handleClearQuery}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8591A5] hover:text-[#111727] p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-[13px] text-[#8591A5] font-sans self-end sm:self-center">
          <span>
            Showing <strong className="text-[#111727] font-bold">{filteredCount}</strong> of{' '}
            {totalCount} candidates
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2F65F6] hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Select Controls Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-[rgba(228,233,245,0.85)]">
        {/* Priority Tier Filter */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1.5">
            Priority Tier
          </label>
          <Select
            value={filters.priority_tier || 'all'}
            onChange={(e) =>
              onChange({ ...filters, priority_tier: e.target.value as PriorityTier | 'all', page: 1 })
            }
            options={[
              { value: 'all', label: 'All Priority Tiers' },
              { value: 'critical', label: 'Critical (≥ 0.75)' },
              { value: 'high', label: 'High (0.55 – 0.74)' },
              { value: 'elevated', label: 'Elevated (0.35 – 0.54)' },
              { value: 'routine', label: 'Routine (< 0.35)' },
            ]}
          />
        </div>

        {/* Coordination Signal Filter */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1.5">
            {COORDINATION_WORDING.primary}
          </label>
          <Select
            value={
              filters.has_coordination_signal === true
                ? 'true'
                : filters.has_coordination_signal === false
                ? 'false'
                : 'all'
            }
            onChange={(e) => {
              const val = e.target.value;
              onChange({
                ...filters,
                has_coordination_signal: val === 'true' ? true : val === 'false' ? false : 'all',
                page: 1,
              });
            }}
            options={[
              { value: 'all', label: 'All Signal States' },
              { value: 'true', label: 'Flagged Signal Only' },
              { value: 'false', label: 'No Signal Flagged' },
            ]}
          />
        </div>

        {/* Sort Metric */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1.5">
            Sort Metric
          </label>
          <Select
            value={filters.sort_by || 'priority_signal_score'}
            onChange={(e) =>
              onChange({ ...filters, sort_by: e.target.value as any, page: 1 })
            }
            options={[
              { value: 'priority_signal_score', label: 'Priority Signal Score' },
              { value: 'spread_score', label: 'Spread Score' },
              { value: 'coordination_score', label: 'Coordination Score' },
              { value: 'reach_score', label: 'Observed Reach Score' },
              { value: 'friction_score', label: 'Friction Score' },
              { value: 'last_observed_at', label: 'Latest Observed' },
              { value: 'first_observed_at', label: 'Earliest Observed' },
            ]}
          />
        </div>

        {/* Sort Order */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1.5">
            Sort Direction
          </label>
          <Select
            value={filters.order || 'desc'}
            onChange={(e) =>
              onChange({ ...filters, order: e.target.value as 'asc' | 'desc', page: 1 })
            }
            options={[
              { value: 'desc', label: 'Descending (Highest First)' },
              { value: 'asc', label: 'Ascending (Lowest First)' },
            ]}
          />
        </div>
      </div>
    </div>
  );
};
