import React from 'react';

export interface PremiumCardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export const PremiumCard: React.FC<PremiumCardProps> = ({
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClassName = '',
}) => {
  return (
    <div
      className={`bg-white dark:bg-[#171C22] rounded-card p-6 shadow-dashboard border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] font-sans transition-all hover:shadow-dashboard-hover duration-200 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            {typeof title === 'string' ? (
              <h3 className="text-[17px] md:text-[18px] font-bold text-[#111727] dark:text-[#F8FAFC] tracking-tight">
                {title}
              </h3>
            ) : (
              title
            )}
            {subtitle && (
              <p className="text-[13px] text-[#8591A5] dark:text-[#94A3B8] font-medium mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}

      <div className={bodyClassName}>{children}</div>
    </div>
  );
};
