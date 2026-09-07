import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';
import { SystemStatus } from '../components/status/SystemStatus';
import { UserMenu } from '../components/navigation/UserMenu';

export const Header: React.FC = () => {
  const { openSearch } = useNavigation();
  const location = useLocation();

  // Compute institutional breadcrumb hierarchy
  const breadcrumbs = useMemo(() => {
    const path = location.pathname;
    const parts = path.split('/').filter(Boolean);

    let section = 'Monitor';
    let page = 'Overview';

    if (parts.length > 0) {
      const root = parts[0];
      if (root === 'explorer' || root === 'investigation') {
        section = 'Analysis';
      } else if (root === 'settings') {
        section = 'System';
      } else {
        section = 'Monitor';
      }

      const PAGE_NAMES: Record<string, string> = {
        overview: 'Overview',
        topics: 'Topics',
        narratives: 'Narratives',
        communities: 'Communities',
        propagation: 'Propagation',
        alerts: 'Alerts',
        explorer: 'Data Explorer',
        investigation: 'Investigation',
        settings: 'Settings',
      };

      page = PAGE_NAMES[root] || root;
    }

    const detailId = parts.length > 1 ? decodeURIComponent(parts[1]) : null;

    return { section, page, detailId };
  }, [location.pathname]);

  return (
    <header
      aria-label="Application header"
      className="h-16 shrink-0 border-b border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-[#EEF1F8]/95 dark:bg-[#0D1014]/95 backdrop-blur-[4px] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 relative z-50 font-sans"
    >
      {/* Left: Contextual Breadcrumb Hierarchy */}
      <div className="flex items-center gap-2 min-w-0 font-sans">
        {/* Mobile: Compact Brand Mark */}
        <div className="flex md:hidden items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#2F65F6] flex items-center justify-center text-white font-bold font-mono text-[12px] shadow-xs">
            T
          </div>
          <span className="text-[14px] font-bold text-[#111727] dark:text-[#F8FAFC] tracking-tight">
            TRAJECT
          </span>
        </div>

        {/* Desktop: Application / Section / Page Hierarchy */}
        <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 text-[13px] min-w-0">
          <span className="font-bold text-[#111727] dark:text-[#F8FAFC] tracking-tight font-sans">
            TRAJECT
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-[#8591A5] dark:text-[#64748B] shrink-0" />
          <span className="text-[#8591A5] dark:text-[#7A8699] font-medium">
            {breadcrumbs.section}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-[#8591A5] dark:text-[#64748B] shrink-0" />
          <span className="font-semibold text-[#334155] dark:text-[#CBD5E1] truncate">
            {breadcrumbs.page}
          </span>
          {breadcrumbs.detailId && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-[#8591A5] dark:text-[#64748B] shrink-0" />
              <span className="font-mono text-[12px] font-bold text-[#2F65F6] dark:text-[#93C5FD] truncate max-w-[200px]">
                {breadcrumbs.detailId}
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Right Area: System Health, Search Palette, User Menu */}
      <div className="flex items-center gap-3">
        {/* Header Operational System Health Probe */}
        <div className="hidden md:flex items-center">
          <SystemStatus />
        </div>

        {/* Workstation Command Palette Trigger */}
        <button
          type="button"
          aria-label="Open command search (/)"
          onClick={openSearch}
          className="flex items-center justify-between h-10 px-3.5 sm:w-60 md:w-72 rounded-full bg-white dark:bg-[#171C22] hover:bg-[#F8FAFD] dark:hover:bg-[#1D232A] text-[#475569] dark:text-[#CBD5E1] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] hover:border-slate-300 dark:hover:border-slate-600 shadow-xs transition-all duration-150 text-left font-sans outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/40 cursor-pointer"
        >
          <div className="flex items-center gap-2.5 text-[#8591A5] dark:text-[#7A8699] truncate">
            <Search className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline-block text-[13px] text-[#475569] dark:text-[#CBD5E1] truncate font-medium">
              Search topics, narratives, communities...
            </span>
            <span className="sm:hidden text-[13px] text-[#475569] dark:text-[#CBD5E1]">Search</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-mono bg-[#F1F4F9] dark:bg-[#20262E] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] text-[#8591A5] dark:text-[#94A3B8] rounded-full shadow-2xs">
            /
          </kbd>
        </button>

        {/* Analyst Profile Menu */}
        <UserMenu />
      </div>
    </header>
  );
};
