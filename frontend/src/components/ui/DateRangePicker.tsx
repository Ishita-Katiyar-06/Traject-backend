import React, { useState } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';

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

  const handleSelect = (preset: DateRangePreset, label: string) => {
    onChange({ preset, label });
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block font-sans ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 px-4 bg-white border border-[rgba(228,233,245,0.85)] hover:border-slate-300 rounded-full text-[13px] font-semibold text-[#111727] hover:bg-[#F8FAFD] shadow-xs flex items-center gap-2.5 cursor-pointer select-none transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/40"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Calendar className="w-3.5 h-3.5 text-[#8591A5]" />
        <span>{value.label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-[#8591A5]" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-dropdown"
            onClick={() => setIsOpen(false)}
          />
          <div
            role="listbox"
            aria-label="Select date range preset"
            className="absolute right-0 top-full mt-2 w-48 rounded-[20px] bg-white border border-[rgba(228,233,245,0.9)] shadow-xl p-1.5 z-modal font-sans text-[13px] select-none animate-in fade-in zoom-in-95 duration-100"
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
                  className={`w-full px-3 py-2 rounded-[12px] text-left flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#EEF2FF] text-[#2F65F6] font-bold'
                      : 'text-[#475569] hover:bg-[#F1F4F9] hover:text-[#111727] font-medium'
                  }`}
                >
                  <span>{p.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#2F65F6]" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
