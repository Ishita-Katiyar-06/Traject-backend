import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  Hash,
  AlertCircle,
  MoreHorizontal,
  GitBranch,
  Users,
  Share2,
  Database,
  TrendingUp,
  Sun,
  Moon,
  X,
} from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';
import { useTheme } from '../contexts/ThemeContext';
import { SystemStatus } from '../components/status/SystemStatus';
import { useAlertsCount } from '../services/alertService';
import { scrollToTop } from '../utils/scroll';

const PRIMARY_BOTTOM_ITEMS = [
  { name: 'Overview', path: '/console/overview', icon: Activity },
  { name: 'Trends', path: '/console/trends', icon: Hash },
  { name: 'Narratives', path: '/console/narratives', icon: GitBranch },
  { name: 'Alerts', path: '/console/alerts', icon: AlertCircle },
];

const ALL_DRAWER_ITEMS = [
  { name: 'Overview', path: '/console/overview', icon: Activity },
  { name: 'Trends', path: '/console/trends', icon: Hash },
  { name: 'Emerging Trends', path: '/console/emerging-trends', icon: TrendingUp },
  { name: 'Narratives', path: '/console/narratives', icon: GitBranch },
  { name: 'Communities', path: '/console/communities', icon: Users },
  { name: 'Propagation', path: '/console/propagation', icon: Share2 },
  { name: 'Alerts', path: '/console/alerts', icon: AlertCircle },
  { name: 'Data Explorer', path: '/console/explorer', icon: Database },
];

export const MobileNavigation: React.FC = () => {
  const { isMobileMoreOpen, setIsMobileMoreOpen, toggleMobileMore } = useNavigation();
  const { theme, isDark, setTheme } = useTheme();
  const { count: openAlertsCount } = useAlertsCount();
  const location = useLocation();

  // Automatically close mobile menu when route changes
  useEffect(() => {
    setIsMobileMoreOpen(false);
  }, [location.pathname]);

  // Keyboard accessibility: Escape to close More sheet
  useEffect(() => {
    if (!isMobileMoreOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMoreOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMoreOpen, setIsMobileMoreOpen]);

  return (
    <>
      {/* Navigation Drawer Overlay - Positioned for mobile and tablet */}
      {isMobileMoreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
          className="fixed inset-0 z-[60] lg:hidden flex flex-col justify-end bg-slate-900/50 backdrop-blur-[3px] transition-opacity duration-150"
          onClick={() => setIsMobileMoreOpen(false)}
        >
          <div
            className="w-full bg-white dark:bg-[#171C22] border-t border-[rgba(228,233,245,0.9)] dark:border-[#2B323A] rounded-t-[24px] p-5 space-y-3.5 shadow-modal max-h-[85vh] overflow-y-auto font-sans transition-colors duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Title & Close Button */}
            <div className="flex items-center justify-between pb-2 border-b border-[rgba(228,233,245,0.85)] dark:border-[#2B323A]">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold text-[#111727] dark:text-[#F8FAFC]">
                  Navigation Menu
                </span>
              </div>
              <button
                type="button"
                aria-label="Close navigation sheet"
                onClick={() => setIsMobileMoreOpen(false)}
                className="p-1.5 rounded-full text-[#8591A5] hover:text-[#111727] dark:hover:text-[#F8FAFC] hover:bg-[#F1F4F9] dark:hover:bg-[#191F26] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* System Status Banner */}
            <div className="py-0.5">
              <SystemStatus className="w-full justify-center" />
            </div>

            {/* Complete Navigation Destinations */}
            <nav aria-label="Mobile All Navigation" className="space-y-1">
              {ALL_DRAWER_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => {
                      scrollToTop(true);
                      setIsMobileMoreOpen(false);
                    }}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-[13px] font-sans transition-colors ${
                        isActive
                          ? 'bg-[#2F65F6]/10 dark:bg-[#5878C7]/15 text-[#2F65F6] dark:text-[#93C5FD] font-semibold'
                          : 'text-[#475569] dark:text-[#CBD5E1] hover:text-[#111727] dark:hover:text-[#F8FAFC] hover:bg-[#F1F4F9] dark:hover:bg-[#191F26]'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-[#8591A5] dark:text-[#7A8699]" />
                      <span>{item.name}</span>
                    </div>
                    {item.path === '/alerts' && openAlertsCount > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#E9A23B] dark:bg-[#FBBF24] text-white dark:text-[#0D1014] text-[10px] font-bold font-mono flex items-center justify-center leading-none">
                        {openAlertsCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* Theme Toggle Section (Mobile) */}
            <div className="pt-2.5 border-t border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[12px] font-semibold text-[#8591A5] dark:text-[#7A8699]">Appearance</span>
                <span className="text-[11px] font-mono text-[#8591A5] dark:text-[#7A8699]">
                  v0.2.0 • {isDark ? 'Dark' : 'Light'}
                </span>
              </div>
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
            </div>
          </div>
        </div>
      )}

      {/* Fixed Compact Bottom Navigation Bar */}
      <nav
        aria-label="Mobile primary navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-[#13171C]/95 backdrop-blur-md border-t border-[rgba(228,233,245,0.85)] dark:border-[#252B32] flex items-center justify-around px-2 z-header select-none shadow-subtle"
      >
        {PRIMARY_BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={(e) => {
                scrollToTop(true);
                setIsMobileMoreOpen(false);
                e.currentTarget.blur();
              }}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-sans transition-colors ${
                  isActive
                    ? 'text-[#2F65F6] dark:text-[#93C5FD] font-semibold'
                    : 'text-[#8591A5] dark:text-[#7A8699] hover:text-[#111727] dark:hover:text-[#F8FAFC]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon className="w-4 h-4" />
                    {item.path === '/alerts' && openAlertsCount > 0 && (
                      <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-1 rounded-full bg-[#2F65F6] text-white text-[9px] font-bold flex items-center justify-center leading-none">
                        {openAlertsCount}
                      </span>
                    )}
                  </div>
                  <span className="mt-1 leading-none">{item.name}</span>
                  {isActive && (
                    <span className="absolute top-0 left-3 right-3 h-[2.5px] bg-[#2F65F6] dark:bg-[#5878C7] rounded-full" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}

        {/* "More" Trigger */}
        <button
          type="button"
          aria-label="More navigation links"
          aria-expanded={isMobileMoreOpen}
          onClick={(e) => {
            toggleMobileMore();
            e.currentTarget.blur();
          }}
          className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-sans transition-colors cursor-pointer ${
            isMobileMoreOpen
              ? 'text-[#2F65F6] dark:text-[#93C5FD] font-semibold'
              : 'text-[#8591A5] dark:text-[#7A8699] hover:text-[#111727] dark:hover:text-[#F8FAFC]'
          }`}
        >
          <MoreHorizontal className="w-4 h-4" />
          <span className="mt-1 leading-none">More</span>
        </button>
      </nav>
    </>
  );
};
