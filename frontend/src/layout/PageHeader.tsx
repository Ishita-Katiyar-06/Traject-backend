import React from 'react';

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  className = '',
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[rgba(228,233,245,0.85)] dark:border-[#252B32] ${className}`}>
      <div>
        {typeof title === 'string' ? (
          <h1 className="text-[28px] sm:text-[32px] font-semibold text-[#111727] dark:text-[#F8FAFC] tracking-tight leading-tight font-sans">
            {title}
          </h1>
        ) : (
          <div>{title}</div>
        )}
        {description && (
          typeof description === 'string' ? (
            <p className="text-[#8591A5] dark:text-[#94A3B8] mt-1 text-[14px] font-sans max-w-2xl leading-relaxed font-normal">
              {description}
            </p>
          ) : (
            <div className="text-[#8591A5] dark:text-[#94A3B8] mt-1 text-[14px] font-sans max-w-2xl leading-relaxed font-normal">
              {description}
            </div>
          )
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap mt-1 sm:mt-0">
          {actions}
        </div>
      )}
    </div>
  );
};
