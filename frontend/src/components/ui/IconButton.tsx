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
    sm: 'w-7 h-7 p-1 text-small',
    md: 'w-8 h-8 p-1.5 text-body-ui',
    lg: 'w-9 h-9 p-2 text-body-ui',
  };

  const variantClasses = {
    subtle:
      'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface active:bg-surface-elevated border border-transparent',
    secondary:
      'bg-surface-elevated text-text-primary hover:bg-[#25334A] border border-border active:bg-[#1A2436]',
    primary:
      'bg-signal text-[#0B1019] hover:bg-[#EAA73E] active:bg-[#D48D26] border border-transparent',
    danger:
      'bg-critical/15 text-critical border border-critical/35 hover:bg-critical/25 active:bg-critical/35',
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-sm transition-colors duration-fast disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
};
