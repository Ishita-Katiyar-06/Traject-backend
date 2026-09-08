import React from 'react';

export interface PanelProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  subtitle,
  actions,
  children,
  footer,
  className = '',
}) => {
  return (
    <div
      className={`border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] bg-white dark:bg-[#171C22] rounded-card shadow-dashboard overflow-hidden ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] bg-[#F8FAFD] dark:bg-[#1D232A]">
          <div>
            {title && <h3 className="text-[16px] font-bold text-[#111727] dark:text-[#F8FAFC] font-sans">{title}</h3>}
            {subtitle && <p className="text-[#8591A5] dark:text-[#94A3B8] text-[12px] mt-0.5 font-sans">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
      {footer && (
        <div className="px-5 py-3 border-t border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] bg-[#F8FAFD] dark:bg-[#1D232A] text-[#8591A5] dark:text-[#94A3B8] text-[12px] font-sans">
          {footer}
        </div>
      )}
    </div>
  );
};
