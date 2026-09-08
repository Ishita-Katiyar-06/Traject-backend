import { useState, useEffect } from 'react';
import type { Variants, Transition } from 'motion/react';

/**
 * Standard timing durations (in seconds) for TRAJECT UI.
 * Standardized across the application for a quiet, sophisticated, and responsive intelligence interface.
 */
export const MOTION_DURATIONS = {
  instant: 0.05,
  fast: 0.15, // 150ms
  standard: 0.25, // 250ms
  content: 0.38, // 380ms
  complexVisualization: 0.60, // 600ms
  page: 0.22, // 220ms
  stagger: 0.06, // 60ms
  hover: 0.15, // 150ms
  modal: 0.20, // 200ms
  drawer: 0.28, // 280ms
  normal: 0.22, // alias for standard/page
} as const;

/**
 * Standard cubic-bezier curves for natural, professional movement
 */
export const MOTION_EASINGS = {
  // Smooth decelerate for entrance
  out: [0.16, 1, 0.3, 1] as const,
  // Standard ease-in-out for layout / dimensions
  inOut: [0.4, 0, 0.2, 1] as const,
  // Crisp ease-in for exits
  in: [0.32, 0, 0.67, 0] as const,
  // Soft natural curve
  soft: [0.25, 0.1, 0.25, 1] as const,
};

/**
 * Page level transitions
 * Subtle opacity fade with minute 6px vertical shift to avoid jarring layout movement
 */
export const pageEnter: Variants = {
  initial: {
    opacity: 0,
    y: 6,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.page,
      ease: MOTION_EASINGS.out,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: MOTION_DURATIONS.fast,
      ease: MOTION_EASINGS.in,
    },
  },
};

/**
 * Stagger parent container for coordinated reveals (KPIs, lists, cards)
 */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: MOTION_DURATIONS.stagger,
      delayChildren: 0.02,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

/**
 * Faster stagger container for compact elements
 */
export const staggerFast: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.01,
    },
  },
};

/**
 * KPI card entrance: smooth subtle rise and fade-in
 */
export const kpiCardEnter: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.standard,
      ease: MOTION_EASINGS.out,
    },
  },
};

/**
 * Card and section entrance
 */
export const sectionEnter: Variants = {
  initial: {
    opacity: 0,
    y: 6,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.standard,
      ease: MOTION_EASINGS.out,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: MOTION_DURATIONS.fast,
      ease: MOTION_EASINGS.in,
    },
  },
};

/**
 * Clean fade-in for tab panels, badges, or state changes
 */
export const fadeIn: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: MOTION_DURATIONS.fast,
      ease: MOTION_EASINGS.out,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: MOTION_DURATIONS.fast,
      ease: MOTION_EASINGS.in,
    },
  },
};

/**
 * Live badge update reveal (e.g. +626 new)
 */
export const badgeSettle: Variants = {
  initial: {
    opacity: 0,
    scale: 0.94,
    y: -3,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.standard,
      ease: MOTION_EASINGS.out,
    },
  },
};

/**
 * Subtle directional slide
 */
export const subtleSlide: Variants = {
  initial: {
    opacity: 0,
    x: -6,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: MOTION_DURATIONS.standard,
      ease: MOTION_EASINGS.out,
    },
  },
  exit: {
    opacity: 0,
    x: -4,
    transition: {
      duration: MOTION_DURATIONS.fast,
      ease: MOTION_EASINGS.in,
    },
  },
};

/**
 * Modal backdrop fade
 */
export const modalBackdrop: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: MOTION_DURATIONS.modal,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: MOTION_DURATIONS.fast,
      ease: 'easeIn',
    },
  },
};

/**
 * Modal container entrance: subtle scale from 98.5% and fade in
 */
export const modalEnter: Variants = {
  initial: {
    opacity: 0,
    scale: 0.985,
    y: 4,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.modal,
      ease: MOTION_EASINGS.out,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.985,
    y: 4,
    transition: {
      duration: MOTION_DURATIONS.fast,
      ease: MOTION_EASINGS.in,
    },
  },
};

/**
 * Dropdown menu entrance
 */
export const dropdownMenu: Variants = {
  initial: {
    opacity: 0,
    scale: 0.98,
    y: -4,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.fast,
      ease: MOTION_EASINGS.out,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -4,
    transition: {
      duration: 0.1,
      ease: MOTION_EASINGS.in,
    },
  },
};

/**
 * List item stagger or entry
 */
export const listItemEnter: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.standard,
      ease: MOTION_EASINGS.out,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: MOTION_DURATIONS.fast,
      ease: MOTION_EASINGS.in,
    },
  },
};

/**
 * Slide-over drawer entrance from right edge
 */
export const drawerSlideRight: Variants = {
  initial: {
    x: '100%',
    opacity: 0.4,
  },
  animate: {
    x: 0,
    opacity: 1,
    transition: {
      duration: MOTION_DURATIONS.drawer,
      ease: MOTION_EASINGS.out,
    },
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: {
      duration: MOTION_DURATIONS.fast,
      ease: MOTION_EASINGS.in,
    },
  },
};

/**
 * Slide-over drawer entrance from left edge
 */
export const drawerSlideLeft: Variants = {
  initial: {
    x: '-100%',
    opacity: 0.4,
  },
  animate: {
    x: 0,
    opacity: 1,
    transition: {
      duration: MOTION_DURATIONS.drawer,
      ease: MOTION_EASINGS.out,
    },
  },
  exit: {
    x: '-100%',
    opacity: 0,
    transition: {
      duration: MOTION_DURATIONS.fast,
      ease: MOTION_EASINGS.in,
    },
  },
};

/**
 * Tooltip fade and slight translate
 */
export const tooltipAnimation: Variants = {
  initial: {
    opacity: 0,
    scale: 0.97,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.14,
      ease: MOTION_EASINGS.out,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: {
      duration: 0.08,
      ease: MOTION_EASINGS.in,
    },
  },
};

/**
 * Layout transition parameters for animated container resizes
 */
export const layoutTransition: Transition = {
  type: 'tween',
  duration: MOTION_DURATIONS.standard,
  ease: MOTION_EASINGS.inOut,
};

/**
 * Helper to check if user has prefers-reduced-motion set in browser
 */
export const isReducedMotionActive = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * React hook to reactively track prefers-reduced-motion
 */
export const usePrefersReducedMotion = (): boolean => {
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => isReducedMotionActive());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(mediaQuery.matches);

    updateMotion();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateMotion);
      return () => mediaQuery.removeEventListener('change', updateMotion);
    } else if (typeof (mediaQuery as any).addListener === 'function') {
      (mediaQuery as any).addListener(updateMotion);
      return () => (mediaQuery as any).removeListener(updateMotion);
    }
  }, []);

  return reducedMotion;
};
