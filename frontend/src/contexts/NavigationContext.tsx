import React, { createContext, useContext, useState, useEffect } from 'react';

export interface NavigationContextType {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  openSearch: () => void;
  closeSearch: () => void;
  isMobileMoreOpen: boolean;
  setIsMobileMoreOpen: (open: boolean) => void;
  closeMobileMore: () => void;
  toggleMobileMore: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

const SIDEBAR_STORAGE_KEY = 'tessera_sidebar_collapsed';

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Responsive sidebar initialization:
  // >= 1200px: expanded by default (unless user stored preference)
  // 768px - 1199px: collapsed by default
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored !== null) {
        return JSON.parse(stored);
      }
      return window.innerWidth < 1200;
    }
    return false;
  });

  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState<boolean>(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const setSidebarCollapsed = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(collapsed));
  };

  const openSearch = () => {
    setIsSearchOpen(true);
    setIsMobileMoreOpen(false);
  };
  const closeSearch = () => setIsSearchOpen(false);

  const closeMobileMore = () => setIsMobileMoreOpen(false);

  const toggleMobileMore = () => {
    setIsMobileMoreOpen((prev) => {
      const next = !prev;
      if (next) setIsSearchOpen(false);
      return next;
    });
  };

  // Keyboard shortcut listener:
  // '/' -> Open search
  // 'b' or 'B' -> Toggle sidebar collapse (when not typing in an input)
  // 'Escape' -> Close search and mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        (activeElement as HTMLElement)?.isContentEditable;

      if (!isInput) {
        if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
          e.preventDefault();
          setIsSearchOpen(true);
          setIsMobileMoreOpen(false);
        } else if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          toggleSidebar();
        }
      }

      if (e.key === 'Escape') {
        if (isSearchOpen) setIsSearchOpen(false);
        if (isMobileMoreOpen) setIsMobileMoreOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, isMobileMoreOpen]);

  // Handle window resizing breakpoint adaptation
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1200) {
        // Automatically collapse on tablet width if no user override
        const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (stored === null) {
          setIsSidebarCollapsed(true);
        }
      }
      if (window.innerWidth >= 768 && isMobileMoreOpen) {
        setIsMobileMoreOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileMoreOpen]);

  return (
    <NavigationContext.Provider
      value={{
        isSidebarCollapsed,
        toggleSidebar,
        setSidebarCollapsed,
        isSearchOpen,
        setIsSearchOpen,
        openSearch,
        closeSearch,
        isMobileMoreOpen,
        setIsMobileMoreOpen,
        closeMobileMore,
        toggleMobileMore,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
