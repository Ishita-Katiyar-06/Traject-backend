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

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState<boolean>(false);

  const toggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);
  const setSidebarCollapsed = (collapsed: boolean) => setIsSidebarCollapsed(collapsed);

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
  // '/' or 'Cmd/Ctrl + K' -> Open search
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
