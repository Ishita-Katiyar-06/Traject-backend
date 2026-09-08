import React from 'react';
import { Users, Radio, MessageSquare, GitBranch } from 'lucide-react';
import { motion } from 'motion/react';
import type { CommunitySummaryKPIs } from '../../types/communities';
import { staggerContainer, kpiCardEnter } from '../../utils/motion';
import { AnimatedNumber } from '../ui/AnimatedNumber';

export interface CommunityMetricsHeaderProps {
  kpis: CommunitySummaryKPIs | null;
  isLoading?: boolean;
}

export const CommunityMetricsHeader: React.FC<CommunityMetricsHeaderProps> = ({
  kpis,
  isLoading = false,
}) => {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5"
    >
      {/* 1. Total Communities */}
      <motion.div
        variants={kpiCardEnter}
        className="rounded-[26px] p-6 bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs hover:border-amber-400/70 dark:hover:border-amber-500/40 hover:shadow-xs transition-all duration-200 group flex flex-col justify-between"
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400">
              Active Communities
            </span>
            <p className="text-[12px] text-[#475569] dark:text-slate-400 font-normal mt-0.5">
              Strategic clusters
            </p>
          </div>
          <div className="w-11 h-11 rounded-[16px] bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 text-[#2F65F6] dark:text-[#5878C7] flex items-center justify-center transition-transform group-hover:scale-105 shadow-2xs">
            <Users className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-[34px] sm:text-[36px] font-extrabold font-mono text-[#111727] dark:text-slate-100 tracking-tight leading-none">
            {isLoading ? '...' : <AnimatedNumber value={kpis?.total_communities ?? 0} />}
          </div>
          <div className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-2.5">
            Dynamic clustering partitions
          </div>
        </div>
      </motion.div>

      {/* 2. Monitored Sources */}
      <motion.div
        variants={kpiCardEnter}
        className="rounded-[26px] p-6 bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs hover:border-amber-400/70 dark:hover:border-amber-500/40 hover:shadow-xs transition-all duration-200 group flex flex-col justify-between"
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400">
              Monitored Sources
            </span>
            <p className="text-[12px] text-[#475569] dark:text-slate-400 font-normal mt-0.5">
              Verified feeds & authors
            </p>
          </div>
          <div className="w-11 h-11 rounded-[16px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-transform group-hover:scale-105 shadow-2xs">
            <Radio className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-[34px] sm:text-[36px] font-extrabold font-mono text-[#111727] dark:text-slate-100 tracking-tight leading-none">
            {isLoading ? '...' : <AnimatedNumber value={kpis?.total_monitored_sources ?? 0} />}
          </div>
          <div className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-2.5">
            Active observational nodes
          </div>
        </div>
      </motion.div>

      {/* 3. Total Messages Ingested */}
      <motion.div
        variants={kpiCardEnter}
        className="rounded-[26px] p-6 bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs hover:border-amber-400/70 dark:hover:border-amber-500/40 hover:shadow-xs transition-all duration-200 group flex flex-col justify-between"
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400">
              Corpus Messages
            </span>
            <p className="text-[12px] text-[#475569] dark:text-slate-400 font-normal mt-0.5">
              Canonical records indexed
            </p>
          </div>
          <div className="w-11 h-11 rounded-[16px] bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center transition-transform group-hover:scale-105 shadow-2xs">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-[34px] sm:text-[36px] font-extrabold font-mono text-[#111727] dark:text-slate-100 tracking-tight leading-none">
            {isLoading ? '...' : <AnimatedNumber value={kpis?.total_corpus_messages ?? 0} />}
          </div>
          <div className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-2.5">
            Indexed observational corpus
          </div>
        </div>
      </motion.div>

      {/* 4. Cross-Community Resonance */}
      <motion.div
        variants={kpiCardEnter}
        className="rounded-[26px] p-6 bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs hover:border-amber-400/70 dark:hover:border-amber-500/40 hover:shadow-xs transition-all duration-200 group flex flex-col justify-between"
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400">
              Cross-Domain Bridges
            </span>
            <p className="text-[12px] text-[#475569] dark:text-slate-400 font-normal mt-0.5">
              Resonating narratives
            </p>
          </div>
          <div className="w-11 h-11 rounded-[16px] bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center transition-transform group-hover:scale-105 shadow-2xs">
            <GitBranch className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-[34px] sm:text-[36px] font-extrabold font-mono text-rose-600 dark:text-rose-400 tracking-tight leading-none">
            {isLoading ? '...' : <AnimatedNumber value={kpis?.cross_community_resonance_count ?? 0} />}
          </div>
          <div className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-2.5">
            Cross-domain narrative spread
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
