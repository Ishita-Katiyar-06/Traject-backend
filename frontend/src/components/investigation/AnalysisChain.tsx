import React from 'react';
import { AnalysisChainStep } from '../../data/mock/investigations';
import { ArrowDown, CheckCircle2 } from 'lucide-react';

export interface AnalysisChainProps {
  chain: AnalysisChainStep[];
  className?: string;
}

export const AnalysisChain: React.FC<AnalysisChainProps> = ({ chain, className = '' }) => {
  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-6 shadow-xs space-y-4 font-sans ${className}`}>
      <div>
        <h3 className="text-[17px] font-bold font-sans text-[#111727]">
          Analytical Reasoning Chain
        </h3>
        <p className="text-[13px] text-[#8591A5] font-sans mt-0.5">
          Stepwise verifiable sequence linking telemetry anomalies, vernacular shifts, and claim mutations
        </p>
      </div>

      <div className="space-y-3">
        {chain.map((step, idx) => (
          <div key={step.step} className="space-y-2">
            <div className="p-4 rounded-[18px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] space-y-2 hover:bg-white hover:border-[#2F65F6]/40 hover:shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-sans text-[11px] font-bold text-[#FF6D5A] bg-[#FF6D5A]/10 px-2.5 py-0.5 rounded-full border border-[#FF6D5A]/20">
                    {step.label}
                  </span>
                  <span className="text-[14px] font-bold text-[#111727]">
                    {step.title}
                  </span>
                </div>
                <span className="font-mono text-[11px] font-bold text-[#8591A5]">STEP {step.step}</span>
              </div>

              <p className="text-[13px] text-[#475569] leading-relaxed">
                {step.description}
              </p>

              {step.supportingContext && (
                <div className="pt-1 text-[12px] text-[#2F65F6] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2F65F6]" />
                  <span>{step.supportingContext}</span>
                </div>
              )}
            </div>

            {idx < chain.length - 1 && (
              <div className="flex justify-center text-[#8591A5] py-0.5">
                <ArrowDown className="w-4 h-4 text-[#8591A5]" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
