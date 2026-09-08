import React, { useState, useEffect, useRef } from 'react';
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
  const [localQuery, setLocalQuery] = useState(filters.keyword || '');
  const onChangeRef = useRef(onChange);
  const filtersRef = useRef(filters);

  onChangeRef.current = onChange;
  filtersRef.current = filters;

  // Keep local query in sync if parent keyword changes from outside (e.g. reset or URL parameter)
  useEffect(() => {
    setLocalQuery(filters.keyword || '');
  }, [filters.keyword]);

  // Debounced propagation to parent (200ms) for snappy, non-blocking search
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((filtersRef.current.keyword || '') !== localQuery) {
        onChangeRef.current({ ...filtersRef.current, keyword: localQuery, page: 1 });
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [localQuery]);

  const isFiltered =
    (localQuery && localQuery.trim() !== '') ||
    (filters.sort_by && filters.sort_by !== 'message_count') ||
    (filters.order && filters.order !== 'desc');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(e.target.value);
  };

  const handleClearQuery = () => {
    setLocalQuery('');
    onChange({ ...filters, keyword: '', page: 1 });
  };

  const handleReset = () => {
    setLocalQuery('');
    onReset();
  };

  return (
    <div className="p-5 sm:p-6 rounded-[24px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-4 font-sans select-none transition-all">
      {/* Search Input Bar + Counts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-lg">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={localQuery}
            onChange={handleSearchChange}
            placeholder="Search trends by keyword or trend ID..."
            className="w-full h-10 pl-10 pr-9 bg-slate-50/60 dark:bg-[#11151A] border border-slate-200/90 dark:border-[#2B323D] rounded-full text-[13px] font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
          />
          {localQuery && (
            <button
              type="button"
              onClick={handleClearQuery}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400 font-mono">
          <span>
            Showing <strong className="text-slate-900 dark:text-white">{filteredCount}</strong> of{' '}
            <strong className="text-slate-900 dark:text-white">{totalCount}</strong> trends
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 ml-2 text-[11px] font-sans font-semibold text-amber-500 dark:text-amber-400 hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Sort Controls Row - Sized generously so text never truncates */}
      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-[#252B32]/80">
        <div className="w-[195px] sm:w-[205px] shrink-0">
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

        <div className="w-[235px] sm:w-[245px] shrink-0">
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

        <div className="w-[135px] sm:w-[140px] shrink-0">
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
