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
  ShieldCheck,
  Settings,
  Sun,
  Moon,
  X,
} from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';
import { useTheme } from '../contexts/ThemeContext';
import { SystemStatus } from '../components/status/SystemStatus';
import { useAlertsCount } from '../services/alertService';

const PRIMARY_BOTTOM_ITEMS = [
  { name: 'Overview', path: '/overview', icon: Activity },
  { name: 'Topics', path: '/topics', icon: Hash },
  { name: 'Narratives', path: '/narratives', icon: GitBranch },
  { name: 'Alerts', path: '/alerts', icon: AlertCircle },
];

const MORE_SECONDARY_ITEMS = [
  { name: 'Communities', path: '/communities', icon: Users },
  { name: 'Propagation', path: '/propagation', icon: Share2 },
  { name: 'Data Explorer', path: '/explorer', icon: Database },
  { name: 'Investigation', path: '/investigation', icon: ShieldCheck },
  { name: 'Settings', path: '/settings', icon: Settings },
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

  return (
    <>
      {/* "More" Secondary Drawer Overlay - Positioned cleanly above bottom bar */}
      {isMobileMoreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Additional Navigation"
          className="fixed inset-0 bottom-16 z-[60] md:hidden flex flex-col justify-end bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-150"
          onClick={() => setIsMobileMoreOpen(false)}
        >
          <div
            className="w-full bg-white border-t border-[rgba(228,233,245,0.9)] rounded-t-[26px] p-5 space-y-3.5 shadow-2xl max-h-[calc(80vh-4rem)] overflow-y-auto font-sans transition-colors duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Title & Close Button */}
            <div className="flex items-center justify-between pb-2 border-b border-[rgba(228,233,245,0.85)]">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold text-[#111727]">
                  Navigation Menu
                </span>
              </div>
              <button
                type="button"
                aria-label="Close navigation sheet"
                onClick={() => setIsMobileMoreOpen(false)}
                className="p-1.5 rounded-full text-[#8591A5] hover:text-[#111727] hover:bg-[#F1F4F9] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* System Status Banner */}
            <div className="py-0.5">
              <SystemStatus className="w-full justify-center" />
            </div>

            {/* Secondary Navigation Links */}
            <nav aria-label="Secondary Navigation" className="space-y-1">
              {MORE_SECONDARY_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMoreOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] text-[13px] font-sans transition-colors ${
                        isActive
                          ? 'bg-[#2F65F6]/10 text-[#2F65F6] font-semibold'
                          : 'text-[#475569] hover:text-[#111727] hover:bg-[#F1F4F9]'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 text-[#8591A5]" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </nav>

            {/* Theme Toggle Section (Mobile) */}
            <div className="pt-2.5 border-t border-[rgba(228,233,245,0.85)] space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[12px] font-semibold text-[#8591A5]">Appearance</span>
                <span className="text-[11px] font-mono text-[#8591A5]">
                  v0.2.0 • {isDark ? 'Dark' : 'Light'}
                </span>
              </div>
              <div className="flex items-center justify-between p-1 bg-[#F8FAFD] dark:bg-[#11151A] rounded-[14px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32]">
                <button
                  type="button"
                  onClick={(e) => {
                    setTheme('light');
                    e.currentTarget.blur();
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[10px] text-[12px] font-semibold font-sans transition-colors duration-150 ${
                    theme === 'light'
                      ? 'bg-white text-[#2F65F6] shadow-xs dark:bg-[#1D232A] dark:text-[#F8FAFC] dark:shadow-none'
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
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[10px] text-[12px] font-semibold font-sans transition-colors duration-150 ${
                    theme === 'dark'
                      ? 'bg-white text-[#2F65F6] shadow-xs dark:bg-[#1D232A] dark:text-[#F8FAFC] dark:shadow-none'
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
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-[rgba(228,233,245,0.85)] flex items-center justify-around px-2 z-header select-none shadow-sm"
      >
        {PRIMARY_BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={(e) => {
                setIsMobileMoreOpen(false);
                e.currentTarget.blur();
              }}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-sans transition-colors ${
                  isActive
                    ? 'text-[#2F65F6] font-semibold'
                    : 'text-[#8591A5] hover:text-[#111727]'
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
                    <span className="absolute top-0 left-3 right-3 h-[2.5px] bg-[#2F65F6] rounded-full" />
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
          className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-sans transition-colors ${
            isMobileMoreOpen ? 'text-[#2F65F6] font-semibold' : 'text-[#8591A5] hover:text-[#111727]'
          }`}
        >
          <MoreHorizontal className="w-4 h-4" />
          <span className="mt-1 leading-none">More</span>
        </button>
      </nav>
    </>
  );
};
