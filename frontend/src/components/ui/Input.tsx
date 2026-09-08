import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  isError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ leftSlot, rightSlot, isError, className = '', disabled, ...props }, ref) => {
    return (
      <div
        className={`relative inline-flex items-center w-full rounded-input bg-[#E5E9F4] dark:bg-[#191F26] border transition-all duration-150 focus-within:bg-white dark:focus-within:bg-[#1D232A] focus-within:border-slate-300 dark:focus-within:border-[#37404B] focus-within:ring-2 focus-within:ring-[#2F65F6]/25 ${
          isError
            ? 'border-[#E35D5D] bg-[#E35D5D]/5 dark:bg-[#E35D5D]/10'
            : 'border-transparent dark:border-[#2B323A]'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-200 dark:bg-[#161B21]' : ''}`}
      >
        {leftSlot && (
          <div className="flex items-center pl-3.5 text-[#8591A5] dark:text-[#7A8699] pointer-events-none shrink-0">
            {leftSlot}
          </div>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={`w-full h-10 bg-transparent px-3.5 text-[13px] text-[#111727] dark:text-[#F8FAFC] placeholder:text-[#8591A5] dark:placeholder:text-[#7A8699] focus:outline-none disabled:cursor-not-allowed font-sans ${
            leftSlot ? 'pl-2' : ''
          } ${rightSlot ? 'pr-2' : ''} ${className}`}
          {...props}
        />
        {rightSlot && (
          <div className="flex items-center pr-3.5 text-[#8591A5] dark:text-[#7A8699] shrink-0">
            {rightSlot}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
