import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Activity, Cpu, CheckCircle2, Clock, Zap } from 'lucide-react';
import { telemetryApi } from '../../services/telemetryApi';
import { PipelineMetricsResponse } from '../../types/api';
import { formatCount } from '../../utils/telemetryFormatters';
import { modalBackdrop, modalEnter } from '../../utils/motion';

interface PipelineMetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PipelineMetricsModal: React.FC<PipelineMetricsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [metrics, setMetrics] = useState<PipelineMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setError(null);
      telemetryApi
        .getPipelineMetrics()
        .then((res) => {
          setMetrics(res);
          setIsLoading(false);
        })
        .catch((err) => {
          setError(err?.friendlyMessage || 'Failed to load pipeline telemetry metrics.');
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pipeline-metrics-title"
          variants={modalBackdrop}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={onClose}
        >
          <motion.div
            variants={modalEnter}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-modal bg-surface-elevated border border-border shadow-modal p-6 text-text-primary font-sans space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 id="pipeline-metrics-title" className="text-[17px] font-bold tracking-tight">
                ML Pipeline Execution Telemetry
              </h3>
              <p className="text-[12px] font-mono text-text-muted">
                Audit-ready accounting from Milestone 4H/5A (/api/v1/pipeline/metrics)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pipeline metrics"
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center font-mono text-small text-text-muted flex flex-col items-center gap-3">
            <Activity className="w-6 h-6 text-blue-500 animate-spin" />
            <span>Querying pipeline metrics from backend gateway...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-[13px]">
            {error}
          </div>
        ) : metrics ? (
          <div className="space-y-6 text-[13px]">
            {/* Top Cards: Latency, Throughput, Cache, Memory */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                <span className="text-[11px] font-mono uppercase text-text-muted flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-500" /> Total Runtime
                </span>
                <p className="text-[18px] font-bold text-text-primary">
                  {metrics.stage_latencies_seconds.total_runtime.toFixed(3)}s
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                <span className="text-[11px] font-mono uppercase text-text-muted flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" /> Warm Inference
                </span>
                <p className="text-[18px] font-bold text-text-primary">
                  {metrics.execution_breakdown.warm_inference_time_seconds.toFixed(3)}s
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                <span className="text-[11px] font-mono uppercase text-text-muted flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Cache Hit Rate
                </span>
                <p className="text-[18px] font-bold text-text-primary">
                  {(metrics.cache_performance.cache_hit_rate * 100).toFixed(1)}%
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                <span className="text-[11px] font-mono uppercase text-text-muted flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-purple-500" /> Peak RSS
                </span>
                <p className="text-[18px] font-bold text-text-primary">
                  {metrics.memory_footprint_mb.peak_process_rss_mb.toFixed(1)} MB
                </p>
              </div>
            </div>

            {/* Stage Latencies Table */}
            <div className="space-y-2">
              <h4 className="text-[12px] font-mono uppercase text-text-muted font-semibold tracking-wider">
                Stage Execution Latencies (Seconds)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px] font-mono">
                {Object.entries(metrics.stage_latencies_seconds)
                  .filter(([k]) => k !== 'total_runtime')
                  .map(([stage, sec]) => (
                    <div
                      key={stage}
                      className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border/60"
                    >
                      <span className="text-text-secondary capitalize">
                        {stage.replace(/_/g, ' ')}
                      </span>
                      <span className="font-semibold text-text-primary">{sec.toFixed(4)}s</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Records & Throughput Accounting */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-surface border border-border space-y-2">
                <h4 className="text-[11px] font-mono uppercase text-text-muted font-semibold">
                  Record Accounting
                </h4>
                <div className="space-y-1 text-[12px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Ingested:</span>
                    <span className="font-semibold">{formatCount(metrics.record_accounting.records_ingested)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Processed:</span>
                    <span className="font-semibold">{formatCount(metrics.record_accounting.records_processed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Skipped:</span>
                    <span className="font-semibold">{formatCount(metrics.record_accounting.records_skipped)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Failed:</span>
                    <span className="font-semibold">{formatCount(metrics.record_accounting.records_failed)}</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface border border-border space-y-2">
                <h4 className="text-[11px] font-mono uppercase text-text-muted font-semibold">
                  Inference Throughput & Cache
                </h4>
                <div className="space-y-1 text-[12px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Embedding Throughput:</span>
                    <span className="font-semibold">{metrics.throughput_samples_per_sec.embedding.toFixed(1)} items/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Sentiment Throughput:</span>
                    <span className="font-semibold">{metrics.throughput_samples_per_sec.sentiment.toFixed(1)} items/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Cache Hits / Misses:</span>
                    <span className="font-semibold">
                      {formatCount(metrics.cache_performance.cache_hits)} / {formatCount(metrics.cache_performance.cache_misses)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Python Heap:</span>
                    <span className="font-semibold">{metrics.memory_footprint_mb.peak_python_heap_mb.toFixed(2)} MB</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface hover:bg-surface-elevated border border-border text-[13px] font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
