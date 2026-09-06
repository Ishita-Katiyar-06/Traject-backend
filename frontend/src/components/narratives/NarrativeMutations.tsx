import React from 'react';
import { NarrativeMutationItem } from '../../data/mock/narratives';
import { GitCommit, ArrowRight } from 'lucide-react';

export interface NarrativeMutationsProps {
  mutations: NarrativeMutationItem[];
  className?: string;
}

export const NarrativeMutations: React.FC<NarrativeMutationsProps> = ({ mutations, className = '' }) => {
  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-6 shadow-xs space-y-5 ${className}`}>
      <div>
        <h4 className="text-[17px] font-bold font-sans text-[#111727]">
          Narrative Mutations
        </h4>
        <p className="text-[13px] text-[#8591A5] font-normal mt-0.5">
          Stepwise adaptations in claim structure, keyword density, and attributed causation
        </p>
      </div>

      <div className="rounded-[20px] border border-[rgba(228,233,245,0.85)] overflow-hidden divide-y divide-[rgba(228,233,245,0.85)]">
        {mutations.map((mut, idx) => (
          <div
            key={idx}
            className="p-4 bg-white hover:bg-[#F8FAFD] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            {/* Left: Time and Framing Flow */}
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-[#2F65F6] shrink-0" />
                <span className="text-[12px] font-medium text-[#8591A5]">{mut.timestamp}</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-[14px] font-sans">
                <span className="text-[#8591A5] line-through">
                  {mut.fromFraming}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#2F65F6] shrink-0" />
                <span className="text-[#111727] font-bold">
                  {mut.toFraming}
                </span>
              </div>

              <div className="text-[12px] text-[#64748B]">
                <span className="text-[#8591A5] font-bold uppercase text-[10px] mr-1.5">Sources:</span>
                {mut.supportingSources}
              </div>
            </div>

            {/* Right: Activity Change Badge */}
            <div className="shrink-0 self-start sm:self-center">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#FFF1F0] border border-[#FFD8D3] text-[#FF6D5A] text-[12px] font-bold">
                {mut.activityChange}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
