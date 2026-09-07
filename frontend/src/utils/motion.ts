import type { Variants, Transition } from 'motion/react';

/**
 * Standard timing durations (in seconds) for TRAJECT UI
 * Kept restrained and fast for an intelligence/defense dashboard feel
 */
export const MOTION_DURATIONS = {
  instant: 0.05,
  fast: 0.12,
  normal: 0.18,
  page: 0.22,
  modal: 0.18,
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
};

/**
 * Page level transitions
 * Subtle opacity fade with minute 4px vertical shift to avoid jarring layout movement
 */
export const pageEnter: Variants = {
  initial: {
    opacity: 0,
    y: 8,
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
      duration: MOTION_DURATIONS.normal,
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
      duration: MOTION_DURATIONS.normal,
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
      duration: MOTION_DURATIONS.normal,
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
 * Modal container entrance: subtle scale from 98% and fade in
 */
export const modalEnter: Variants = {
  initial: {
    opacity: 0,
    scale: 0.98,
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
    scale: 0.98,
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
    scale: 0.97,
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
    scale: 0.97,
    y: -4,
    transition: {
      duration: 0.08,
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
    y: 4,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.fast,
      ease: MOTION_EASINGS.out,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.08,
    },
  },
};

/**
 * Layout transition parameters for animated container resizes
 */
export const layoutTransition: Transition = {
  type: 'tween',
  duration: MOTION_DURATIONS.normal,
  ease: MOTION_EASINGS.inOut,
};

/**
 * Helper to check if user has prefers-reduced-motion set in browser
 */
export const isReducedMotionActive = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};
