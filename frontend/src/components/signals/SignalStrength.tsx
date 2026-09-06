import React from 'react';
import { SignalStrengthType } from '../../data/mock/signals';

export interface SignalStrengthProps {
  strength: SignalStrengthType;
  className?: string;
}

export const SignalStrength: React.FC<SignalStrengthProps> = ({ strength, className = '' }) => {
  const config: Record<
    SignalStrengthType,
    { label: string; textClass: string; bars: number }
  > = {
    High: {
      label: 'High',
      textClass: 'text-signal',
      bars: 3,
    },
    Medium: {
      label: 'Medium',
      textClass: 'text-data',
      bars: 2,
    },
    Low: {
      label: 'Low',
      textClass: 'text-text-muted',
      bars: 1,
    },
  };

  const item = config[strength] || config.Low;

  return (
    <div
      className={`inline-flex items-center gap-1.5 font-mono text-[12px] ${item.textClass} ${className}`}
      title={`Monitoring priority: ${item.label}`}
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
      <span className="font-sans text-small">{item.label}</span>
    </div>
  );
};
