import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { TrendingUp, Sparkles, Shield, Sun, Moon, Search } from 'lucide-react';
import { UserMenu } from '../components/navigation/UserMenu';
import { GlobalSearch } from '../components/navigation/GlobalSearch';
import { PageContainer } from '../layout/PageContainer';
import { useNavigation } from '../contexts/NavigationContext';
import { useTheme } from '../contexts/ThemeContext';
import { useRole } from '../contexts/RoleContext';
import { usePrefersReducedMotion, pageEnter } from '../utils/motion';
import { scrollToTop } from '../utils/scroll';

interface PublicNavItemDef {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PUBLIC_NAV_ITEMS: PublicNavItemDef[] = [
  { name: 'Trends', path: '/trends', icon: TrendingUp },
  { name: 'Emerging Trends', path: '/emerging-trends', icon: Sparkles },
];

/**
 * PublicShell
 * 
 * Provides the identical high-polish Crextio / Apple aesthetic as the admin console,
 * with seamless scrolling and layout consistency, but exclusively surfaces public intelligence
 * (Trends and Emerging Trends) without classified telemetry, alert banners, or institutional badges.
 */
export const PublicShell: React.FC = () => {
  const { openSearch, isSearchOpen, closeSearch } = useNavigation();
  const { isDark, toggleTheme } = useTheme();
  const { isNtroAnalyst } = useRole();
  const location = useLocation();
  const prefersReduced = usePrefersReducedMotion();

  const mainRef = useRef<HTMLElement | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  // Smooth sliding pill indicator
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [indicator, setIndicator] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  const updateIndicator = React.useCallback((targetPath?: string) => {
    const currentPath = targetPath || location.pathname;
    const activeItem =
      PUBLIC_NAV_ITEMS.find((item) =>
        currentPath === item.path || currentPath.startsWith(`${item.path}/`)
      ) || PUBLIC_NAV_ITEMS[0];

    const el = itemRefs.current.get(activeItem.path);
    const container = navRef.current;
    if (el && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setIndicator({
        left: elRect.left - containerRect.left,
        width: elRect.width,
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

  // Scroll detection on main-content container
  useEffect(() => {
    const mainEl = document.getElementById('main-content');
    const updateScroll = () => {
      const top = mainEl ? mainEl.scrollTop : 0;
      setIsScrolled(top > 12);
    };

    updateScroll();
    if (mainEl) {
      mainEl.addEventListener('scroll', updateScroll, { passive: true });
    }
    return () => {
      if (mainEl) {
        mainEl.removeEventListener('scroll', updateScroll);
      }
    };
  }, [location.pathname]);

  // Scroll to top on route change
  useEffect(() => {
    scrollToTop(false);
    const rafId = requestAnimationFrame(() => {
      scrollToTop(false);
    });
    return () => cancelAnimationFrame(rafId);
  }, [location.pathname, location.search]);

  return (
    <div className="h-screen w-full bg-[#FAF8F3] dark:bg-[#0D1014] text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased overflow-hidden relative">
      {/* Ambient Continuous Radiance */}
      <div className="pointer-events-none absolute top-0 right-0 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_top_right,rgba(254,243,199,0.45),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.06),transparent_70%)] z-0" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-[700px] h-[600px] bg-[radial-gradient(ellipse_at_bottom_left,rgba(254,240,138,0.20),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_bottom_left,rgba(251,191,36,0.04),transparent_65%)] z-0" />

      {/* Identical Premium Top Navigation Header */}
      <header
        aria-label="Public Top Navigation"
        className={`fixed top-0 left-0 right-0 h-16 shrink-0 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 z-header font-sans select-none transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-in-out ${
          isScrolled
            ? 'bg-[#FAF8F3]/80 dark:bg-[#0D1014]/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/[0.08] shadow-[0_4px_30px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.45)]'
            : 'bg-transparent border-b border-transparent shadow-none backdrop-blur-none'
        }`}
      >
        {/* LEFT: Brand Capsule Pill */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/trends"
            aria-label="TRAJECT Home"
            onClick={() => scrollToTop(true)}
            className="rounded-full border border-black/25 dark:border-white/25 bg-white/60 dark:bg-[#181C22]/60 backdrop-blur-md px-5 sm:px-6 h-10 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-black/40 dark:hover:border-white/40 transition-colors flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-slate-400 group"
          >
            <span className="font-brand text-[17px] sm:text-[18px] font-normal text-slate-900 dark:text-white tracking-[-0.015em] leading-none select-none">
              Traject
            </span>
          </Link>
          <span className="hidden sm:inline-flex text-[11px] font-mono font-medium text-slate-400 dark:text-slate-500 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800">
            Public Portal
          </span>
        </div>

        {/* RIGHT: Shifted Navigation Pill & Utilities */}
        <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
          {/* Primary Navigation Pill Container */}
          <nav
            ref={navRef}
            aria-label="Public Navigation"
            className="flex items-center rounded-full bg-white/80 dark:bg-[#181C22]/80 backdrop-blur-md border border-slate-200/90 dark:border-[#2B323D] p-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] shrink-0 relative isolate"
          >
            {/* Sliding Pill Indicator */}
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

            {PUBLIC_NAV_ITEMS.map((item) => {
              const isActive =
                location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

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
                </NavLink>
              );
            })}
          </nav>

          {/* If NTRO Analyst is viewing Public Shell, offer direct return to NTRO Console */}
          {isNtroAnalyst && (
            <Link
              to="/console/overview"
              aria-label="Return to NTRO Console"
              className="hidden lg:inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full text-xs font-mono font-semibold bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-500/20 transition-all shadow-xs"
            >
              <Shield className="w-3.5 h-3.5 text-blue-500" />
              <span>NTRO Console →</span>
            </Link>
          )}

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

          {/* User Profile Avatar */}
          <UserMenu triggerStyle="circle" />

          {/* Theme Toggle */}
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
        </div>
      </header>

      {/* Independently Scrollable Page Canvas - Exact Same Container as Admin Console */}
      <main
        ref={mainRef}
        id="main-content"
        tabIndex={-1}
        className="flex-1 overflow-y-auto overflow-x-hidden bg-transparent pt-16 pb-16 md:pb-10 focus:outline-none relative z-10"
      >
        <PageContainer>
          <motion.div
            key={location.pathname}
            variants={pageEnter}
            initial="initial"
            animate="animate"
            className="w-full min-h-full"
          >
            <Outlet />
          </motion.div>
        </PageContainer>
      </main>

      {/* Global Search Overlay */}
      <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
    </div>
  );
};
