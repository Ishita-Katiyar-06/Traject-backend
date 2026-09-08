import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';

export interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 120,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; transform: string }>({
    top: 0,
    left: 0,
    transform: '',
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const offset = 7;
    const padding = 12;

    let effPosition = position;

    // Viewport boundary collision checks & auto-flipping
    if (effPosition === 'top' && rect.top - 36 < 0) {
      effPosition = 'bottom';
    } else if (effPosition === 'bottom' && rect.bottom + 36 > window.innerHeight) {
      effPosition = 'top';
    } else if (effPosition === 'left' && rect.left - 80 < 0) {
      effPosition = 'right';
    } else if (effPosition === 'right' && rect.right + 80 > window.innerWidth) {
      effPosition = 'left';
    }

    switch (effPosition) {
      case 'right':
        setCoords({
          top: Math.max(padding, Math.min(window.innerHeight - padding, rect.top + rect.height / 2)),
          left: Math.min(window.innerWidth - padding, rect.right + offset),
          transform: 'translateY(-50%)',
        });
        break;
      case 'left':
        setCoords({
          top: Math.max(padding, Math.min(window.innerHeight - padding, rect.top + rect.height / 2)),
          left: Math.max(padding, rect.left - offset),
          transform: 'translate(-100%, -50%)',
        });
        break;
      case 'bottom':
        setCoords({
          top: rect.bottom + offset,
          left: Math.max(padding, Math.min(window.innerWidth - padding, rect.left + rect.width / 2)),
          transform: 'translateX(-50%)',
        });
        break;
      case 'top':
      default:
        setCoords({
          top: Math.max(padding, rect.top - offset),
          left: Math.max(padding, Math.min(window.innerWidth - padding, rect.left + rect.width / 2)),
          transform: 'translate(-50%, -100%)',
        });
        break;
    }
  }, [position]);

  const show = () => {
    updatePosition();
    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsVisible(true);
    }, delay);
  };

  const hide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    if (!isVisible) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isVisible, updatePosition]);

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {createPortal(
        <AnimatePresence>
          {isVisible && (
            <motion.div
              role="tooltip"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                transform: coords.transform,
              }}
              className="z-tooltip pointer-events-none whitespace-nowrap rounded-[10px] bg-white dark:bg-[#1C232B] border border-[rgba(228,233,245,0.9)] dark:border-[#2D3748] px-3 py-1.5 text-[12px] font-medium font-sans text-[#111727] dark:text-[#F8FAFC] shadow-tooltip"
            >
              {content}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
