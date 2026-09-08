import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { dropdownMenu } from '../../utils/motion';

export type DateRangePreset = '1h' | '6h' | '24h' | '7d' | '30d' | 'custom';

export interface DateRangeValue {
  preset: DateRangePreset;
  startDate?: string;
  endDate?: string;
  label: string;
}

export interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (val: DateRangeValue) => void;
  className?: string;
}

const PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: '1h', label: 'Last 1 Hour' },
  { id: '6h', label: 'Last 6 Hours' },
  { id: '24h', label: 'Last 24 Hours' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'custom', label: 'Custom Range...' },
];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuCoords, setMenuCoords] = useState<{
    top: number;
    left: number;
    openUpwards: boolean;
  }>({
    top: 0,
    left: 0,
    openUpwards: false,
  });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = PRESETS.length * 40 + 20;
    const menuWidth = 196;
    const padding = 10;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < menuHeight && rect.top > menuHeight;

    const top = openUpwards ? rect.top - 6 : rect.bottom + 6;
    const left = Math.max(padding, Math.min(window.innerWidth - menuWidth - padding, rect.right - menuWidth));

    setMenuCoords({
      top,
      left,
      openUpwards,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleClickOutside = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (target && target.closest('[data-traject-datepicker]')) return;
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  const handleSelect = (preset: DateRangePreset, label: string) => {
    onChange({ preset, label });
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block font-sans ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          updatePosition();
          setIsOpen(!isOpen);
        }}
        className="h-10 px-4 bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] hover:border-slate-300 dark:hover:border-slate-600 rounded-full text-[13px] font-medium text-[#111727] dark:text-[#F8FAFC] hover:bg-[#F8FAFD] dark:hover:bg-[#1D232A] shadow-subtle flex items-center gap-2.5 cursor-pointer select-none transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/40"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Calendar className="w-3.5 h-3.5 text-[#8591A5] dark:text-[#94A3B8]" />
        <span>{value.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#8591A5] dark:text-[#94A3B8] transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-[#2F65F6]' : ''
          }`}
        />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              data-traject-datepicker="true"
              role="listbox"
              aria-label="Select date range preset"
              variants={dropdownMenu}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{
                position: 'fixed',
                top: `${menuCoords.top}px`,
                left: `${menuCoords.left}px`,
                transform: menuCoords.openUpwards ? 'translateY(-100%)' : 'none',
              }}
              className="w-48 rounded-[20px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.9)] dark:border-[#2B323A] shadow-modal p-1.5 z-[10001] font-sans text-[13px] select-none"
            >
              {PRESETS.map((p) => {
                const isSelected = p.id === value.preset;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(p.id, p.label)}
                    className={`w-full px-3 py-2 rounded-[12px] text-left flex items-center justify-between transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-[#2F65F6]/10 dark:bg-[#5878C7]/20 text-[#2F65F6] dark:text-[#93C5FD] font-semibold'
                        : 'text-[#475569] dark:text-slate-300 hover:bg-[#F1F4F9] dark:hover:bg-[#1E2630] hover:text-[#111727] dark:hover:text-white font-medium'
                    }`}
                  >
                    <span>{p.label}</span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#2F65F6] dark:text-[#93C5FD]" />
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
