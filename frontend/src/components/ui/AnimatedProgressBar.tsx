import React, { useState, useEffect } from 'react';
import { usePrefersReducedMotion } from '../../utils/motion';

export interface AnimatedProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  duration?: number; // Duration in ms, default 500ms
  'aria-label'?: string;
}

export const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({
  value,
  max,
  className = '',
  barClassName = 'bg-linear-to-r from-[#2F65F6] via-blue-500 to-emerald-500',
  duration = 500,
  'aria-label': ariaLabel,
}) => {
  const prefersReduced = usePrefersReducedMotion();

  // Normalize target percentage
  const effectiveMax = max !== undefined ? max : value <= 1.0 && value > 0 ? 1.0 : 100;
  const targetPct = Math.min(Math.max((value / effectiveMax) * 100, 0), 100);

  // If reduced motion is active, jump straight to targetPct
  const [currentPct, setCurrentPct] = useState<number>(() => (prefersReduced ? targetPct : 0));

  useEffect(() => {
    if (prefersReduced) {
      setCurrentPct(targetPct);
      return;
    }

    // Trigger smooth fill on mount / value update
    const raf = requestAnimationFrame(() => {
      setCurrentPct(targetPct);
    });

    return () => cancelAnimationFrame(raf);
  }, [targetPct, prefersReduced]);

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(targetPct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className={`w-full bg-slate-100 dark:bg-[#252B32] rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-200/60 dark:border-[#282F3A] ${className}`}
    >
      <div
        className={`h-full rounded-full ${barClassName}`}
        style={{
          width: `${currentPct}%`,
          transition: prefersReduced
            ? 'none'
            : `width ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
          willChange: 'width',
        }}
      />
    </div>
  );
};
