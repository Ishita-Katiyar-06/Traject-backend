import React from 'react';
import { Search } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';
import { SystemStatus } from '../components/status/SystemStatus';
import { UserMenu } from '../components/navigation/UserMenu';

export const Header: React.FC = () => {
  const { openSearch } = useNavigation();

  return (
    <header
      aria-label="Application header"
      className="h-16 shrink-0 border-b border-[rgba(228,233,245,0.85)] bg-[#EEF1F8]/95 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 relative z-50 font-sans"
    >
      {/* Left: Project Branding always at the top (removes ambiguous route nav title) */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile: App Name & Geometric Logo Mark */}
        <div className="flex md:hidden items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#60A5FA] flex items-center justify-center shadow-xs">
            <span className="w-2 h-2 rounded-[2px] bg-white transform rotate-45" />
          </div>
          <span className="text-[15px] font-bold tracking-wider font-sans text-[#111727] leading-tight">
            TESSERA
          </span>
        </div>

        {/* Desktop: Keep Project Name always visible at the top */}
        <div className="hidden md:flex items-center gap-2 min-w-0">
          <span className="text-[17px] font-bold text-[#111727] font-sans leading-tight truncate tracking-tight">
            TESSERA
          </span>
        </div>
      </div>

      {/* Right Area: System Status, Search Trigger, Notifications, User Menu */}
      <div className="flex items-center gap-3">
        {/* Header System Status */}
        <div className="hidden md:flex items-center">
          <SystemStatus />
        </div>

        {/* Global Search Trigger (Pill Shaped) */}
        <button
          type="button"
          aria-label="Search Tessera (/)"
          onClick={openSearch}
          className="flex items-center justify-between h-10 px-3.5 sm:w-60 md:w-72 rounded-full bg-white hover:bg-[#F8FAFD] text-[#475569] border border-[rgba(228,233,245,0.85)] hover:border-slate-300 shadow-xs transition-all duration-150 text-left font-sans outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/40 cursor-pointer"
        >
          <div className="flex items-center gap-2.5 text-[#8591A5] truncate">
            <Search className="w-4 h-4 shrink-0 text-[#8591A5]" />
            <span className="hidden sm:inline-block text-[13px] text-[#475569] truncate font-medium">
              Search topics, signals, narratives...
            </span>
            <span className="sm:hidden text-[13px] text-[#475569]">Search</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-mono bg-[#F1F4F9] border border-[rgba(228,233,245,0.85)] text-[#8591A5] rounded-full shadow-2xs">
            /
          </kbd>
        </button>

        {/* User / Account Menu */}
        <UserMenu />
      </div>
    </header>
  );
};
