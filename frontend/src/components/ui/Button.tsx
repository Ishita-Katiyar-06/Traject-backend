import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'subtle' | 'danger' | 'data';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'h-8 px-3.5 text-[12px] gap-1.5 rounded-full',
    md: 'h-10 px-4 text-[13px] gap-2 rounded-full',
    lg: 'h-11 px-5 text-[14px] gap-2.5 rounded-full',
  };

  const variantClasses = {
    primary:
      'bg-[#21252C] hover:bg-[#15181C] active:bg-black text-white font-medium shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-transparent dark:bg-[#F8FAFC] dark:text-[#0D1014] dark:hover:bg-white',
    secondary:
      'bg-white/90 dark:bg-[#181C22]/90 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-[#20262E] border border-slate-300/80 dark:border-[#333C48] shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:border-slate-400 dark:hover:border-slate-500 active:bg-slate-100 dark:active:bg-[#1D232A]',
    subtle:
      'bg-transparent text-slate-600 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-[#181C22] border border-transparent',
    danger:
      'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-medium border border-rose-200/80 dark:border-rose-900/40 hover:bg-rose-100/70 dark:hover:bg-rose-900/40',
    data:
      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-200/70 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center font-sans transition-all duration-150 select-none cursor-pointer active:scale-[0.985] active:transition-transform duration-fast disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/30 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0 items-center justify-center">{leftIcon}</span>
      )}
      {children}
      {!isLoading && rightIcon && <span className="inline-flex shrink-0 items-center justify-center">{rightIcon}</span>}
    </button>
  );
};
