import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';
import { SystemStatus } from '../components/status/SystemStatus';
import { LiveStreamBadge } from '../components/status/LiveStreamBadge';
import { LiveAlertToast } from '../components/feedback/LiveAlertToast';
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
        topics: 'Trends',
        trends: 'Trends',
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
      className="h-16 shrink-0 border-b border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-[#EEF1F8]/95 dark:bg-[#0D1014]/95 backdrop-blur-[6px] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 relative z-header font-sans select-none"
    >
      {/* Left: Contextual Breadcrumb Hierarchy */}
      <div className="flex items-center gap-2 min-w-0 font-sans">
        {/* Mobile: Compact Brand Mark */}
        <div className="flex md:hidden items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#2F65F6] flex items-center justify-center text-white font-bold font-mono text-[12px] shadow-subtle shrink-0">
            T
          </div>
          <span className="text-[14px] font-bold text-[#111727] dark:text-[#F8FAFC] tracking-tight font-sans">
            TRAJECT
          </span>
        </div>

        {/* Desktop: Application / Section / Page Hierarchy */}
        <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 text-[13px] min-w-0">
          <span className="text-[#8591A5] dark:text-[#7A8699] font-medium font-sans">
            TRAJECT
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-[#8591A5] dark:text-[#64748B] shrink-0" />
          <span className="text-[#8591A5] dark:text-[#7A8699] font-medium">
            {breadcrumbs.section}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-[#8591A5] dark:text-[#64748B] shrink-0" />
          <span className="font-semibold text-[#111727] dark:text-[#F8FAFC] truncate">
            {breadcrumbs.page}
          </span>
          {breadcrumbs.detailId && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-[#8591A5] dark:text-[#64748B] shrink-0" />
              <span className="font-mono text-[11px] font-semibold bg-[#2F65F6]/10 text-[#2F65F6] dark:text-[#93C5FD] px-2 py-0.5 rounded-full truncate max-w-[200px]">
                {breadcrumbs.detailId}
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Right Area: System Health, Search Palette, User Menu */}
      <div className="flex items-center gap-3">
        {/* Real-time WebSocket Stream Beacon */}
        <div className="flex items-center">
          <LiveStreamBadge />
        </div>

        {/* Header Operational System Health Probe */}
        <div className="hidden md:flex items-center">
          <SystemStatus />
        </div>

        {/* Floating Real-time Alert Toast Notifications */}
        <LiveAlertToast />

        {/* Workstation Command Palette Trigger */}
        <button
          type="button"
          aria-label="Open command search (/)"
          onClick={openSearch}
          className="flex items-center justify-between h-10 px-3.5 sm:w-64 md:w-80 rounded-full bg-white dark:bg-[#171C22] hover:bg-[#F8FAFD] dark:hover:bg-[#1D232A] text-[#475569] dark:text-[#CBD5E1] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] hover:border-slate-300 dark:hover:border-[#37404B] shadow-subtle transition-all duration-150 text-left font-sans outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/30 cursor-pointer"
        >
          <div className="flex items-center gap-2.5 text-[#8591A5] dark:text-[#7A8699] truncate">
            <Search className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline-block text-[13px] text-[#475569] dark:text-[#CBD5E1] truncate font-medium">
              Search trends, narratives, communities...
            </span>
            <span className="sm:hidden text-[13px] text-[#475569] dark:text-[#CBD5E1]">Search</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-mono bg-[#E5E9F4] dark:bg-[#191F26] border border-transparent dark:border-[#2B323A] text-[#8591A5] dark:text-[#94A3B8] rounded-full">
            /
          </kbd>
        </button>

        {/* Analyst Profile Menu */}
        <UserMenu />
      </div>
    </header>
  );
};
