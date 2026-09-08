import React from 'react';
import { Search, Filter, CheckCheck } from 'lucide-react';
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
  return (
    <div className="p-4 rounded-[22px] bg-white dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-xs space-y-3.5">
      {/* Top Row: Status Tabs & Quick Batch Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => onFilterChange({ status: 'all' })}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
              filterState.status === 'all'
                ? 'bg-white dark:bg-[#13171C] text-[#111727] dark:text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#111727] dark:text-[#94A3B8]'
            }`}
          >
            All Alerts
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ status: 'open' })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
              filterState.status === 'open'
                ? 'bg-white dark:bg-[#13171C] text-[#111727] dark:text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#111727] dark:text-[#94A3B8]'
            }`}
          >
            <span>Open</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
              {openCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ status: 'acknowledged' })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
              filterState.status === 'acknowledged'
                ? 'bg-white dark:bg-[#13171C] text-[#111727] dark:text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#111727] dark:text-[#94A3B8]'
            }`}
          >
            <span>Acknowledged</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
              {acknowledgedCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ status: 'dismissed' })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
              filterState.status === 'dismissed'
                ? 'bg-white dark:bg-[#13171C] text-[#111727] dark:text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#111727] dark:text-[#94A3B8]'
            }`}
          >
            <span>Dismissed</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {dismissedCount}
            </span>
          </button>
        </div>

        {/* Batch Acknowledge Action */}
        {openInFilteredCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<CheckCheck className="w-3.5 h-3.5 text-emerald-600" />}
            onClick={onAcknowledgeAllFiltered}
          >
            Acknowledge All Filtered ({openInFilteredCount})
          </Button>
        )}
      </div>

      {/* Bottom Row: Search & Granular Dropdown Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8591A5]" />
          <input
            type="text"
            value={filterState.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder="Filter by claim keywords, narrative ID, or trend..."
            className="w-full pl-9 pr-4 py-1.5 text-[13px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-[#111727] dark:text-white placeholder-[#8591A5] focus:outline-none focus:ring-2 focus:ring-[#2F65F6]/20 font-sans"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Severity Dropdown */}
          <div className="flex items-center gap-1.5 text-[12px] font-mono text-[#64748B] dark:text-[#94A3B8]">
            <Filter className="w-3.5 h-3.5 text-[#2F65F6]" />
            <span>Severity:</span>
            <select
              value={filterState.severity}
              onChange={(e) => onFilterChange({ severity: e.target.value as 'all' | AlertSeverity })}
              className="text-[12px] font-medium py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[#111727] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2F65F6]/20"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5 text-[12px] font-mono text-[#64748B] dark:text-[#94A3B8]">
            <span>Category:</span>
            <select
              value={filterState.category}
              onChange={(e) => onFilterChange({ category: e.target.value as 'all' | AlertCategory })}
              className="text-[12px] font-medium py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[#111727] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2F65F6]/20"
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
