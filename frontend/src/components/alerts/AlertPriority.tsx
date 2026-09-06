import React from 'react';
import { AlertPriorityType } from '../../data/mock/alerts';

export interface AlertPriorityProps {
  priority: AlertPriorityType;
  className?: string;
}

export const AlertPriority: React.FC<AlertPriorityProps> = ({ priority, className = '' }) => {
  const config: Record<
    AlertPriorityType,
    { label: string; textClass: string; bars: number }
  > = {
    High: {
      label: 'High',
      textClass: 'text-[#FF6D5A]',
      bars: 3,
    },
    Medium: {
      label: 'Medium',
      textClass: 'text-[#2F65F6]',
      bars: 2,
    },
    Low: {
      label: 'Low',
      textClass: 'text-[#64748B]',
      bars: 1,
    },
  };

  const item = config[priority] || config.Low;

  return (
    <div
      className={`inline-flex items-center gap-1.5 font-mono text-[12px] ${item.textClass} ${className}`}
      title={`Operational priority: ${item.label}`}
    >
      <div className="flex items-end gap-0.5 h-3">
        <span
          className={`w-1 rounded-[1px] ${
            item.bars >= 1 ? 'bg-current h-1.5' : 'bg-border h-1.5'
          }`}
        />
        <span
          className={`w-1 rounded-[1px] ${
            item.bars >= 2 ? 'bg-current h-2.5' : 'bg-border h-2.5'
          }`}
        />
        <span
          className={`w-1 rounded-[1px] ${
            item.bars >= 3 ? 'bg-current h-3.5' : 'bg-border h-3.5'
          }`}
        />
      </div>
      <span className="font-sans text-[12px]">{item.label}</span>
    </div>
  );
};
