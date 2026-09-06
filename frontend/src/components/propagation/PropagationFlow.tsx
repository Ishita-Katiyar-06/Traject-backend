import React from 'react';
import { PropagationFlowStep } from '../../data/mock/propagation';
import { ArrowRight } from 'lucide-react';
import { Badge } from '../ui/Badge';

export interface PropagationFlowProps {
  steps: PropagationFlowStep[];
  className?: string;
}

export const PropagationFlow: React.FC<PropagationFlowProps> = ({ steps, className = '' }) => {
  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-6 shadow-xs space-y-5 ${className}`}>
      <div>
        <h3 className="text-[17px] font-bold font-sans text-[#111727]">
          Propagation Diffusion Pathway
        </h3>
        <p className="text-[13px] text-[#8591A5] font-normal mt-0.5">
          Observed cross-platform relay chain from initial detection to secondary community coordination
        </p>
      </div>

      {/* Desktop Horizontal / Tablet Flow */}
      <div className="hidden lg:grid grid-cols-5 gap-3.5 relative py-2">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="p-4 rounded-[20px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] flex flex-col justify-between relative group hover:border-[#2F65F6]/50 hover:bg-white hover:shadow-sm transition-all duration-150"
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="font-sans text-[11px] text-[#2F65F6] font-bold">
                  STEP {idx + 1}
                </span>
                <span className="font-sans text-[11px] text-[#8591A5]">
                  {step.timeLabel}
                </span>
              </div>

              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8591A5]">FROM</div>
              <div className="text-[13px] font-bold text-[#111727] truncate mt-0.5" title={step.sourceNode}>
                {step.sourceNode}
              </div>

              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mt-2">TO</div>
              <div className="text-[13px] font-bold text-[#2F65F6] truncate mt-0.5" title={step.destinationNode}>
                {step.destinationNode}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[rgba(228,233,245,0.85)]">
              <Badge variant="neutral" size="sm">
                {step.transferType}
              </Badge>
            </div>

            {idx < steps.length - 1 && (
              <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 z-10">
                <div className="w-6 h-6 bg-white border border-[rgba(228,233,245,0.9)] rounded-full shadow-xs flex items-center justify-center text-[#8591A5]">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile / Tablet Vertical Flow */}
      <div className="lg:hidden space-y-3">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="p-4 rounded-[20px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] space-y-2 relative"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-sans text-[11px] text-[#2F65F6] font-bold">
                  STEP {idx + 1}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-[11px] text-[#8591A5]">{step.timeLabel}</span>
              </div>
              <Badge variant="neutral" size="sm">
                {step.transferType}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-[14px] font-sans">
              <span className="text-[#64748B]">{step.sourceNode}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#2F65F6] shrink-0" />
              <span className="text-[#111727] font-bold">{step.destinationNode}</span>
            </div>

            <p className="text-[13px] text-[#475569] font-sans">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
