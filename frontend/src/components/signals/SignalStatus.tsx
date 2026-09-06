import React from 'react';
import { SignalStatusType } from '../../data/mock/signals';

export interface SignalStatusProps {
  status: SignalStatusType;
  className?: string;
}

export const SignalStatus: React.FC<SignalStatusProps> = ({ status, className = '' }) => {
  const config: Record<
    SignalStatusType,
    { dotColor: string; textColor: string; bgColor: string; borderColor: string }
  > = {
    Emerging: {
      dotColor: 'bg-signal',
      textColor: 'text-signal',
      bgColor: 'bg-signal/10',
      borderColor: 'border-signal/30',
    },
    Monitoring: {
      dotColor: 'bg-data',
      textColor: 'text-data',
      bgColor: 'bg-data/10',
      borderColor: 'border-data/30',
    },
    Observed: {
      dotColor: 'bg-text-secondary',
      textColor: 'text-text-secondary',
      bgColor: 'bg-surface-elevated',
      borderColor: 'border-border',
    },
    Resolved: {
      dotColor: 'bg-confirmed',
      textColor: 'text-confirmed',
      bgColor: 'bg-confirmed/10',
      borderColor: 'border-confirmed/30',
    },
  };

  const item = config[status] || config.Observed;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border ${item.bgColor} ${item.borderColor} font-sans text-small ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dotColor}`} />
      <span className={`${item.textColor} font-medium text-[12px]`}>{status}</span>
    </span>
  );
};
