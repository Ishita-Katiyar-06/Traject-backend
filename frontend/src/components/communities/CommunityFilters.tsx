import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { Select } from '../ui/Select';
import { CommunityFilterParams } from '../../services/communityService';
import { CommunityActivityLevel, CommunityTrend } from '../../data/mock/communities';

export interface CommunityFiltersProps {
  filters: CommunityFilterParams;
  onChange: (updated: CommunityFilterParams) => void;
  onReset: () => void;
  totalCount: number;
  filteredCount: number;
}

export const CommunityFilters: React.FC<CommunityFiltersProps> = ({
  filters,
  onChange,
  onReset,
  totalCount,
  filteredCount,
}) => {
  const isFiltered =
    (filters.platform && filters.platform !== 'All') ||
    (filters.language && filters.language !== 'All') ||
    (filters.activity && filters.activity !== 'All') ||
    (filters.trend && filters.trend !== 'All') ||
    (filters.query && filters.query.trim() !== '') ||
    (filters.sortBy && filters.sortBy !== 'volume');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, query: e.target.value });
  };

  const handleClearQuery = () => {
    onChange({ ...filters, query: '' });
  };

  return (
    <div className="p-4 sm:p-5 rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white shadow-xs space-y-4 font-sans select-none">
      {/* Search Input Bar + Counts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8591A5] pointer-events-none">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={filters.query || ''}
            onChange={handleSearch}
            placeholder="Search discussion communities by name, description..."
            className="w-full h-10 pl-10 pr-8 bg-[#EEF1F8] border border-transparent rounded-full text-[13px] text-[#111727] placeholder:text-[#8591A5] focus:outline-none focus:border-[#2F65F6] transition-colors"
          />
          {filters.query && (
            <button
              type="button"
              onClick={handleClearQuery}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8591A5] hover:text-[#111727] p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-[12px] text-[#8591A5] font-sans self-end sm:self-center">
          <span>
            Showing <strong className="text-[#111727] font-semibold">{filteredCount}</strong> of{' '}
            {totalCount} communities
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[#2F65F6] hover:underline"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Select Controls Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-3 border-t border-[rgba(228,233,245,0.85)]">
        {/* Platform Filter */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1">PLATFORM</label>
          <Select
            value={filters.platform || 'All'}
            onChange={(e) =>
              onChange({ ...filters, platform: e.target.value as 'All' | 'X' | 'Telegram' })
            }
            options={[
              { value: 'All', label: 'All Platforms' },
              { value: 'X', label: 'X Only' },
              { value: 'Telegram', label: 'Telegram Only' },
            ]}
          />
        </div>

        {/* Language Filter */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1">LANGUAGE</label>
          <Select
            value={filters.language || 'All'}
            onChange={(e) =>
              onChange({
                ...filters,
                language: e.target.value as 'All' | 'English' | 'Hindi' | 'Hinglish',
              })
            }
            options={[
              { value: 'All', label: 'All Languages' },
              { value: 'English', label: 'English' },
              { value: 'Hindi', label: 'Hindi' },
              { value: 'Hinglish', label: 'Hinglish' },
            ]}
          />
        </div>

        {/* Activity Level */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1">ACTIVITY</label>
          <Select
            value={filters.activity || 'All'}
            onChange={(e) =>
              onChange({ ...filters, activity: e.target.value as CommunityActivityLevel | 'All' })
            }
            options={[
              { value: 'All', label: 'All Activity' },
              { value: 'High', label: 'High' },
              { value: 'Moderate', label: 'Moderate' },
              { value: 'Low', label: 'Low' },
            ]}
          />
        </div>

        {/* Trend Filter */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1">TREND</label>
          <Select
            value={filters.trend || 'All'}
            onChange={(e) =>
              onChange({ ...filters, trend: e.target.value as CommunityTrend | 'All' })
            }
            options={[
              { value: 'All', label: 'All Trends' },
              { value: 'Growing', label: 'Growing' },
              { value: 'Stable', label: 'Stable' },
              { value: 'Cooling', label: 'Cooling' },
            ]}
          />
        </div>

        {/* Sort Select */}
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1">SORT BY</label>
          <Select
            value={filters.sortBy || 'volume'}
            onChange={(e) =>
              onChange({
                ...filters,
                sortBy: e.target.value as 'volume' | 'recent' | 'name',
              })
            }
            options={[
              { value: 'volume', label: 'Total Volume' },
              { value: 'recent', label: 'Most Recent' },
              { value: 'name', label: 'Community Name' },
            ]}
          />
        </div>
      </div>
    </div>
  );
};
