import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Server, Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { telemetryApi } from '../../services/telemetryApi';
import { HealthResponse } from '../../types/api';
import { formatCount, formatUtcDateTime } from '../../utils/telemetryFormatters';
import { PipelineMetricsModal } from '../pipeline/PipelineMetricsModal';
import { modalBackdrop, modalEnter } from '../../utils/motion';

export interface SystemStatusProps {
  showLabel?: boolean;
  className?: string;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({
  showLabel = true,
  className = '',
}) => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [statusType, setStatusType] = useState<'operational' | 'degraded' | 'offline'>('operational');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);

  const fetchHealth = async (skipCache = false) => {
    setIsLoading(true);
    try {
      if (skipCache) {
        telemetryApi.clearCache();
      }
      const minDelay = skipCache ? new Promise((resolve) => setTimeout(resolve, 600)) : Promise.resolve();
      const [res] = await Promise.all([telemetryApi.getHealth({ skipCache }), minDelay]);
      setHealth(res);
      if (res.status === 'healthy' && res.artifacts_loaded) {
        setStatusType('operational');
      } else {
        setStatusType('degraded');
      }
    } catch {
      setStatusType('offline');
      setHealth(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Poll every 30 seconds
    const timer = setInterval(fetchHealth, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    if (isModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isModalOpen]);

  const config = {
    operational: {
      label: 'Operational',
      dotClass: 'bg-[#22A06B] dark:bg-[#34D399]',
      textClass: 'text-[#22A06B] dark:text-[#34D399]',
      borderClass: 'border-[#22A06B]/25 dark:border-[#34D399]/30',
      icon: CheckCircle,
    },
    degraded: {
      label: 'Degraded',
      dotClass: 'bg-[#E9A23B] dark:bg-[#FBBF24]',
      textClass: 'text-[#E9A23B] dark:text-[#FBBF24]',
      borderClass: 'border-[#E9A23B]/25 dark:border-[#FBBF24]/30',
      icon: AlertTriangle,
    },
    offline: {
      label: 'Offline',
      dotClass: 'bg-[#E35D5D] dark:bg-[#F87171]',
      textClass: 'text-[#E35D5D] dark:text-[#F87171]',
      borderClass: 'border-[#E35D5D]/25 dark:border-[#F87171]/30',
      icon: XCircle,
    },
  }[statusType];

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-[#171C22] hover:bg-[#F8FAFD] dark:hover:bg-[#1D232A] border ${config.borderClass} text-small font-sans transition-all cursor-pointer shadow-subtle ${className}`}
        title={`Backend API status: ${config.label} (Click for diagnostic telemetry)`}
        aria-label={`Backend API Status: ${config.label}`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${config.dotClass}`} />
        {showLabel && (
          <span className={`${config.textClass} font-semibold text-[12px] capitalize`}>
            {config.label}
          </span>
        )}
      </button>

      {/* System Health Diagnostic Modal (Portaled to document.body) */}
      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="system-status-dialog-title"
              variants={modalBackdrop}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-0 z-modal flex items-center justify-center bg-slate-950/45 backdrop-blur-[4px] p-4"
              onClick={() => setIsModalOpen(false)}
            >
              <motion.div
                variants={modalEnter}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full max-w-md rounded-modal bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.9)] dark:border-[#2B323A] shadow-modal p-6 text-text-primary font-sans space-y-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${statusType === 'operational' ? 'bg-emerald-500/10 text-emerald-600' :
                        statusType === 'degraded' ? 'bg-amber-500/10 text-amber-600' : 'bg-red-500/10 text-red-600'
                      }`}>
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 id="system-status-dialog-title" className="text-[16px] font-bold text-[#111727] dark:text-[#F8FAFC]">
                        Backend Service Health
                      </h3>
                      <p className="text-[11px] font-mono text-[#8591A5] dark:text-[#94A3B8]">
                        GET /api/v1/health
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchHealth(true)}
                    disabled={isLoading}
                    aria-label="Refresh health probe"
                    className="p-1.5 rounded-lg text-[#8591A5] hover:text-[#111727] dark:hover:text-[#F8FAFC] hover:bg-[#F8FAFD] dark:hover:bg-[#1D232A] transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {health ? (
                  <div className="space-y-2.5 text-[13px] font-mono">
                    <div className="flex justify-between items-center p-2.5 rounded-[12px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32]">
                      <span className="text-[#8591A5] dark:text-[#94A3B8]">API Status:</span>
                      <span className={`font-semibold flex items-center gap-1.5 ${config.textClass}`}>
                        <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
                        {health.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2.5 rounded-[12px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32]">
                      <span className="text-[#8591A5] dark:text-[#94A3B8]">Service Version:</span>
                      <span className="font-semibold text-[#111727] dark:text-[#F8FAFC]">v{health.version}</span>
                    </div>

                    <div className="flex justify-between items-center p-2.5 rounded-[12px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32]">
                      <span className="text-[#8591A5] dark:text-[#94A3B8]">Precomputed Artifacts:</span>
                      <span className={`font-semibold ${health.artifacts_loaded ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {health.artifacts_loaded ? 'Loaded into RAM' : 'Not Loaded (Degraded)'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2.5 rounded-[12px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32]">
                      <span className="text-[#8591A5] dark:text-[#94A3B8]">Active In-Memory Messages:</span>
                      <span className="font-semibold text-[#111727] dark:text-[#F8FAFC]">{formatCount(health.active_records_count)}</span>
                    </div>

                    <div className="flex justify-between items-center p-2.5 rounded-[12px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32]">
                      <span className="text-[#8591A5] dark:text-[#94A3B8]">Active Prioritized Narratives:</span>
                      <span className="font-semibold text-[#111727] dark:text-[#F8FAFC]">{formatCount(health.active_narratives_count)}</span>
                    </div>

                    <div className="flex justify-between items-center p-2.5 rounded-[12px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32]">
                      <span className="text-[#8591A5] dark:text-[#94A3B8]">Active Dataset Source:</span>
                      <span className="font-semibold text-[#111727] dark:text-[#F8FAFC] truncate max-w-[180px]" title={health.dataset_source || ''}>
                        {health.dataset_source || '--'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2.5 rounded-[12px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32]">
                      <span className="text-[#8591A5] dark:text-[#94A3B8]">Health Evaluation UTC:</span>
                      <span className="text-[#8591A5] dark:text-[#94A3B8] text-[11px]">{formatUtcDateTime(health.timestamp_utc)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-[13px] space-y-2">
                    <p className="font-semibold">Backend Gateway Offline</p>
                    <p className="text-[12px] text-[#8591A5] dark:text-[#94A3B8]">
                      Cannot connect to http://localhost:8000/api/v1/health. Verify that the FastAPI backend server is running.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-[rgba(228,233,245,0.85)] dark:border-[#2B323A]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setIsPipelineModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 text-[12px] font-mono font-medium text-[#2F65F6] hover:text-[#2152DE] dark:text-[#93C5FD] cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>View Pipeline Latencies</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-1.5 rounded-full bg-[#F8FAFD] dark:bg-[#1D232A] hover:bg-slate-100 dark:hover:bg-[#252B32] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] text-[#111727] dark:text-[#F8FAFC] text-[13px] font-medium transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Observability Telemetry Modal */}
      <PipelineMetricsModal
        isOpen={isPipelineModalOpen}
        onClose={() => setIsPipelineModalOpen(false)}
      />
    </>
  );
};
