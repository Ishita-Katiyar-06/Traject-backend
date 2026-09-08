import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ExternalLink,
  GitBranch,
  Hash,
  Send,
  Activity,
} from 'lucide-react';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import type { PriorityTier } from '../../../types/api';

export interface SelectedEntityContext {
  type: 'narrative' | 'topic' | 'channel' | 'edge';
  id: string;
  title: string;
  subtitle?: string;
  priorityTier?: PriorityTier;
  priorityScore?: number;
  messageCount?: number;
  platform?: string;
  role?: string;
  subScores?: {
    spread_score?: number;
    coordination_score?: number;
    reach_score?: number;
    friction_score?: number;
  };
  keywords?: string[];
  firstObservedAt?: string;
  lastObservedAt?: string;
  edgeDetails?: {
    source: string;
    target: string;
    relationship: string;
    metricLabel?: string;
    metricValue?: string | number;
  };
}

export interface InvestigationContextDrawerProps {
  selectedEntity: SelectedEntityContext | null;
  onClose: () => void;
}

export const InvestigationContextDrawer: React.FC<InvestigationContextDrawerProps> = ({
  selectedEntity,
  onClose,
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedEntity) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEntity, onClose]);

  return (
    <AnimatePresence>
      {selectedEntity && (
        <>
          {/* Backdrop overlay (click anywhere on graph canvas to dismiss drawer) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/20 dark:bg-slate-950/40 backdrop-blur-[1px] z-20 cursor-pointer"
            aria-hidden="true"
          />

          <motion.aside
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-0 bottom-0 w-[90%] sm:w-96 bg-white dark:bg-[#171C22] border-l border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-2xl flex flex-col h-full z-30 overflow-hidden font-sans"
            aria-label="Investigation Context Inspector"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-[#252B32] flex items-center justify-between bg-[#F8FAFD] dark:bg-[#13171C]">
              <div className="flex items-center gap-2 min-w-0">
                {selectedEntity.type === 'narrative' && (
                  <GitBranch className="w-4 h-4 text-[#E35D5D] shrink-0" />
                )}
                {selectedEntity.type === 'topic' && (
                  <Hash className="w-4 h-4 text-[#2F65F6] shrink-0" />
                )}
                {selectedEntity.type === 'channel' && (
                  <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                {selectedEntity.type === 'edge' && (
                  <Activity className="w-4 h-4 text-[#6366F1] dark:text-[#818CF8] shrink-0" />
                )}
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#8591A5] dark:text-[#94A3B8] font-mono">
                  {selectedEntity.type} Context
                </span>
              </div>
              <IconButton
                aria-label="Close drawer"
                icon={<X className="w-4 h-4 text-[#8591A5] dark:text-[#94A3B8] hover:text-[#111727] dark:hover:text-[#F8FAFC]" />}
                size="sm"
                onClick={onClose}
              />
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Title & Identifier */}
              <div>
                <div className="font-mono text-[11px] text-[#8591A5] dark:text-[#7A8699] select-all">
                  ID: {selectedEntity.id}
                </div>
                <h3 className="text-[16px] font-bold text-[#111727] dark:text-[#F8FAFC] mt-1 leading-snug">
                  {selectedEntity.title}
                </h3>
                {selectedEntity.subtitle && (
                  <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                    {selectedEntity.subtitle}
                  </p>
                )}
              </div>

              {/* Narrative Priority Metrics */}
              {selectedEntity.type === 'narrative' && (
                <div className="p-4 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#8591A5] dark:text-[#94A3B8] uppercase font-mono">
                      Priority Signal Score
                    </span>
                    <span className="font-mono text-[18px] font-bold text-[#111727] dark:text-[#F8FAFC]">
                      {selectedEntity.priorityScore?.toFixed(3) ?? '—'}
                    </span>
                  </div>

                  {selectedEntity.subScores && (
                    <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-[rgba(228,233,245,0.85)] dark:border-[#252B32] text-[11px] font-mono">
                      <div className="p-2.5 rounded-[12px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A]">
                        <span className="text-[#8591A5] dark:text-[#94A3B8] block">Spread</span>
                        <strong className="text-[#111727] dark:text-[#F8FAFC] text-[13px]">
                          {selectedEntity.subScores.spread_score?.toFixed(2) ?? '—'}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-[12px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A]">
                        <span className="text-[#8591A5] dark:text-[#94A3B8] block">Coordination</span>
                        <strong className="text-[#111727] dark:text-[#F8FAFC] text-[13px]">
                          {selectedEntity.subScores.coordination_score?.toFixed(2) ?? '—'}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-[12px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A]">
                        <span className="text-[#8591A5] dark:text-[#94A3B8] block">Observed Reach</span>
                        <strong className="text-[#111727] dark:text-[#F8FAFC] text-[13px]">
                          {selectedEntity.subScores.reach_score?.toFixed(2) ?? '—'}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-[12px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A]">
                        <span className="text-[#8591A5] dark:text-[#94A3B8] block">Friction</span>
                        <strong className="text-[#111727] dark:text-[#F8FAFC] text-[13px]">
                          {selectedEntity.subScores.friction_score?.toFixed(2) ?? '—'}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Topic Keywords & Message Count */}
              {selectedEntity.type === 'topic' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-[18px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] flex items-center justify-between">
                    <span className="text-[12px] text-[#8591A5] dark:text-[#94A3B8] font-medium">Cluster Volume</span>
                    <span className="font-mono text-[14px] font-bold text-[#111727] dark:text-[#F8FAFC]">
                      {selectedEntity.messageCount ?? 0} messages
                    </span>
                  </div>

                  {selectedEntity.keywords && selectedEntity.keywords.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-[#8591A5] dark:text-[#94A3B8] uppercase tracking-wider font-mono block mb-2">
                        c-TF-IDF Representative Terms
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedEntity.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg text-[12px] font-mono bg-blue-50 text-[#2F65F6] dark:bg-blue-950/40 dark:text-[#93C5FD] border border-blue-100 dark:border-blue-900/40"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Channel Context */}
              {selectedEntity.type === 'channel' && (
                <div className="p-4 rounded-[18px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] space-y-2.5 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#8591A5] dark:text-[#94A3B8]">Platform</span>
                    <span className="font-mono font-semibold capitalize text-[#111727] dark:text-[#F8FAFC]">
                      {selectedEntity.platform || 'Telegram'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8591A5] dark:text-[#94A3B8]">Observed Role</span>
                    <span className="font-mono font-semibold uppercase text-[#111727] dark:text-[#F8FAFC]">
                      {selectedEntity.role || 'Transmitter'}
                    </span>
                  </div>
                  {selectedEntity.messageCount !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#8591A5] dark:text-[#94A3B8]">Observations</span>
                      <span className="font-mono font-semibold text-[#111727] dark:text-[#F8FAFC]">
                        {selectedEntity.messageCount} msgs
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Edge Details */}
              {selectedEntity.type === 'edge' && selectedEntity.edgeDetails && (
                <div className="p-4 rounded-[18px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] space-y-2.5 text-[12px]">
                  <div>
                    <span className="text-[#8591A5] dark:text-[#94A3B8] block text-[11px] uppercase font-mono">
                      Relationship
                    </span>
                    <span className="font-mono font-bold text-[#111727] dark:text-[#F8FAFC]">
                      {selectedEntity.edgeDetails.relationship}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-[rgba(228,233,245,0.85)] dark:border-[#252B32] font-mono text-[11px] space-y-1">
                    <div className="text-[#8591A5] dark:text-[#94A3B8] truncate">
                      From: <strong className="text-[#111727] dark:text-[#F8FAFC]">{selectedEntity.edgeDetails.source}</strong>
                    </div>
                    <div className="text-[#8591A5] dark:text-[#94A3B8] truncate">
                      To: <strong className="text-[#111727] dark:text-[#F8FAFC]">{selectedEntity.edgeDetails.target}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-[#252B32] bg-[#F8FAFD] dark:bg-[#13171C]">
              {selectedEntity.type === 'narrative' && (
                <Button
                  variant="primary"
                  size="md"
                  className="w-full justify-center"
                  rightIcon={<ExternalLink className="w-4 h-4" />}
                  onClick={() => navigate(`/narratives/${encodeURIComponent(selectedEntity.id)}`)}
                >
                  Open Narrative Dossier
                </Button>
              )}
              {selectedEntity.type === 'topic' && (
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full justify-center"
                  rightIcon={<ExternalLink className="w-4 h-4" />}
                  onClick={() => navigate(`/trends/${encodeURIComponent(selectedEntity.id)}`)}
                >
                  Inspect Trend Cluster
                </Button>
              )}
              {selectedEntity.type === 'channel' && (
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full justify-center"
                  rightIcon={<ExternalLink className="w-4 h-4" />}
                  onClick={() => navigate(`/explorer?search=${encodeURIComponent(selectedEntity.title || selectedEntity.id)}`)}
                >
                  Filter Channel in Explorer
                </Button>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
