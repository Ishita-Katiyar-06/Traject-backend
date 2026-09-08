/**
 * Universal Scroll-to-Top Utility
 * Scrolls both the primary application container (#main-content) and window/document to the start.
 */
export const scrollToTop = (smooth: boolean = false): void => {
  const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';

  // 1. Primary AppShell scrollable canvas
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    try {
      mainContent.scrollTo({ top: 0, left: 0, behavior });
    } catch {
      mainContent.scrollTop = 0;
    }
  }

  // 2. Window viewport
  if (typeof window !== 'undefined') {
    try {
      window.scrollTo({ top: 0, left: 0, behavior });
    } catch {
      window.scroll(0, 0);
    }
  }

  // 3. Root document elements fallback
  if (typeof document !== 'undefined') {
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }
  }
};
