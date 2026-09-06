import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { Select } from '../ui/Select';
import { AlertFilterParams } from '../../services/alertService';
import { AlertPriorityType, AlertStatusType } from '../../data/mock/alerts';

export interface AlertFiltersProps {
  filters: AlertFilterParams;
  onChange: (updated: AlertFilterParams) => void;
  onReset: () => void;
  totalCount: number;
  filteredCount: number;
}

export const AlertFilters: React.FC<AlertFiltersProps> = ({
  filters,
  onChange,
  onReset,
  totalCount,
  filteredCount,
}) => {
  const isFiltered =
    (filters.status && filters.status !== 'All') ||
    (filters.priority && filters.priority !== 'All') ||
    (filters.platform && filters.platform !== 'All') ||
    (filters.query && filters.query.trim() !== '');

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
            placeholder="Search alerts by title, topic, narrative..."
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
            {totalCount} alerts
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 border-t border-[rgba(228,233,245,0.85)]">
        {/* Status Filter */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1">STATUS</label>
          <Select
            value={filters.status || 'All'}
            onChange={(e) =>
              onChange({ ...filters, status: e.target.value as AlertStatusType | 'All' })
            }
            options={[
              { value: 'All', label: 'All Statuses' },
              { value: 'New', label: 'New' },
              { value: 'Acknowledged', label: 'Acknowledged' },
              { value: 'Under review', label: 'Under Review' },
              { value: 'Resolved', label: 'Resolved' },
            ]}
          />
        </div>

        {/* Priority Filter */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1">PRIORITY</label>
          <Select
            value={filters.priority || 'All'}
            onChange={(e) =>
              onChange({ ...filters, priority: e.target.value as AlertPriorityType | 'All' })
            }
            options={[
              { value: 'All', label: 'All Priorities' },
              { value: 'High', label: 'High' },
              { value: 'Medium', label: 'Medium' },
              { value: 'Low', label: 'Low' },
            ]}
          />
        </div>

        {/* Platform Filter */}
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1">PLATFORM</label>
          <Select
            value={filters.platform || 'All'}
            onChange={(e) => onChange({ ...filters, platform: e.target.value })}
            options={[
              { value: 'All', label: 'All Platforms' },
              { value: 'X', label: 'X (Twitter)' },
              { value: 'Telegram', label: 'Telegram' },
            ]}
          />
        </div>
      </div>
    </div>
  );
};
