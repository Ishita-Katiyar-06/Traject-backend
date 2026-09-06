import React from 'react';
import { ForesightTimelineStep } from '../../data/mock/foresight';
import { Clock } from 'lucide-react';
import { Badge } from '../ui/Badge';

export interface ForesightTimelineProps {
  steps: ForesightTimelineStep[];
  className?: string;
}

export const ForesightTimeline: React.FC<ForesightTimelineProps> = ({ steps, className = '' }) => {
  return (
    <div className={`space-y-3 font-sans ${className}`}>
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-[#2F65F6]" />
        <h4 className="text-[16px] font-bold text-[#111727]">
          Near-Term Progression Timeline
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="p-4 rounded-[18px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] flex flex-col justify-between space-y-3 relative group hover:border-[#2F65F6]/40 hover:bg-white transition-all shadow-xs"
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="font-mono text-[11px] font-bold text-[#2F65F6]">
                  {step.period}
                </span>
                <Badge
                  variant={step.assessment === 'Likely' ? 'signal' : 'neutral'}
                  size="sm"
                >
                  {step.assessment}
                </Badge>
              </div>

              <p className="text-[13px] text-[#111727] font-medium leading-snug">
                {step.projection}
              </p>
            </div>

            <div className="pt-2 border-t border-[rgba(228,233,245,0.85)] text-[11px] text-[#475569] font-mono">
              <span className="text-[#8591A5] uppercase block text-[10px] font-semibold">MONITORING IMPLICATION</span>
              {step.operationalImplication}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
