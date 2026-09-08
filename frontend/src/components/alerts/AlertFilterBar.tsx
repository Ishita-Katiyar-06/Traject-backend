import React, { useState, useEffect } from 'react';
import { Search, Filter, CheckCheck, X } from 'lucide-react';
import type { AlertCategory, AlertFilterState, AlertSeverity } from '../../types/alerts';
import { Button } from '../ui/Button';

interface AlertFilterBarProps {
  filterState: AlertFilterState;
  onFilterChange: (updates: Partial<AlertFilterState>) => void;
  openCount: number;
  acknowledgedCount: number;
  dismissedCount: number;
  totalFilteredCount?: number;
  openInFilteredCount: number;
  onAcknowledgeAllFiltered: () => void;
}

export const AlertFilterBar: React.FC<AlertFilterBarProps> = ({
  filterState,
  onFilterChange,
  openCount,
  acknowledgedCount,
  dismissedCount,
  openInFilteredCount,
  onAcknowledgeAllFiltered,
}) => {
  // Local debounced search to eliminate typing stutter
  const [localSearch, setLocalSearch] = useState(filterState.search);

  useEffect(() => {
    setLocalSearch(filterState.search);
  }, [filterState.search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filterState.search) {
        onFilterChange({ search: localSearch });
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [localSearch, filterState.search, onFilterChange]);

  return (
    <div className="p-5 sm:p-6 rounded-[26px] sm:rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs space-y-4 font-sans">
      {/* Top Row: Status Tabs & Quick Batch Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status Filter Tabs Dock */}
        <div className="flex items-center gap-1.5 p-1 rounded-full bg-[#F5F1E5] dark:bg-[#1E2229] border border-[#E5DFD3] dark:border-[#2D333F]">
          <button
            type="button"
            onClick={() => onFilterChange({ status: 'all' })}
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-mono font-bold transition-all cursor-pointer ${
              filterState.status === 'all'
                ? 'bg-white dark:bg-[#252B35] text-[#111727] dark:text-white shadow-xs'
                : 'text-[#8591A5] hover:text-[#111727] dark:hover:text-white'
            }`}
          >
            All Alerts
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ status: 'open' })}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-mono font-bold transition-all cursor-pointer ${
              filterState.status === 'open'
                ? 'bg-white dark:bg-[#252B35] text-[#111727] dark:text-white shadow-xs'
                : 'text-[#8591A5] hover:text-[#111727] dark:hover:text-white'
            }`}
          >
            <span>Open</span>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
              {openCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ status: 'acknowledged' })}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-mono font-bold transition-all cursor-pointer ${
              filterState.status === 'acknowledged'
                ? 'bg-white dark:bg-[#252B35] text-[#111727] dark:text-white shadow-xs'
                : 'text-[#8591A5] hover:text-[#111727] dark:hover:text-white'
            }`}
          >
            <span>Acknowledged</span>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300">
              {acknowledgedCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ status: 'dismissed' })}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-mono font-bold transition-all cursor-pointer ${
              filterState.status === 'dismissed'
                ? 'bg-white dark:bg-[#252B35] text-[#111727] dark:text-white shadow-xs'
                : 'text-[#8591A5] hover:text-[#111727] dark:hover:text-white'
            }`}
          >
            <span>Dismissed</span>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {dismissedCount}
            </span>
          </button>
        </div>

        {/* Batch Acknowledge Action */}
        {openInFilteredCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full px-4 hover:border-emerald-400/80 dark:hover:border-emerald-500/50"
            leftIcon={<CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
            onClick={onAcknowledgeAllFiltered}
          >
            Acknowledge All Filtered ({openInFilteredCount})
          </Button>
        )}
      </div>

      {/* Bottom Row: Search & Granular Dropdown Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-[#252B32]">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8591A5]" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Filter by claim keywords, narrative ID, or trend..."
            className="w-full pl-10 pr-9 py-2 text-[13px] rounded-full border border-slate-200/80 dark:border-[#282F3A] bg-[#FAFBFD] dark:bg-[#12161C] text-[#111727] dark:text-slate-100 placeholder-[#8591A5] focus:outline-none focus:ring-2 focus:ring-[#2F65F6]/20 focus:border-[#2F65F6] font-sans shadow-2xs transition-all"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                onFilterChange({ search: '' });
              }}
              aria-label="Clear search"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8591A5] hover:text-[#111727] dark:hover:text-white p-0.5 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Severity Dropdown */}
          <div className="flex items-center gap-1.5 text-[12px] font-mono text-[#64748B] dark:text-slate-400">
            <Filter className="w-3.5 h-3.5 text-[#2F65F6] dark:text-[#93C5FD]" />
            <span>Severity:</span>
            <select
              value={filterState.severity}
              onChange={(e) => onFilterChange({ severity: e.target.value as 'all' | AlertSeverity })}
              className="text-[12px] font-mono font-semibold py-1.5 px-3 rounded-full border border-slate-200/80 dark:border-[#282F3A] bg-[#FAFBFD] dark:bg-[#12161C] text-[#111727] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2F65F6]/20 transition-all cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="elevated">Elevated</option>
              <option value="routine">Routine</option>
            </select>
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5 text-[12px] font-mono text-[#64748B] dark:text-slate-400">
            <span>Category:</span>
            <select
              value={filterState.category}
              onChange={(e) => onFilterChange({ category: e.target.value as 'all' | AlertCategory })}
              className="text-[12px] font-mono font-semibold py-1.5 px-3 rounded-full border border-slate-200/80 dark:border-[#282F3A] bg-[#FAFBFD] dark:bg-[#12161C] text-[#111727] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2F65F6]/20 transition-all cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="priority_breach">Priority Breach</option>
              <option value="coordination_anomaly">Coordination Signal</option>
              <option value="cross_domain_spillover">Cross-Domain Spillover</option>
              <option value="high_velocity">High Velocity</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
