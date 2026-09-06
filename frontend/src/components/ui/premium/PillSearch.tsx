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
      <Search className="w-4 h-4 text-[#8A95A6] absolute left-3.5 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="w-full h-10 pl-10 pr-4 rounded-full bg-[#E5E9F4] text-[#111727] text-[13px] placeholder-[#8A95A6] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#2F65F6]/30 transition-all font-medium border border-transparent focus:border-slate-200"
      />
    </div>
  );
};
