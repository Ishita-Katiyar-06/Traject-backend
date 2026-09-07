import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { PageContainer } from './PageContainer';
import { MobileNavigation } from './MobileNavigation';
import { GlobalSearch } from '../components/navigation/GlobalSearch';
import { useNavigation } from '../contexts/NavigationContext';
import { pageEnter } from '../utils/motion';

export const AppShell: React.FC = () => {
  const { isSearchOpen, closeSearch } = useNavigation();
  const location = useLocation();

  return (
    <div className="h-screen w-full bg-bg text-text-primary flex font-sans antialiased overflow-hidden">
      {/* Persistent Left Sidebar (Desktop / Tablet) - fixed to viewport height, never moves on scroll */}
      <Sidebar />

      {/* Main Application Area (Fixed Header + Independently Scrollable Main Content) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header />

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto overflow-x-hidden bg-bg pb-16 md:pb-8 focus:outline-none relative z-0"
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
      </div>

      {/* Global Search Overlay */}
      <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />

      {/* Compact Mobile Navigation (Bottom Bar + More Sheet) */}
      <MobileNavigation />
    </div>
  );
};
