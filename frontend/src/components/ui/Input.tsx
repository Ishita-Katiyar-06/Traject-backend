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
        className={`relative inline-flex items-center w-full rounded-full bg-white/90 dark:bg-[#181C22]/90 border transition-all duration-150 shadow-[0_1px_3px_rgba(0,0,0,0.04)] focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 ${
          isError
            ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20'
            : 'border-slate-300/80 dark:border-[#333C48]'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-[#12161D]' : ''}`}
      >
        {leftSlot && (
          <div className="flex items-center pl-3.5 text-slate-400 pointer-events-none shrink-0">
            {leftSlot}
          </div>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={`w-full h-10 bg-transparent px-3.5 text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed font-sans ${
            leftSlot ? 'pl-2' : ''
          } ${rightSlot ? 'pr-2' : ''} ${className}`}
          {...props}
        />
        {rightSlot && (
          <div className="flex items-center pr-3.5 text-slate-400 shrink-0">
            {rightSlot}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
