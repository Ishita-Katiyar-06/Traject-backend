import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Search,
  Sun,
  Moon,
  Menu,
} from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAlertsCount } from '../services/alertService';
import { LiveStreamBadge } from '../components/status/LiveStreamBadge';
import { LiveAlertToast } from '../components/feedback/LiveAlertToast';
import { UserMenu } from '../components/navigation/UserMenu';
import { usePrefersReducedMotion } from '../utils/motion';
import { scrollToTop } from '../utils/scroll';

interface NavItemDef {
  name: string;
  path: string;
  showBadge?: boolean;
}

const PRIMARY_NAV_ITEMS: NavItemDef[] = [
  { name: 'Overview', path: '/overview' },
  { name: 'Trends', path: '/trends' },
  { name: 'Emerging Trends', path: '/emerging-trends' },
  { name: 'Narratives', path: '/narratives' },
  { name: 'Communities', path: '/communities' },
  { name: 'Propagation', path: '/propagation' },
  { name: 'Alerts', path: '/alerts', showBadge: true },
  { name: 'Data Explorer', path: '/explorer' },
];

export const TopNavigation: React.FC = () => {
  const { openSearch, toggleMobileMore } = useNavigation();
  const { isDark, toggleTheme } = useTheme();
  const { count: openAlertsCount } = useAlertsCount();
  const location = useLocation();
  const prefersReduced = usePrefersReducedMotion();

  const [isScrolled, setIsScrolled] = useState(false);

  const navRef = React.useRef<HTMLElement>(null);
  const itemRefs = React.useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [indicator, setIndicator] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  const updateIndicator = React.useCallback((targetPath?: string) => {
    const currentPath = targetPath || location.pathname;
    const activeItem =
      PRIMARY_NAV_ITEMS.find((item) =>
        item.path === '/overview'
          ? currentPath === '/' || currentPath === '/overview'
          : currentPath === item.path || currentPath.startsWith(`${item.path}/`)
      ) || PRIMARY_NAV_ITEMS[0];

    const el = itemRefs.current.get(activeItem.path);
    const container = navRef.current;
    if (el && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const newLeft = elRect.left - containerRect.left;
      const newWidth = elRect.width;

      setIndicator({
        left: newLeft,
        width: newWidth,
        ready: true,
      });
    }
  }, [location.pathname]);

  useEffect(() => {
    updateIndicator();
    const handleResize = () => updateIndicator();
    window.addEventListener('resize', handleResize);
    if (document.fonts) {
      document.fonts.ready.then(handleResize);
    }
    return () => window.removeEventListener('resize', handleResize);
  }, [updateIndicator]);

  useEffect(() => {
    const mainEl = document.getElementById('main-content');
    const updateScroll = () => {
      const top = mainEl ? mainEl.scrollTop : (window.pageYOffset || document.documentElement.scrollTop || 0);
      setIsScrolled(top > 12);
    };

    updateScroll();

    if (mainEl) {
      mainEl.addEventListener('scroll', updateScroll, { passive: true });
    }
    window.addEventListener('scroll', updateScroll, { passive: true });

    return () => {
      if (mainEl) {
        mainEl.removeEventListener('scroll', updateScroll);
      }
      window.removeEventListener('scroll', updateScroll);
    };
  }, [location.pathname]);

  return (
    <header
      aria-label="Application Top Navigation"
      className={`fixed top-0 left-0 right-0 h-16 shrink-0 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 z-header font-sans select-none transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-in-out ${
        isScrolled
          ? 'bg-[#FAF8F3]/80 dark:bg-[#0D1014]/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/[0.08] shadow-[0_4px_30px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.45)]'
          : 'bg-transparent border-b border-transparent shadow-none backdrop-blur-none'
      }`}
    >
      {/* =========================================================================
          LEFT: Brand Capsule (Exact Crextio Style Pill)
          ========================================================================= */}
      <div className="flex items-center shrink-0">
        <Link
          to="/overview"
          aria-label="TRAJECT Home"
          onClick={() => scrollToTop(true)}
          className="rounded-full border border-black/25 dark:border-white/25 bg-white/60 dark:bg-[#181C22]/60 backdrop-blur-md px-5 sm:px-6 h-10 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-black/40 dark:hover:border-white/40 transition-colors flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-slate-400 group"
        >
          <span className="font-brand text-[17px] sm:text-[18px] font-normal text-slate-900 dark:text-white tracking-[-0.015em] leading-none select-none">
            Traject
          </span>
        </Link>
      </div>

      {/* =========================================================================
          RIGHT: Shifted Primary Navigation + Utilities (Filling gap, shifted right)
          ========================================================================= */}
      <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
        {/* Primary Navigation Pill Container (Apple segmented control smoothness) */}
        <nav
          ref={navRef}
          aria-label="Primary Workspace Navigation"
          className="hidden lg:flex items-center rounded-full bg-white/80 dark:bg-[#181C22]/80 backdrop-blur-md border border-slate-200/90 dark:border-[#2B323D] p-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] shrink-0 relative isolate"
        >
          {/* Apple Signature Single Persistent Sliding Active Pill */}
          {indicator.ready && (
            <motion.div
              aria-hidden="true"
              className="absolute top-1.5 bottom-1.5 rounded-full bg-[#21252C] dark:bg-[#282E37] border border-black/10 dark:border-white/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.5)] pointer-events-none"
              style={{ zIndex: 0 }}
              initial={false}
              animate={{
                left: indicator.left,
                width: indicator.width,
              }}
              transition={
                prefersReduced
                  ? { duration: 0 }
                  : {
                      type: 'spring',
                      stiffness: 420,
                      damping: 34,
                      mass: 0.7,
                    }
              }
            />
          )}

          {PRIMARY_NAV_ITEMS.map((item) => {
            const isActive =
              item.path === '/overview'
                ? location.pathname === '/' || location.pathname === '/overview'
                : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

            return (
              <NavLink
                key={item.path}
                ref={(el) => {
                  if (el) itemRefs.current.set(item.path, el);
                  else itemRefs.current.delete(item.path);
                }}
                to={item.path}
                aria-label={item.name}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  updateIndicator(item.path);
                  scrollToTop(true);
                }}
                className={`relative px-4 py-2 rounded-full text-[13.5px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-slate-400 whitespace-nowrap flex items-center gap-1.5 select-none transition-colors duration-200 z-10 ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{item.name}</span>

                {/* Subtle badge for alerts if count exists */}
                {item.showBadge && openAlertsCount > 0 && (
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full leading-tight transition-colors duration-200 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}
                  >
                    {openAlertsCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Utilities Dock (Right alongside Navigation Pill) */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Real-time WebSocket Stream Beacon */}
        <div className="hidden xl:flex items-center">
          <LiveStreamBadge />
        </div>

        {/* Live Alert Toast Banner */}
        <LiveAlertToast />

        {/* Command Search Pill */}
        <button
          type="button"
          aria-label="Open command search (/)"
          onClick={openSearch}
          className="flex items-center gap-2 h-10 px-3 sm:px-3.5 rounded-full bg-white/80 dark:bg-[#181C22]/80 backdrop-blur-md border border-slate-300/80 dark:border-[#333C48] hover:border-slate-400 dark:hover:border-slate-500 shadow-[0_1px_3px_rgba(0,0,0,0.05)] text-slate-500 dark:text-slate-400 transition-all outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
        >
          <Search className="w-3.5 h-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
          <span className="hidden md:inline text-[12.5px] font-medium text-slate-600 dark:text-slate-300">
            Search...
          </span>
          <kbd className="hidden lg:inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full">
            /
          </kbd>
        </button>

        {/* User Profile Avatar (Circular capsule matching reference image) */}
        <UserMenu triggerStyle="circle" />

        {/* Theme Toggle (Circular capsule) */}
        <button
          type="button"
          aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          onClick={(e) => {
            toggleTheme();
            e.currentTarget.blur();
          }}
          className="w-10 h-10 rounded-full border border-slate-300/80 dark:border-[#333C48] bg-white/80 dark:bg-[#181C22]/80 backdrop-blur-md flex items-center justify-center text-slate-700 dark:text-slate-300 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:bg-slate-50 dark:hover:bg-[#20262E] hover:border-slate-400 dark:hover:border-slate-500 transition-colors shrink-0 cursor-pointer"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* Mobile / Tablet Drawer Toggle */}
        <button
          type="button"
          aria-label="Toggle navigation drawer"
          onClick={toggleMobileMore}
          className="flex lg:hidden items-center justify-center w-10 h-10 rounded-full border border-slate-300/80 dark:border-[#333C48] bg-white/80 dark:bg-[#181C22]/80 backdrop-blur-md text-slate-700 dark:text-slate-300 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:bg-slate-50 dark:hover:bg-[#20262E] transition-colors shrink-0 cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>
      </div>
    </header>
  );
};
