import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LucideIcon, ArrowRight, Layers, GitBranch, Hash, Database } from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../ui/Button';

export interface PlaceholderPageProps {
  title: string;
  description: string;
  milestone?: string;
  icon: LucideIcon;
  category: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  description,
  milestone = 'Milestone 6 Planned',
  icon: Icon,
  category,
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 font-sans max-w-5xl">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/overview')}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Go to Overview
          </Button>
        }
      />

      {/* Planned Feature Card */}
      <div className="p-8 md:p-12 rounded-[20px] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] bg-white dark:bg-[#171C22] shadow-dashboard text-center space-y-6">
        <div className="w-16 h-16 rounded-[18px] bg-gradient-to-tr from-[#2563EB]/10 to-[#60A5FA]/10 dark:from-[#2563EB]/20 dark:to-[#60A5FA]/20 border border-[#2563EB]/20 dark:border-[#2563EB]/30 flex items-center justify-center mx-auto text-[#2563EB] dark:text-[#93C5FD] shadow-xs">
          <Icon className="w-8 h-8" />
        </div>

        <div className="space-y-2 max-w-lg mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase bg-[#EEF2FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 border border-[#2563EB]/20 dark:border-blue-900/40">
            {milestone}
          </div>
          <h2 className="text-[22px] font-bold text-[#111727] dark:text-slate-100 tracking-tight">
            {category} Intelligence Architecture
          </h2>
          <p className="text-[13px] text-[#64748B] dark:text-slate-400 leading-relaxed">
            This module is scheduled for implementation in a future milestone. The authoritative Milestone 5A backend contract currently provides production endpoints for <strong className="text-[#111727] dark:text-slate-200">Narrative Intelligence</strong>, <strong className="text-[#111727] dark:text-slate-200">Semantic Topic Discovery</strong>, and <strong className="text-[#111727] dark:text-slate-200">Corpus Observation Exploration</strong>.
          </p>
        </div>

        {/* Available Live 5A Telemetry Routes */}
        <div className="pt-6 border-t border-slate-100 dark:border-[#2B323A] max-w-xl mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400 mb-4">
            Available Live Milestone 5A Dashboards
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            <button
              type="button"
              onClick={() => navigate('/narratives')}
              className="p-3.5 rounded-[14px] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] hover:border-[#2563EB]/40 dark:hover:border-blue-700/50 bg-[#F8FAFD] dark:bg-[#12161C] hover:bg-[#EEF2FF] dark:hover:bg-[#1A2230] transition-all flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#171C22] flex items-center justify-center text-[#FF6D5A] shadow-2xs group-hover:scale-105 transition-transform border border-slate-100 dark:border-[#2B323A]">
                <GitBranch className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-[#111727] dark:text-slate-200">Narrative Triage</div>
                <div className="text-[11px] text-[#64748B] dark:text-slate-400">Ranked by 4G Signal Score</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/trends')}
              className="p-3.5 rounded-[14px] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] hover:border-[#2563EB]/40 dark:hover:border-blue-700/50 bg-[#F8FAFD] dark:bg-[#12161C] hover:bg-[#EEF2FF] dark:hover:bg-[#1A2230] transition-all flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#171C22] flex items-center justify-center text-[#2F65F6] shadow-2xs group-hover:scale-105 transition-transform border border-slate-100 dark:border-[#2B323A]">
                <Hash className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-[#111727] dark:text-slate-200">Emerging Trends</div>
                <div className="text-[11px] text-[#64748B] dark:text-slate-400">Algorithmic cluster index</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/explorer')}
              className="p-3.5 rounded-[14px] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] hover:border-[#2563EB]/40 dark:hover:border-blue-700/50 bg-[#F8FAFD] dark:bg-[#12161C] hover:bg-[#EEF2FF] dark:hover:bg-[#1A2230] transition-all flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#171C22] flex items-center justify-center text-[#10B981] shadow-2xs group-hover:scale-105 transition-transform border border-slate-100 dark:border-[#2B323A]">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-[#111727] dark:text-slate-200">Data Explorer</div>
                <div className="text-[11px] text-[#64748B] dark:text-slate-400">27 canonical fields</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/overview')}
              className="p-3.5 rounded-[14px] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] hover:border-[#2563EB]/40 dark:hover:border-blue-700/50 bg-[#F8FAFD] dark:bg-[#12161C] hover:bg-[#EEF2FF] dark:hover:bg-[#1A2230] transition-all flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#171C22] flex items-center justify-center text-[#2563EB] shadow-2xs group-hover:scale-105 transition-transform border border-slate-100 dark:border-[#2B323A]">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-[#111727] dark:text-slate-200">System Overview</div>
                <div className="text-[11px] text-[#64748B] dark:text-slate-400">High-level analytics</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
