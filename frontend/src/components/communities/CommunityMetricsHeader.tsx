import React from 'react';
import { Users, Radio, MessageSquare, GitBranch } from 'lucide-react';
import type { CommunitySummaryKPIs } from '../../types/communities';

export interface CommunityMetricsHeaderProps {
  kpis: CommunitySummaryKPIs | null;
  isLoading?: boolean;
}

export const CommunityMetricsHeader: React.FC<CommunityMetricsHeaderProps> = ({
  kpis,
  isLoading = false,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Communities */}
      <div className="p-4 rounded-[22px] bg-white dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#8591A5] dark:text-[#7A8699]">
            Active Communities
          </span>
          <div className="text-[26px] font-extrabold font-mono text-[#111727] dark:text-[#F8FAFC] mt-0.5 leading-tight">
            {isLoading ? '...' : kpis?.total_communities ?? 0}
          </div>
          <span className="text-[11px] font-sans text-[#8591A5] dark:text-[#94A3B8] mt-0.5 block">
            Dynamic strategic clusters
          </span>
        </div>
        <div className="w-10 h-10 rounded-xl bg-[#2F65F6]/10 text-[#2F65F6] flex items-center justify-center">
          <Users className="w-5 h-5" />
        </div>
      </div>

      {/* 2. Monitored Sources */}
      <div className="p-4 rounded-[22px] bg-white dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#8591A5] dark:text-[#7A8699]">
            Monitored Sources
          </span>
          <div className="text-[26px] font-extrabold font-mono text-[#111727] dark:text-[#F8FAFC] mt-0.5 leading-tight">
            {isLoading ? '...' : kpis?.total_monitored_sources ?? 0}
          </div>
          <span className="text-[11px] font-sans text-[#8591A5] dark:text-[#94A3B8] mt-0.5 block">
            Active verified feeds & authors
          </span>
        </div>
        <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 text-[#10B981] flex items-center justify-center">
          <Radio className="w-5 h-5" />
        </div>
      </div>

      {/* 3. Total Messages Ingested */}
      <div className="p-4 rounded-[22px] bg-white dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#8591A5] dark:text-[#7A8699]">
            Corpus Messages
          </span>
          <div className="text-[26px] font-extrabold font-mono text-[#111727] dark:text-[#F8FAFC] mt-0.5 leading-tight">
            {isLoading ? '...' : (kpis?.total_corpus_messages ?? 0).toLocaleString()}
          </div>
          <span className="text-[11px] font-sans text-[#8591A5] dark:text-[#94A3B8] mt-0.5 block">
            Canonical records indexed
          </span>
        </div>
        <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center">
          <MessageSquare className="w-5 h-5" />
        </div>
      </div>

      {/* 4. Cross-Community Resonance */}
      <div className="p-4 rounded-[22px] bg-white dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#8591A5] dark:text-[#7A8699]">
            Cross-Domain Bridges
          </span>
          <div className="text-[26px] font-extrabold font-mono text-[#FF6D5A] mt-0.5 leading-tight">
            {isLoading ? '...' : kpis?.cross_community_resonance_count ?? 0}
          </div>
          <span className="text-[11px] font-sans text-[#8591A5] dark:text-[#94A3B8] mt-0.5 block">
            Narratives spanning domains
          </span>
        </div>
        <div className="w-10 h-10 rounded-xl bg-[#FF6D5A]/10 text-[#FF6D5A] flex items-center justify-center">
          <GitBranch className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
