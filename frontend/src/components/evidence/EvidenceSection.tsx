import React from 'react';
import { EvidenceItem } from '../../data/mock/evidence';
import { EvidenceRow } from './EvidenceRow';
import { ShieldCheck } from 'lucide-react';

export interface EvidenceSectionProps {
  evidenceList: EvidenceItem[];
  summary: {
    postsCount: number;
    clustersCount: number;
    platformsCount: number;
    languageCount: number;
  };
  className?: string;
}

export const EvidenceSection: React.FC<EvidenceSectionProps> = ({
  evidenceList,
  summary,
  className = '',
}) => {
  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-6 shadow-xs space-y-4 font-sans ${className}`}>
      {/* Section Header with Corroboration Icon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <h3 className="text-[17px] font-bold font-sans text-[#111727]">
            Supporting Evidence & Attribution
          </h3>
        </div>

        <span className="font-mono text-[11px] text-[#8591A5]">
          Ground-truth corroboration
        </span>
      </div>

      {/* Analytical Observation Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-sans">
        <div className="p-3.5 rounded-[16px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)]">
          <div className="text-[10px] text-[#8591A5] font-bold uppercase tracking-wider">OBSERVED POSTS</div>
          <div className="text-[18px] font-bold text-[#111727] mt-0.5">
            {summary.postsCount.toLocaleString()}
          </div>
        </div>

        <div className="p-3.5 rounded-[16px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)]">
          <div className="text-[10px] text-[#8591A5] font-bold uppercase tracking-wider">CLUSTERS</div>
          <div className="text-[18px] font-bold text-[#2F65F6] mt-0.5">
            {summary.clustersCount}
          </div>
        </div>

        <div className="p-3.5 rounded-[16px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)]">
          <div className="text-[10px] text-[#8591A5] font-bold uppercase tracking-wider">PLATFORMS</div>
          <div className="text-[18px] font-bold text-[#111727] mt-0.5">
            {summary.platformsCount}
          </div>
        </div>

        <div className="p-3.5 rounded-[16px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)]">
          <div className="text-[10px] text-[#8591A5] font-bold uppercase tracking-wider">LANGUAGES</div>
          <div className="text-[18px] font-bold text-[#FF6D5A] mt-0.5">
            {summary.languageCount}
          </div>
        </div>
      </div>

      {/* Evidence Captures List */}
      <div className="space-y-2.5 pt-1">
        {evidenceList.map((item) => (
          <EvidenceRow key={item.id} evidence={item} />
        ))}
      </div>
    </div>
  );
};
