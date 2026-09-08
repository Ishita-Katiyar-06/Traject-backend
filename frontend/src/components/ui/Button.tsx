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
    sm: 'h-8 px-3.5 text-[12px] gap-1.5 rounded-[10px]',
    md: 'h-9 sm:h-10 px-4 text-[13px] gap-2 rounded-control',
    lg: 'h-11 px-5 text-[14px] gap-2.5 rounded-control',
  };

  const variantClasses = {
    primary:
      'bg-[#2F65F6] hover:bg-[#2152DE] active:bg-[#1A42BA] text-white font-medium shadow-subtle border border-transparent dark:bg-[#5878C7] dark:hover:bg-[#6E8ED4]',
    secondary:
      'bg-white dark:bg-[#171C22] text-[#111727] dark:text-[#F8FAFC] font-medium hover:bg-[#F8FAFD] dark:hover:bg-[#22282F] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] shadow-subtle active:bg-slate-50 dark:active:bg-[#1D232A]',
    subtle:
      'bg-transparent text-[#475569] dark:text-[#CBD5E1] font-medium hover:text-[#111727] dark:hover:text-[#F8FAFC] hover:bg-[#F1F4F9] dark:hover:bg-[#191F26] active:bg-[#E5E9F4] dark:active:bg-[#22282F] border border-transparent',
    danger:
      'bg-[#E35D5D]/10 text-[#E35D5D] dark:text-[#F87171] font-medium border border-[#E35D5D]/20 hover:bg-[#E35D5D]/15 active:bg-[#E35D5D]/20',
    data:
      'bg-[#E5E9F4] dark:bg-[#191F26] text-[#111727] dark:text-[#F8FAFC] font-medium hover:bg-white dark:hover:bg-[#1D232A] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] active:bg-slate-100',
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
