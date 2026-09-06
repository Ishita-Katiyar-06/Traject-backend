import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { SignalFilterParams } from '../../services/signalService';
import { SignalStatusType, SignalStrengthType } from '../../data/mock/signals';
import { Select } from '../ui/Select';

export interface SignalFiltersProps {
  filters: SignalFilterParams;
  onChange: (updated: SignalFilterParams) => void;
  onReset: () => void;
  totalCount: number;
  filteredCount: number;
}

export const SignalFilters: React.FC<SignalFiltersProps> = ({
  filters,
  onChange,
  onReset,
  totalCount,
  filteredCount,
}) => {
  const isFiltered =
    (filters.status && filters.status !== 'All') ||
    (filters.strength && filters.strength !== 'All') ||
    (filters.source && filters.source !== 'All') ||
    (filters.language && filters.language !== 'All') ||
    (filters.query && filters.query.trim() !== '');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, query: e.target.value });
  };

  const handleClearQuery = () => {
    onChange({ ...filters, query: '' });
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
            placeholder="Search anomalies by title, description..."
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
            {totalCount} signals
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

      {/* Filter Chips Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t border-[rgba(228,233,245,0.85)]">
        {/* Status Dropdown */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1.5">
            Status
          </label>
          <Select
            value={filters.status || 'All'}
            onChange={(e) =>
              onChange({ ...filters, status: e.target.value as SignalStatusType | 'All' })
            }
            options={[
              { value: 'All', label: 'All Statuses' },
              { value: 'Emerging', label: 'Emerging' },
              { value: 'Monitoring', label: 'Monitoring' },
              { value: 'Confirmed', label: 'Confirmed' },
              { value: 'Fading', label: 'Fading' },
            ]}
          />
        </div>

        {/* Strength Dropdown */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1.5">
            Strength
          </label>
          <Select
            value={filters.strength || 'All'}
            onChange={(e) =>
              onChange({ ...filters, strength: e.target.value as SignalStrengthType | 'All' })
            }
            options={[
              { value: 'All', label: 'All Strengths' },
              { value: 'High', label: 'High Priority' },
              { value: 'Medium', label: 'Medium' },
              { value: 'Low', label: 'Low' },
            ]}
          />
        </div>

        {/* Source Dropdown */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1.5">
            Source
          </label>
          <Select
            value={filters.source || 'All'}
            onChange={(e) => onChange({ ...filters, source: e.target.value as 'Telegram' | 'X' | 'All' })}
            options={[
              { value: 'All', label: 'All Sources' },
              { value: 'X', label: 'X (Twitter)' },
              { value: 'Telegram', label: 'Telegram' },
            ]}
          />
        </div>

        {/* Language Dropdown */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1.5">
            Language
          </label>
          <Select
            value={filters.language || 'All'}
            onChange={(e) => onChange({ ...filters, language: e.target.value })}
            options={[
              { value: 'All', label: 'All Languages' },
              { value: 'English', label: 'English' },
              { value: 'Hindi', label: 'Hindi' },
              { value: 'Hinglish', label: 'Hinglish' },
            ]}
          />
        </div>

        {/* Sort By Dropdown */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1.5">
            Sort By
          </label>
          <Select
            value={filters.sortBy || 'recent'}
            onChange={(e) =>
              onChange({
                ...filters,
                sortBy: e.target.value as 'recent' | 'change' | 'priority',
              })
            }
            options={[
              { value: 'recent', label: 'Most Recent' },
              { value: 'change', label: 'Highest Velocity' },
              { value: 'priority', label: 'Highest Priority' },
            ]}
            align="right"
          />
        </div>
      </div>
    </div>
  );
};
