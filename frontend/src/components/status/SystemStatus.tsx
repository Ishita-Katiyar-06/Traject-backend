import React, { useState, useEffect } from 'react';
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

  const fetchHealth = async () => {
    setIsLoading(true);
    try {
      const res = await telemetryApi.getHealth();
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

  const config = {
    operational: {
      label: 'Operational',
      dotClass: 'bg-emerald-500',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      borderClass: 'border-emerald-500/25',
      icon: CheckCircle,
    },
    degraded: {
      label: 'Degraded',
      dotClass: 'bg-amber-500',
      textClass: 'text-amber-700 dark:text-amber-400',
      borderClass: 'border-amber-500/25',
      icon: AlertTriangle,
    },
    offline: {
      label: 'Offline',
      dotClass: 'bg-red-500',
      textClass: 'text-red-700 dark:text-red-400',
      borderClass: 'border-red-500/25',
      icon: XCircle,
    },
  }[statusType];

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated/80 hover:bg-surface border ${config.borderClass} text-small font-sans transition-all cursor-pointer shadow-xs ${className}`}
        title={`Backend API status: ${config.label} (Click for diagnostic telemetry)`}
        aria-label={`Backend API Status: ${config.label}`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${config.dotClass}`} />
        {showLabel && (
          <span className={`${config.textClass} font-medium text-[12px] capitalize`}>
            {config.label}
          </span>
        )}
      </button>

      {/* System Health Diagnostic Modal */}
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
            className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              variants={modalEnter}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full max-w-md rounded-modal bg-surface-elevated border border-border shadow-modal p-6 text-text-primary font-sans space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  statusType === 'operational' ? 'bg-emerald-500/10 text-emerald-600' :
                  statusType === 'degraded' ? 'bg-amber-500/10 text-amber-600' : 'bg-red-500/10 text-red-600'
                }`}>
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="system-status-dialog-title" className="text-[16px] font-bold">
                    Backend Service Health
                  </h3>
                  <p className="text-[11px] font-mono text-text-muted">
                    GET /api/v1/health
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchHealth}
                disabled={isLoading}
                aria-label="Refresh health probe"
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {health ? (
              <div className="space-y-3 text-[13px] font-mono">
                <div className="flex justify-between items-center p-2 rounded-lg bg-surface border border-border">
                  <span className="text-text-muted">API Status:</span>
                  <span className={`font-semibold flex items-center gap-1.5 ${config.textClass}`}>
                    <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
                    {health.status.toUpperCase()}
                  </span>
                </div>

                <div className="flex justify-between items-center p-2 rounded-lg bg-surface border border-border">
                  <span className="text-text-muted">Service Version:</span>
                  <span className="font-semibold text-text-primary">v{health.version}</span>
                </div>

                <div className="flex justify-between items-center p-2 rounded-lg bg-surface border border-border">
                  <span className="text-text-muted">Precomputed Artifacts:</span>
                  <span className={`font-semibold ${health.artifacts_loaded ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {health.artifacts_loaded ? 'Loaded into RAM' : 'Not Loaded (Degraded)'}
                  </span>
                </div>

                <div className="flex justify-between items-center p-2 rounded-lg bg-surface border border-border">
                  <span className="text-text-muted">Active In-Memory Messages:</span>
                  <span className="font-semibold text-text-primary">{formatCount(health.active_records_count)}</span>
                </div>

                <div className="flex justify-between items-center p-2 rounded-lg bg-surface border border-border">
                  <span className="text-text-muted">Active Prioritized Narratives:</span>
                  <span className="font-semibold text-text-primary">{formatCount(health.active_narratives_count)}</span>
                </div>

                <div className="flex justify-between items-center p-2 rounded-lg bg-surface border border-border">
                  <span className="text-text-muted">Active Dataset Source:</span>
                  <span className="font-semibold text-text-primary truncate max-w-[200px]" title={health.dataset_source || ''}>
                    {health.dataset_source || '--'}
                  </span>
                </div>

                <div className="flex justify-between items-center p-2 rounded-lg bg-surface border border-border">
                  <span className="text-text-muted">Health Evaluation UTC:</span>
                  <span className="text-text-muted text-[11px]">{formatUtcDateTime(health.timestamp_utc)}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-[13px] space-y-2">
                <p className="font-semibold">Backend Gateway Offline</p>
                <p className="text-[12px] text-text-muted">
                  Cannot connect to http://localhost:8000/api/v1/health. Verify that the FastAPI backend server is running.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setIsPipelineModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 text-[12px] font-mono font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>View Pipeline Latencies</span>
              </button>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-surface hover:bg-surface-elevated border border-border text-[13px] font-medium transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Observability Telemetry Modal */}
      <PipelineMetricsModal
        isOpen={isPipelineModalOpen}
        onClose={() => setIsPipelineModalOpen(false)}
      />
    </>
  );
};
