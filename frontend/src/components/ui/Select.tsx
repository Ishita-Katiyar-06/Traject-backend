import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

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

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

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
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full h-10 px-3.5 bg-white border rounded-full text-[13px] font-semibold text-[#111727] flex items-center justify-between gap-2 shadow-xs transition-all duration-150 outline-none cursor-pointer select-none ${
          isError
            ? 'border-rose-400 bg-rose-50/40'
            : isOpen
            ? 'border-[#2F65F6] ring-2 ring-[#2F65F6]/20'
            : 'border-[rgba(228,233,245,0.85)] hover:border-slate-300 hover:bg-[#F8FAFD]'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
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

      {/* Floating Rounded Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute mt-1 w-full rounded-[18px] bg-white border border-[rgba(228,233,245,0.9)] shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
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
                  className={`w-full px-2.5 py-1.5 rounded-[12px] text-left text-[13px] flex items-center justify-between transition-colors cursor-pointer select-none ${
                    opt.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : isSelected
                      ? 'bg-[#EEF2FF] text-[#2F65F6] font-bold'
                      : 'text-[#475569] hover:bg-[#F1F4F9] hover:text-[#111727] font-medium'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#2F65F6] shrink-0 ml-1.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
