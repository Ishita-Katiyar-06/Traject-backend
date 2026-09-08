import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: 'secondary' | 'subtle' | 'primary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon: React.ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({
  'aria-label': ariaLabel,
  variant = 'subtle',
  size = 'md',
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: 'w-7 h-7 p-1 text-[12px] rounded-[10px]',
    md: 'w-8 h-8 p-1.5 text-[13px] rounded-icon',
    lg: 'w-9 h-9 p-2 text-[14px] rounded-icon',
  };

  const variantClasses = {
    subtle:
      'bg-transparent text-[#8591A5] dark:text-[#94A3B8] hover:text-[#111727] dark:hover:text-[#F8FAFC] hover:bg-[#F1F4F9] dark:hover:bg-[#191F26] active:bg-[#E5E9F4] dark:active:bg-[#22282F] border border-transparent',
    secondary:
      'bg-white dark:bg-[#171C22] text-[#111727] dark:text-[#F8FAFC] hover:bg-[#F8FAFD] dark:hover:bg-[#22282F] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] active:bg-slate-50 dark:active:bg-[#1D232A] shadow-2xs',
    primary:
      'bg-[#2F65F6] text-white hover:bg-[#2152DE] active:bg-[#1A42BA] border border-transparent shadow-subtle dark:bg-[#5878C7] dark:hover:bg-[#6E8ED4]',
    danger:
      'bg-[#E35D5D]/10 text-[#E35D5D] dark:text-[#F87171] border border-[#E35D5D]/20 hover:bg-[#E35D5D]/20 active:bg-[#E35D5D]/30',
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={disabled}
      className={`inline-flex items-center justify-center transition-all duration-fast cursor-pointer active:scale-[0.96] active:transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/30 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
};
