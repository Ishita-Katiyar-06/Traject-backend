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
        className={`relative inline-flex items-center w-full rounded-full bg-[#E5E9F4] border transition-all duration-150 focus-within:bg-white focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-[#2F65F6]/25 ${
          isError
            ? 'border-rose-400 bg-rose-50/50'
            : 'border-transparent'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-200' : ''}`}
      >
        {leftSlot && (
          <div className="flex items-center pl-3.5 text-[#8591A5] pointer-events-none shrink-0">
            {leftSlot}
          </div>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={`w-full h-10 bg-transparent px-3.5 text-[13px] text-[#111727] placeholder:text-[#8591A5] focus:outline-none disabled:cursor-not-allowed font-sans ${
            leftSlot ? 'pl-2' : ''
          } ${rightSlot ? 'pr-2' : ''} ${className}`}
          {...props}
        />
        {rightSlot && (
          <div className="flex items-center pr-3.5 text-[#8591A5] shrink-0">
            {rightSlot}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
