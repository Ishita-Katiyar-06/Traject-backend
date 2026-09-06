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
    md: 'h-9 sm:h-10 px-4 text-[13px] gap-2 rounded-full',
    lg: 'h-11 px-5 text-[14px] gap-2.5 rounded-full',
  };

  const variantClasses = {
    primary:
      'bg-[#2F65F6] text-white font-semibold hover:bg-[#2152DE] active:bg-[#1A42BA] shadow-sm border border-transparent',
    secondary:
      'bg-white text-[#111727] font-semibold hover:bg-[#F8FAFD] border border-[rgba(228,233,245,0.9)] shadow-sm active:bg-slate-50',
    subtle:
      'bg-transparent text-[#475569] font-medium hover:text-[#111727] hover:bg-[#E5E9F4]/70 active:bg-[#E5E9F4] border border-transparent',
    danger:
      'bg-rose-50 text-[#C0503E] font-medium border border-rose-200 hover:bg-rose-100 active:bg-rose-200',
    data:
      'bg-[#E5E9F4] text-[#111727] font-semibold hover:bg-white border border-[rgba(228,233,245,0.9)] active:bg-slate-100',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center font-sans transition-all duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/40 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
};
