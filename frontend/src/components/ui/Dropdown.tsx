import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { dropdownMenu } from '../../utils/motion';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
  closeOnClick?: boolean;
  onClick?: () => void;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  align = 'right',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [menuCoords, setMenuCoords] = useState<{
    top: number;
    left?: number;
    right?: number;
    transformOrigin: string;
  }>({
    top: 0,
    right: 0,
    transformOrigin: 'top right',
  });

  const updatePosition = useCallback(() => {
    if (!dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const menuHeight = items.length * 40 + 20;
    const menuWidth = 220;
    const padding = 12;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < menuHeight && rect.top > menuHeight;

    const top = openUpwards ? Math.max(padding, rect.top - 6) : rect.bottom + 6;

    let effAlign = align;
    if (effAlign === 'right' && rect.right - menuWidth < padding) {
      effAlign = 'left';
    } else if (effAlign === 'left' && rect.left + menuWidth > window.innerWidth - padding) {
      effAlign = 'right';
    }

    if (effAlign === 'right') {
      const right = Math.max(padding, window.innerWidth - rect.right);
      setMenuCoords({
        top,
        right,
        left: undefined,
        transformOrigin: `${openUpwards ? 'bottom' : 'top'} right`,
      });
    } else {
      const left = Math.max(padding, rect.left);
      setMenuCoords({
        top,
        left,
        right: undefined,
        transformOrigin: `${openUpwards ? 'bottom' : 'top'} left`,
      });
    }
  }, [items.length, align]);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (target && target.closest('[data-traject-dropdown]')) return;
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  return (
    <div ref={dropdownRef} className={`relative inline-flex ${className}`}>
      <div
        onClick={() => {
          updatePosition();
          setIsOpen(!isOpen);
        }}
        className="cursor-pointer"
      >
        {trigger}
      </div>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              data-traject-dropdown="true"
              role="menu"
              variants={dropdownMenu}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{
                position: 'fixed',
                top: `${menuCoords.top}px`,
                ...(menuCoords.right !== undefined
                  ? { right: `${menuCoords.right}px` }
                  : { left: `${menuCoords.left}px` }),
                transformOrigin: menuCoords.transformOrigin,
              }}
              className="z-[10001] min-w-[200px] max-w-[calc(100vw-24px)] rounded-[20px] bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-[#2B323D] p-1.5 shadow-2xl font-sans"
            >
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onClick?.();
                    if (item.closeOnClick !== false) {
                      setIsOpen(false);
                    }
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium rounded-full text-left transition-colors duration-150 cursor-pointer ${
                    item.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : item.danger
                      ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                      : item.active
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {item.icon && <span className="w-4 h-4 shrink-0 flex items-center justify-center text-[#8591A5] dark:text-[#94A3B8]">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
