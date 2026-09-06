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
    <div className={`border border-[rgba(228,233,245,0.85)] bg-white rounded-[26px] shadow-xs overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(228,233,245,0.85)] bg-[#F8FAFD]">
          <div>
            {title && <h3 className="text-[16px] font-bold text-[#111727]">{title}</h3>}
            {subtitle && <p className="text-[#8591A5] text-[12px] mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
      {footer && (
        <div className="px-5 py-3 border-t border-[rgba(228,233,245,0.85)] bg-[#F8FAFD] text-[#8591A5] text-[12px]">
          {footer}
        </div>
      )}
    </div>
  );
};
