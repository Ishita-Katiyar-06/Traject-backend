import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { Select } from '../ui/Select';

export interface TopicApiFilterParams {
  keyword?: string;
  sort_by?: 'message_count' | 'topic_id' | 'percentage_of_dataset';
  order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export interface TopicFiltersProps {
  filters: TopicApiFilterParams;
  onChange: (updated: TopicApiFilterParams) => void;
  onReset: () => void;
  totalCount: number;
  filteredCount: number;
}

export const TopicFilters: React.FC<TopicFiltersProps> = ({
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
    <div className="p-5 sm:p-6 rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white shadow-xs space-y-4 font-sans select-none">
      {/* Search Input Bar + Counts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-lg">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8591A5] pointer-events-none">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={filters.keyword || ''}
            onChange={handleSearch}
            placeholder="Search topics by keyword or topic ID..."
            className="w-full h-10 pl-10 pr-9 bg-white border border-[rgba(228,233,245,0.85)] rounded-full text-[13px] font-medium text-[#111727] placeholder:text-[#8591A5] shadow-xs hover:border-slate-300 focus:outline-none focus:border-[#2F65F6] focus:ring-2 focus:ring-[#2F65F6]/20 transition-all"
          />
          {filters.keyword && (
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
            {totalCount} topics
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[rgba(228,233,245,0.85)]">
        {/* Sort Field */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1.5">
            Sort By
          </label>
          <Select
            value={filters.sort_by || 'message_count'}
            onChange={(e) =>
              onChange({ ...filters, sort_by: e.target.value as any, page: 1 })
            }
            options={[
              { value: 'message_count', label: 'Message Volume (Default)' },
              { value: 'topic_id', label: 'Topic ID' },
              { value: 'percentage_of_dataset', label: 'Corpus Percentage' },
            ]}
          />
        </div>

        {/* Sort Direction */}
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
