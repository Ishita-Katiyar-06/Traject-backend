import React from 'react';
import {
  Activity,
  Hash,
  GitBranch,
  Users,
  Share2,
  AlertCircle,
  Database,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';
import { useTheme } from '../contexts/ThemeContext';
import { NavigationItem } from '../components/navigation/NavigationItem';
import { Tooltip } from '../components/ui/Tooltip';
import { useAlertsCount } from '../services/alertService';

export const Sidebar: React.FC = () => {
  const { isSidebarCollapsed, toggleSidebar } = useNavigation();
  const { theme, isDark, setTheme, toggleTheme } = useTheme();
  const { count: openAlertsCount } = useAlertsCount();

  return (
    <aside
      aria-label="Application sidebar"
      className={`hidden md:flex flex-col h-full border-r border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#13171C] transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0 select-none z-sidebar overflow-hidden ${
        isSidebarCollapsed ? 'w-[72px]' : 'w-[264px]'
      }`}
    >
      {/* Top Branding Area */}
      <div className="h-16 shrink-0 flex items-center justify-between px-5 border-b border-[rgba(228,233,245,0.85)] dark:border-[#252B32]">
        {!isSidebarCollapsed ? (
          <div className="flex items-center gap-3.5">
            {/* Clean Authoritative Brand Mark */}
            <div className="w-9 h-9 rounded-[13px] bg-[#2F65F6] flex items-center justify-center text-white font-bold font-mono text-[15px] shadow-sm shrink-0">
              T
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[15px] font-bold tracking-wide font-sans text-[#111727] dark:text-[#F8FAFC] leading-tight">
                TRAJECT
              </span>
              <span className="text-[11px] font-mono tracking-tight text-[#8591A5] dark:text-[#94A3B8] leading-tight truncate mt-0.5">
                Social Intelligence
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <Tooltip content="TRAJECT Social Intelligence" position="right" delay={150}>
              <div
                onClick={toggleSidebar}
                className="w-10 h-10 rounded-[12px] bg-[#2F65F6] flex items-center justify-center text-white font-bold font-mono text-[16px] shadow-subtle cursor-pointer hover:bg-[#2152DE] transition-colors"
              >
                T
              </div>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Semantic Navigation Link List */}
      <nav
        aria-label="Main Navigation"
        className="flex-1 min-h-0 py-4 px-3.5 space-y-4 overflow-y-auto overflow-x-hidden"
      >
        {/* Section 1: MONITOR */}
        <div>
          {!isSidebarCollapsed && (
            <div className="text-[11px] font-sans uppercase font-bold tracking-wider text-[#8591A5] dark:text-[#7A8699] px-3.5 pb-2 select-none">
              Monitor
            </div>
          )}
          <div className="space-y-1.5">
            <NavigationItem
              name="Overview"
              path="/overview"
              icon={Activity}
              isCollapsed={isSidebarCollapsed}
            />
            <NavigationItem
              name="Trends"
              path="/trends"
              icon={Hash}
              isCollapsed={isSidebarCollapsed}
            />
            <NavigationItem
              name="Narratives"
              path="/narratives"
              icon={GitBranch}
              isCollapsed={isSidebarCollapsed}
            />
            <NavigationItem
              name="Communities"
              path="/communities"
              icon={Users}
              isCollapsed={isSidebarCollapsed}
            />
            <NavigationItem
              name="Propagation"
              path="/propagation"
              icon={Share2}
              isCollapsed={isSidebarCollapsed}
            />
            <NavigationItem
              name="Alerts"
              path="/alerts"
              icon={AlertCircle}
              badge={openAlertsCount > 0 ? openAlertsCount : undefined}
              isCollapsed={isSidebarCollapsed}
            />
          </div>
        </div>

        {/* Section 2: ANALYSIS */}
        <div className="pt-2 border-t border-[rgba(228,233,245,0.7)] dark:border-[#20262E]">
          {!isSidebarCollapsed && (
            <div className="text-[11px] font-sans uppercase font-bold tracking-wider text-[#8591A5] dark:text-[#7A8699] px-3.5 pt-2 pb-2 select-none">
              Analysis
            </div>
          )}
          <div className="space-y-1.5">
            <NavigationItem
              name="Data Explorer"
              path="/explorer"
              icon={Database}
              isCollapsed={isSidebarCollapsed}
            />
          </div>
        </div>

      </nav>

      {/* Bottom Footer & Theme Switcher */}
      <div className="shrink-0 p-3.5 border-t border-[rgba(228,233,245,0.85)] dark:border-[#252B32] space-y-2.5">
        {!isSidebarCollapsed ? (
          <>
            {/* System Status Operational Indicator */}
            <div className="flex items-center gap-2 px-1 text-[11px] font-mono text-[#8591A5] dark:text-[#94A3B8]">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span>System Operational</span>
            </div>

            {/* Theme Toggle Button Row */}
            <div className="flex items-center justify-between p-1 bg-[#F6F8FC] dark:bg-[#161B21] rounded-[12px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32]">
              <button
                type="button"
                onClick={(e) => {
                  setTheme('light');
                  e.currentTarget.blur();
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[9px] text-[12px] font-medium font-sans transition-colors duration-150 cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white text-[#2F65F6] shadow-subtle dark:bg-[#1D232A] dark:text-[#F8FAFC]'
                    : 'text-[#8591A5] hover:text-[#111727] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  setTheme('dark');
                  e.currentTarget.blur();
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[9px] text-[12px] font-medium font-sans transition-colors duration-150 cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-white text-[#2F65F6] shadow-subtle dark:bg-[#1D232A] dark:text-[#F8FAFC]'
                    : 'text-[#8591A5] hover:text-[#111727] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
            </div>

            {/* Version & Collapse Toggle */}
            <div className="flex items-center justify-between pt-0.5 px-1">
              <span className="text-[11px] font-mono text-[#8591A5] dark:text-[#7A8699]">
                v0.2.0 • {isDark ? 'Dark' : 'Light'}
              </span>
              <button
                type="button"
                aria-label="Collapse sidebar (B)"
                title="Collapse sidebar (B)"
                onClick={(e) => {
                  toggleSidebar();
                  e.currentTarget.blur();
                }}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[#475569] dark:text-[#94A3B8] hover:text-[#111727] dark:hover:text-[#F8FAFC] hover:bg-[#F1F4F9] dark:hover:bg-[#1D232A] transition-colors duration-fast text-small font-sans cursor-pointer"
              >
                <kbd className="text-[10px] font-mono text-[#8591A5] dark:text-[#94A3B8] bg-[#E5E9F4] dark:bg-[#191F26] border border-transparent dark:border-[#2B323A] px-1.5 py-0.2 rounded-full">
                  B
                </kbd>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : (
          <div className="w-full flex flex-col items-center gap-2">
            {/* In collapsed mode, compact theme toggle button */}
            <Tooltip content={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'} position="right" delay={150}>
              <button
                type="button"
                aria-label="Toggle theme"
                onClick={(e) => {
                  toggleTheme();
                  e.currentTarget.blur();
                }}
                className="flex items-center justify-center w-10 h-10 rounded-[12px] text-[#475569] dark:text-[#94A3B8] hover:text-[#2F65F6] dark:hover:text-[#F8FAFC] bg-[#F8FAFD] dark:bg-[#161B21] hover:bg-[#EFF4FE] dark:hover:bg-[#1F252D] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] hover:border-[#2F65F6]/40 dark:hover:border-[#37404B] transition-colors duration-150 shadow-subtle dark:shadow-none cursor-pointer"
              >
                {isDark ? <Sun className="w-4 h-4 text-[#FBBF24]" /> : <Moon className="w-4 h-4 text-[#2F65F6]" />}
              </button>
            </Tooltip>

            {/* Expand toggle */}
            <button
              type="button"
              aria-label="Expand sidebar (B)"
              title="Expand sidebar (B)"
              onClick={(e) => {
                toggleSidebar();
                e.currentTarget.blur();
              }}
              className="flex items-center justify-center w-10 h-10 rounded-[12px] text-[#475569] dark:text-[#94A3B8] hover:text-[#2F65F6] dark:hover:text-[#F8FAFC] bg-[#F8FAFD] dark:bg-[#161B21] hover:bg-[#EFF4FE] dark:hover:bg-[#1F252D] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] hover:border-[#2F65F6]/40 dark:hover:border-[#37404B] transition-all shadow-subtle dark:shadow-none group cursor-pointer"
            >
              <ChevronRight
                className="w-4 h-4 text-[#8591A5] dark:text-[#94A3B8] group-hover:text-[#111727] dark:group-hover:text-[#F8FAFC] transition-transform group-hover:translate-x-0.5"
                strokeWidth={2.2}
              />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
