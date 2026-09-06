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
      className={`bg-white rounded-[26px] p-6 shadow-dashboard border border-[rgba(228,233,245,0.85)] font-jakarta transition-all hover:shadow-dashboard-hover duration-200 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            {typeof title === 'string' ? (
              <h3 className="text-[18px] md:text-[20px] font-bold text-[#111727] tracking-tight">
                {title}
              </h3>
            ) : (
              title
            )}
            {subtitle && (
              <p className="text-[13px] text-[#8692A4] font-medium mt-0.5">
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
