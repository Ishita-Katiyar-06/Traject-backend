import React from 'react';
import { AlertStatusType } from '../../data/mock/alerts';

export interface AlertStatusProps {
  status: AlertStatusType;
  className?: string;
}

export const AlertStatus: React.FC<AlertStatusProps> = ({ status, className = '' }) => {
  const config: Record<
    AlertStatusType,
    { dotColor: string; textColor: string; bgColor: string; borderColor: string }
  > = {
    New: {
      dotColor: 'bg-[#FF6D5A]',
      textColor: 'text-[#FF6D5A]',
      bgColor: 'bg-[#FFF1F0]',
      borderColor: 'border-[#FFD8D3]',
    },
    Acknowledged: {
      dotColor: 'bg-[#2F65F6]',
      textColor: 'text-[#2F65F6]',
      bgColor: 'bg-[#EFF4FE]',
      borderColor: 'border-[#D6E3FD]',
    },
    'Under review': {
      dotColor: 'bg-[#F59E0B]',
      textColor: 'text-[#B45309]',
      bgColor: 'bg-[#FFFBEB]',
      borderColor: 'border-[#FDE68A]',
    },
    Resolved: {
      dotColor: 'bg-[#10B981]',
      textColor: 'text-[#059669]',
      bgColor: 'bg-[#ECFDF5]',
      borderColor: 'border-[#A7F3D0]',
    },
  };

  const item = config[status] || config.New;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${item.bgColor} ${item.borderColor} font-sans text-[12px] font-semibold ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dotColor}`} />
      <span className={item.textColor}>{status}</span>
    </span>
  );
};
