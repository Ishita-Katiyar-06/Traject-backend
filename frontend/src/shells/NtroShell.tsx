import React, { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { TopNavigation } from '../layout/TopNavigation';
import { PageContainer } from '../layout/PageContainer';
import { MobileNavigation } from '../layout/MobileNavigation';
import { GlobalSearch } from '../components/navigation/GlobalSearch';
import { useNavigation } from '../contexts/NavigationContext';
import { LiveStreamProvider } from '../contexts/LiveStreamContext';
import { pageEnter } from '../utils/motion';
import { scrollToTop } from '../utils/scroll';

/**
 * NtroShell
 * 
 * The institutional, restricted console shell for authorized NTRO analysts.
 * Features:
 * - CLEARANCE LEVEL-4 institutional badge
 * - Full telemetry, live stream status, alert banners
 * - Overview, Narratives, Communities, Propagation, Alerts, Data Explorer
 * - Quick action to return to public view
 */
export const NtroShell: React.FC = () => {
  const { isSearchOpen, closeSearch } = useNavigation();
  const location = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);

  // Reset page canvas scroll position to top whenever navigation occurs
  useEffect(() => {
    scrollToTop(false);
    const rafId = requestAnimationFrame(() => {
      scrollToTop(false);
    });
    return () => cancelAnimationFrame(rafId);
  }, [location.pathname, location.search]);

  return (
    <LiveStreamProvider>
      <div className="h-screen w-full bg-[#FAF8F3] dark:bg-[#0D1014] text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased overflow-hidden relative">
        {/* Continuous Ambient Radiance */}
        <div className="pointer-events-none absolute top-0 right-0 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_top_right,rgba(254,243,199,0.45),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.06),transparent_70%)] z-0" />
        <div className="pointer-events-none absolute bottom-0 left-0 w-[700px] h-[600px] bg-[radial-gradient(ellipse_at_bottom_left,rgba(254,240,138,0.20),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_bottom_left,rgba(251,191,36,0.04),transparent_65%)] z-0" />

        {/* Unified Institutional Top Navigation */}
        <TopNavigation />

        {/* Unified Analytical Page Canvas (Independently Scrollable Main Content) */}
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

        {/* Compact Mobile Navigation */}
        <MobileNavigation />
      </div>
    </LiveStreamProvider>
  );
};
