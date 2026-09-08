import React, { useState, useEffect } from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { Select } from '../ui/Select';
import { Platform } from '../../types/api';

export interface ExplorerApiFilterParams {
  keyword?: string;
  platform?: Platform | 'All';
  language?: string;
  topic_id?: string;
  sort_by?: 'published_at' | 'views_count' | 'forwards_count';
  order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export interface ExplorerFiltersProps {
  filters: ExplorerApiFilterParams;
  onChange: (updated: ExplorerApiFilterParams) => void;
  onReset: () => void;
  totalCount: number;
}

export const ExplorerFilters: React.FC<ExplorerFiltersProps> = ({
  filters,
  onChange,
  onReset,
  totalCount,
}) => {
  const [localKeyword, setLocalKeyword] = useState(filters.keyword || '');

  useEffect(() => {
    setLocalKeyword(filters.keyword || '');
  }, [filters.keyword]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if ((filters.keyword || '') !== localKeyword) {
        onChange({ ...filters, keyword: localKeyword, page: 1 });
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [localKeyword, filters, onChange]);

  const isFiltered =
    (filters.platform && filters.platform !== 'All') ||
    (filters.language && filters.language !== 'All') ||
    (filters.topic_id !== undefined && filters.topic_id !== '') ||
    (filters.keyword && filters.keyword.trim() !== '') ||
    (filters.sort_by && filters.sort_by !== 'published_at') ||
    (filters.order && filters.order !== 'desc');

  const handleClearQuery = () => {
    setLocalKeyword('');
    onChange({ ...filters, keyword: '', page: 1 });
  };

  return (
    <div className="p-5 sm:p-6 rounded-[26px] sm:rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-5 font-sans select-none">
      {/* Search Input Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-[#8591A5] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={localKeyword}
            onChange={(e) => setLocalKeyword(e.target.value)}
            placeholder="Search canonical messages by keyword or author/channel..."
            className="w-full h-10 pl-10 pr-9 bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/80 dark:border-[#282F3A] rounded-full text-[13px] font-medium text-[#111727] dark:text-slate-100 placeholder:text-[#8591A5] shadow-xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:border-[#2F65F6] focus:ring-2 focus:ring-[#2F65F6]/20 transition-all"
          />
          {localKeyword && (
            <button
              type="button"
              onClick={handleClearQuery}
              aria-label="Clear query"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8591A5] hover:text-[#111727] dark:hover:text-white p-0.5 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-[13px] text-[#8591A5] dark:text-slate-400 font-sans self-end sm:self-center">
          <span>
            Total Observations: <strong className="text-[#111727] dark:text-slate-100 font-bold font-mono">{totalCount.toLocaleString()}</strong>
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={() => {
                setLocalKeyword('');
                onReset();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-mono font-semibold text-[#2F65F6] dark:text-[#93C5FD] hover:bg-blue-50/60 dark:hover:bg-blue-950/30 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Select Controls Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-[#252B32]">
        {/* Platform */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400 mb-1.5 font-mono">
            Platform
          </label>
          <Select
            value={filters.platform || 'All'}
            onChange={(e) =>
              onChange({
                ...filters,
                platform: e.target.value as Platform | 'All',
                page: 1,
              })
            }
            options={[
              { value: 'All', label: 'All Platforms' },
              { value: 'telegram', label: 'Telegram' },
              { value: 'x', label: 'X (Twitter)' },
            ]}
          />
        </div>

        {/* Language */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400 mb-1.5 font-mono">
            Language
          </label>
          <Select
            value={filters.language || 'All'}
            onChange={(e) =>
              onChange({
                ...filters,
                language: e.target.value === 'All' ? undefined : e.target.value,
                page: 1,
              })
            }
            options={[
              { value: 'All', label: 'All Languages' },
              { value: 'en', label: 'English' },
              { value: 'hi', label: 'Hindi' },
              { value: 'hinglish', label: 'Hinglish' },
            ]}
          />
        </div>

        {/* Sort Field */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400 mb-1.5 font-mono">
            Sort By
          </label>
          <Select
            value={filters.sort_by || 'published_at'}
            onChange={(e) =>
              onChange({
                ...filters,
                sort_by: e.target.value as any,
                page: 1,
              })
            }
            options={[
              { value: 'published_at', label: 'Published Time (Default)' },
              { value: 'views_count', label: 'Views Count' },
              { value: 'forwards_count', label: 'Forwards Count' },
            ]}
          />
        </div>

        {/* Sort Direction */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400 mb-1.5 font-mono">
            Order
          </label>
          <Select
            value={filters.order || 'desc'}
            onChange={(e) =>
              onChange({
                ...filters,
                order: e.target.value as 'asc' | 'desc',
                page: 1,
              })
            }
            options={[
              { value: 'desc', label: 'Descending' },
              { value: 'asc', label: 'Ascending' },
            ]}
          />
        </div>
      </div>
    </div>
  );
};
