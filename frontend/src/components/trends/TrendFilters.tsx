import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { Select } from '../ui/Select';

export interface TrendApiFilterParams {
  keyword?: string;
  sort_by?: 'message_count' | 'topic_id' | 'trend_id' | 'percentage_of_dataset';
  order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export interface TrendFiltersProps {
  filters: TrendApiFilterParams;
  onChange: (updated: TrendApiFilterParams) => void;
  onReset: () => void;
  totalCount: number;
  filteredCount: number;
}

export const TrendFilters: React.FC<TrendFiltersProps> = ({
  filters,
  onChange,
  onReset,
  totalCount,
  filteredCount,
}) => {
  const isFiltered =
    (filters.keyword && filters.keyword.trim() !== '') ||
    (filters.sort_by && filters.sort_by !== 'message_count') ||
    (filters.order && filters.order !== 'desc');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, keyword: e.target.value, page: 1 });
  };

  const handleClearQuery = () => {
    onChange({ ...filters, keyword: '', page: 1 });
  };

  return (
    <div className="p-5 sm:p-6 rounded-[24px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-dashboard space-y-4 font-sans select-none transition-all">
      {/* Search Input Bar + Counts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-lg">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8591A5] dark:text-slate-500 pointer-events-none">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={filters.keyword || ''}
            onChange={handleSearch}
            placeholder="Search trends by keyword or trend ID..."
            className="w-full h-10 pl-10 pr-9 bg-white dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] rounded-full text-[13px] font-medium text-[#111727] dark:text-[#F8FAFC] placeholder:text-[#8591A5] dark:placeholder:text-slate-500 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:border-[#2F65F6] focus:ring-2 focus:ring-[#2F65F6]/20 transition-all"
          />
          {filters.keyword && (
            <button
              type="button"
              onClick={handleClearQuery}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8591A5] hover:text-[#111727] dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-[12px] text-[#8591A5] dark:text-slate-400 font-mono">
          <span>
            Showing <strong className="text-[#111727] dark:text-slate-200">{filteredCount}</strong> of{' '}
            <strong className="text-[#111727] dark:text-slate-200">{totalCount}</strong> trends
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 ml-2 text-[11px] font-sans font-semibold text-[#2F65F6] dark:text-[#93C5FD] hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Sort Controls Row */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-[#252B32]/80">
        <div className="w-48">
          <Select
            aria-label="Sort By"
            value={filters.sort_by || 'message_count'}
            options={[
              { value: 'message_count', label: 'Message Volume' },
              { value: 'percentage_of_dataset', label: 'Dataset %' },
              { value: 'topic_id', label: 'Trend Cluster ID' },
            ]}
            onValueChange={(val) =>
              onChange({
                ...filters,
                sort_by: val as TrendApiFilterParams['sort_by'],
                page: 1,
              })
            }
          />
        </div>

        <div className="w-40">
          <Select
            aria-label="Direction"
            value={filters.order || 'desc'}
            options={[
              { value: 'desc', label: 'Descending (High to Low)' },
              { value: 'asc', label: 'Ascending (Low to High)' },
            ]}
            onValueChange={(val) =>
              onChange({
                ...filters,
                order: val as 'asc' | 'desc',
                page: 1,
              })
            }
          />
        </div>

        <div className="w-36">
          <Select
            aria-label="Page Size"
            value={String(filters.page_size || 10)}
            options={[
              { value: '10', label: '10 per page' },
              { value: '20', label: '20 per page' },
              { value: '50', label: '50 per page' },
            ]}
            onValueChange={(val) =>
              onChange({
                ...filters,
                page_size: Number(val),
                page: 1,
              })
            }
          />
        </div>
      </div>
    </div>
  );
};
