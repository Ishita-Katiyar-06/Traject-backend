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
    left: number;
    transformOrigin: string;
    translateX: string;
  }>({
    top: 0,
    left: 0,
    transformOrigin: 'top right',
    translateX: '0',
  });

  const updatePosition = useCallback(() => {
    if (!dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const menuHeight = items.length * 38 + 24;
    const menuWidth = 200;
    const padding = 10;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < menuHeight && rect.top > menuHeight;

    const top = openUpwards ? rect.top - 6 : rect.bottom + 6;

    let effAlign = align;
    if (effAlign === 'right' && rect.right - menuWidth < padding) {
      effAlign = 'left';
    } else if (effAlign === 'left' && rect.left + menuWidth > window.innerWidth - padding) {
      effAlign = 'right';
    }

    let left = effAlign === 'right' ? rect.right : rect.left;
    const translateX = effAlign === 'right' ? '-100%' : '0%';

    // Clamp horizontal placement within viewport
    if (effAlign === 'right') {
      left = Math.min(window.innerWidth - padding, left);
    } else {
      left = Math.max(padding, left);
    }

    setMenuCoords({
      top,
      left,
      transformOrigin: `${openUpwards ? 'bottom' : 'top'} ${effAlign === 'right' ? 'right' : 'left'}`,
      translateX,
    });
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
                left: `${menuCoords.left}px`,
                transform: `translateX(${menuCoords.translateX})`,
                transformOrigin: menuCoords.transformOrigin,
              }}
              className="z-[10001] min-w-[190px] max-w-[calc(100vw-20px)] rounded-[18px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] p-1.5 shadow-modal font-sans"
            >
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onClick?.();
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium rounded-[12px] text-left transition-colors duration-150 cursor-pointer ${
                    item.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : item.danger
                      ? 'text-[#E35D5D] dark:text-[#F87171] hover:bg-[#E35D5D]/10 dark:hover:bg-[#E35D5D]/15'
                      : item.active
                      ? 'bg-[#F1F4F9] dark:bg-[#1D232A] text-[#2F65F6] dark:text-[#93C5FD] font-semibold'
                      : 'text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F8FAFD] dark:hover:bg-[#1D232A] hover:text-[#111727] dark:hover:text-[#F8FAFC]'
                  }`}
                >
                  {item.icon && <span className="w-4 h-4 shrink-0 text-[#8591A5] dark:text-[#94A3B8]">{item.icon}</span>}
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
