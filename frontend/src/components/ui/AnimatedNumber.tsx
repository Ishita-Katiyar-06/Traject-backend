import React, { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion, MOTION_DURATIONS } from '../../utils/motion';

export interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  formatFn?: (val: number) => string;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = MOTION_DURATIONS.complexVisualization,
  decimals = 0,
  formatFn,
  className = '',
  prefix = '',
  suffix = '',
}) => {
  const prefersReduced = usePrefersReducedMotion();
  const [displayValue, setDisplayValue] = useState<number>(value);
  const prevValueRef = useRef<number>(value);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // If user prefers reduced motion, snap immediately to the target value
    if (prefersReduced) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    // Do NOT restart animation if the value hasn't changed (prevents re-trigger on re-renders, theme toggle, polling)
    if (prevValueRef.current === value) {
      return;
    }

    const startValue = prevValueRef.current;
    const endValue = value;
    prevValueRef.current = value;

    const startTime = performance.now();
    const durationMs = duration * 1000;

    // Cubic-out easing: f(t) = 1 - (1 - t)^3
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const easedProgress = easeOutCubic(progress);

      const current = startValue + (endValue - startValue) * easedProgress;
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
      }
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, duration, prefersReduced]);

  const formatted = formatFn
    ? formatFn(displayValue)
    : decimals > 0
    ? displayValue.toFixed(decimals)
    : Math.round(displayValue).toLocaleString();

  return (
    <span className={`inline-block tabular-nums font-mono ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
