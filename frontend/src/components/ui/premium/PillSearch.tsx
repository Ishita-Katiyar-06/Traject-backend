import React from 'react';
import { Search } from 'lucide-react';

export interface PillSearchProps {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export const PillSearch: React.FC<PillSearchProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  autoFocus = false,
}) => {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="w-4 h-4 text-[#8591A5] dark:text-[#7A8699] absolute left-3.5 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="w-full h-10 pl-10 pr-4 rounded-full bg-[#E5E9F4] dark:bg-[#191F26] text-[#111727] dark:text-[#F8FAFC] text-[13px] placeholder-[#8591A5] dark:placeholder-[#7A8699] focus:outline-none focus:bg-white dark:focus:bg-[#1D232A] focus:ring-2 focus:ring-[#2F65F6]/30 transition-all font-medium border border-transparent dark:border-[#2B323A] focus:border-slate-200 dark:focus:border-slate-600"
      />
    </div>
  );
};
