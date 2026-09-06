import React from 'react';
import { EvidenceStatusType } from '../../data/mock/evidence';

export interface EvidenceStatusProps {
  status: EvidenceStatusType;
  className?: string;
}

export const EvidenceStatus: React.FC<EvidenceStatusProps> = ({ status, className = '' }) => {
  const config: Record<
    EvidenceStatusType,
    { label: string; textClass: string; bgClass: string; borderClass: string }
  > = {
    Corroborated: {
      label: 'Corroborated',
      textClass: 'text-confirmed',
      bgClass: 'bg-confirmed/10',
      borderClass: 'border-confirmed/30',
    },
    Observed: {
      label: 'Observed',
      textClass: 'text-data',
      bgClass: 'bg-data/10',
      borderClass: 'border-data/30',
    },
    Conflicting: {
      label: 'Conflicting',
      textClass: 'text-critical',
      bgClass: 'bg-critical/10',
      borderClass: 'border-critical/30',
    },
    Insufficient: {
      label: 'Insufficient',
      textClass: 'text-text-muted',
      bgClass: 'bg-surface-elevated',
      borderClass: 'border-border',
    },
  };

  const item = config[status] || config.Observed;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-sm border font-mono text-[11px] ${item.bgClass} ${item.borderClass} ${item.textClass} ${className}`}
    >
      {item.label}
    </span>
  );
};
