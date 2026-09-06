import React from 'react';
import { NarrativeLifecycleStage } from '../../data/mock/narratives';
import { ArrowDown } from 'lucide-react';

export interface NarrativeLifecycleProps {
  stages: NarrativeLifecycleStage[];
  className?: string;
}

export const NarrativeLifecycle: React.FC<NarrativeLifecycleProps> = ({ stages, className = '' }) => {
  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-6 shadow-xs space-y-5 ${className}`}>
      <div>
        <h3 className="text-[17px] font-bold font-sans text-[#111727]">
          Narrative Lifecycle
        </h3>
        <p className="text-[13px] text-[#8591A5] font-normal mt-0.5">
          Observed chronological progression of claim framing and attribution
        </p>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[rgba(228,233,245,0.85)]">
        {stages.map((stage, idx) => (
          <div key={idx} className="relative group">
            {/* Step Marker */}
            <span
              className={`absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full ring-4 ring-white flex items-center justify-center ${
                stage.isMilestone ? 'bg-[#FF6D5A]' : 'bg-[#2F65F6]'
              }`}
            />

            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-[#8591A5]">
                  {stage.timestamp}
                </span>
                <span className="text-[14px] font-bold text-[#111727] font-sans">
                  {stage.stageTitle}
                </span>
              </div>

              <div className="inline-flex items-center gap-1 text-[12px] font-sans text-[#2F65F6] bg-[#EFF4FE] px-3 py-1 rounded-full border border-[#D6E3FD] self-start sm:self-auto">
                <span className="text-[#8591A5] text-[11px] font-medium">Framing:</span>
                <span className="font-semibold text-[#111727]">{stage.framing}</span>
              </div>
            </div>

            <p className="text-[13px] text-[#64748B] font-sans mt-1.5 leading-normal">
              {stage.channelContext}
            </p>

            {idx < stages.length - 1 && (
              <div className="pt-2 text-slate-300">
                <ArrowDown className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
