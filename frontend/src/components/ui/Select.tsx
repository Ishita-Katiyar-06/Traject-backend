import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Check } from 'lucide-react';
import { dropdownMenu } from '../../utils/motion';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isError?: boolean;
  className?: string;
  align?: 'left' | 'right';
  name?: string;
  'aria-label'?: string;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  onValueChange,
  placeholder = 'Select option...',
  disabled = false,
  isError = false,
  className = '',
  align = 'left',
  'aria-label': ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuCoords, setMenuCoords] = useState<{
    top: number;
    left: number;
    width: number;
    openUpwards: boolean;
  }>({
    top: 0,
    left: 0,
    width: 200,
    openUpwards: false,
  });

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const approxMenuHeight = Math.min(options.length * 36 + 16, 240);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < approxMenuHeight && rect.top > approxMenuHeight;

    const top = openUpwards ? rect.top - 6 : rect.bottom + 6;
    const width = Math.min(window.innerWidth - 20, Math.max(rect.width, 160));
    const left = align === 'right' ? rect.right - width : rect.left;

    setMenuCoords({
      top,
      left: Math.max(10, Math.min(window.innerWidth - width - 10, left)),
      width,
      openUpwards,
    });
  }, [options.length, align]);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (target && target.closest('[data-traject-select]')) return;
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

  const handleSelect = (option: SelectOption) => {
    if (option.disabled || disabled) return;
    setIsOpen(false);
    if (onChange) {
      onChange({ target: { value: option.value } });
    }
    if (onValueChange) {
      onValueChange(option.value);
    }
  };

  return (
    <div ref={containerRef} className={`relative inline-block w-full font-sans ${className}`}>
      {/* Pill Trigger */}
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel || selectedOption?.label}
        aria-expanded={isOpen}
        onClick={() => {
          if (!disabled) {
            updatePosition();
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full h-10 px-3.5 bg-white dark:bg-[#171C22] border rounded-full text-[13px] font-medium text-[#111727] dark:text-[#F8FAFC] flex items-center justify-between gap-2 shadow-subtle transition-all duration-150 outline-none cursor-pointer select-none ${
          isError
            ? 'border-[#E35D5D] bg-[#E35D5D]/5 dark:bg-[#E35D5D]/10'
            : isOpen
            ? 'border-[#2F65F6] ring-2 ring-[#2F65F6]/20'
            : 'border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] hover:border-slate-300 dark:hover:border-slate-600 hover:bg-[#F8FAFD] dark:hover:bg-[#1D232A]'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-[#13171C]' : ''}`}
      >
        <span className="truncate text-left">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#8591A5] shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-[#2F65F6]' : ''
          }`}
        />
      </button>

      {/* Floating Rounded Dropdown Menu (Portaled to prevent container clipping) */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              data-traject-select="true"
              role="listbox"
              variants={dropdownMenu}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{
                position: 'fixed',
                top: `${menuCoords.top}px`,
                left: `${menuCoords.left}px`,
                width: `${menuCoords.width}px`,
                transform: menuCoords.openUpwards ? 'translateY(-100%)' : 'none',
              }}
              className="rounded-[18px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.9)] dark:border-[#2B323A] shadow-modal p-1.5 z-[10001] font-sans"
            >
              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {options.map((opt) => {
                  const isSelected = opt.value === value || (!value && opt === options[0]);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={opt.disabled}
                      onClick={() => handleSelect(opt)}
                      className={`w-full px-3 py-2 rounded-[12px] text-left text-[13px] flex items-center justify-between transition-colors cursor-pointer select-none ${
                        opt.disabled
                          ? 'opacity-40 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#2F65F6]/10 dark:bg-[#5878C7]/20 text-[#2F65F6] dark:text-[#93C5FD] font-semibold'
                          : 'text-[#475569] dark:text-slate-300 hover:bg-[#F1F4F9] dark:hover:bg-[#1E2630] hover:text-[#111727] dark:hover:text-white font-medium'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[#2F65F6] dark:text-[#93C5FD] shrink-0 ml-1.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
