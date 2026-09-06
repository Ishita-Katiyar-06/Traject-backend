import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  delay = 150,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; transform: string }>({
    top: 0,
    left: 0,
    transform: '',
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const offset = 8;

    switch (position) {
      case 'right':
        setCoords({
          top: rect.top + rect.height / 2,
          left: rect.right + offset,
          transform: 'translateY(-50%)',
        });
        break;
      case 'left':
        setCoords({
          top: rect.top + rect.height / 2,
          left: rect.left - offset,
          transform: 'translate(-100%, -50%)',
        });
        break;
      case 'bottom':
        setCoords({
          top: rect.bottom + offset,
          left: rect.left + rect.width / 2,
          transform: 'translateX(-50%)',
        });
        break;
      case 'top':
      default:
        setCoords({
          top: rect.top - offset,
          left: rect.left + rect.width / 2,
          transform: 'translate(-50%, -100%)',
        });
        break;
    }
  };

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
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {isVisible &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: coords.transform,
            }}
            className="z-[99999] pointer-events-none whitespace-nowrap rounded-[8px] bg-[#111727] px-2.5 py-1 text-[11px] font-semibold font-sans text-white shadow-lg transition-opacity duration-150"
          >
            {content}
          </div>,
          document.body
        )}
    </div>
  );
};
