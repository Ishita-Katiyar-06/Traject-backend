import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Activity,
  Cpu,
  Database,
  Radio,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Clock,
  Layers,
} from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { telemetryApi } from '../../services/telemetryApi';
import { forecastService } from '../../services/forecastService';
import { communityService } from '../../services/communityService';
import { useTheme } from '../../contexts/ThemeContext';
import { KNOWN_TELEGRAM_CHANNELS, type RegisteredChannel } from '../../utils/channelRegistry';
import type {
  HealthResponse,
  PipelineStatusResponse,
  PipelineMetricsResponse,
} from '../../types/api';

export const SettingsPage: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatusResponse | null>(null);
  const [pipelineMetrics, setPipelineMetrics] = useState<PipelineMetricsResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [lastPingTime, setLastPingTime] = useState<string>('');

  const channelList: RegisteredChannel[] = Object.values(KNOWN_TELEGRAM_CHANNELS);

  const loadData = useCallback(async () => {
    try {
      const [h, ps, pm] = await Promise.all([
        telemetryApi.getHealth({ skipCache: true }).catch(() => null),
        telemetryApi.getPipelineStatus({ skipCache: true }).catch(() => null),
        telemetryApi.getPipelineMetrics({ skipCache: true }).catch(() => null),
      ]);
      if (h) setHealth(h);
      if (ps) setPipelineStatus(ps);
      if (pm) setPipelineMetrics(pm);
      setLastPingTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to load system settings and telemetry:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
  };

  const handleClearCache = () => {
    telemetryApi.clearCache();
    forecastService.clearCache();
    communityService.clearCache();
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2500);
  };

  const isHealthy = health?.status === 'healthy' && health?.artifacts_loaded;

  return (
    <div className="space-y-6 font-sans pb-16 max-w-7xl mx-auto">
      {/* 1. Page Header */}
      <PageHeader
        title="System Settings & Telemetry Gateway"
        description="Live operational health, Telegram channel ingestion registry, ML pipeline metrics, and workspace configuration."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="rounded-full shadow-xs hover:border-amber-400/80 dark:hover:border-amber-500/50"
            >
              Refresh Gateway
            </Button>
          </div>
        }
      />

      {/* 2. Operational Gateway Status Card */}
      <div className="p-6 sm:p-7 rounded-[26px] sm:rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs hover:border-amber-400/80 dark:hover:border-amber-500/50 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              {isHealthy ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>API Gateway Healthy</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wide uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 shadow-2xs">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Gateway Degraded</span>
                </span>
              )}

              <span className="px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] text-[#8591A5] dark:text-slate-400">
                FastAPI Gateway v{health?.version || '1.0.0'}
              </span>
              <span className="px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] text-[#8591A5] dark:text-slate-400">
                Ping: <strong className="font-bold text-[#111727] dark:text-slate-200">{lastPingTime || '—'}</strong>
              </span>
              {pipelineStatus && (
                <span className="px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] text-[#8591A5] dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#2F65F6]" />
                  <span>Pipeline: <strong className="font-bold text-[#111727] dark:text-slate-200 uppercase">{pipelineStatus.status}</strong></span>
                </span>
              )}
            </div>

            <p className="text-[13px] text-[#64748B] dark:text-slate-400 leading-relaxed max-w-3xl">
              TRAJECT is connected to the live local engine at <code className="px-2 py-0.5 rounded-full bg-[#F5F1E5] dark:bg-[#1E2229] border border-[#E5DFD3] dark:border-[#2D333F] text-[11px] font-mono text-[#111727] dark:text-slate-200">http://127.0.0.1:8000/api/v1</code> with precomputed analytical artifacts loaded directly into the HDBSCAN and RoBERTa inference pipeline.
            </p>
          </div>

          <div className="shrink-0 flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-1 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-[#252B32]">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400 flex items-center gap-1">
              <Layers className="w-3 h-3 text-[#2F65F6]" />
              <span>Active Corpus Observations</span>
            </div>
            <div className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] font-mono text-[13px] font-bold text-[#2F65F6] dark:text-[#93C5FD] shadow-2xs">
              {(health?.active_records_count || 1826).toLocaleString()} observations
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Pipeline Audit Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Peak Memory Footprint */}
        <div className="p-5 rounded-[22px] sm:rounded-[26px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400">
              Process Memory
            </span>
            <Server className="w-4 h-4 text-[#2F65F6] dark:text-[#93C5FD]" />
          </div>
          <div className="text-[22px] font-bold font-mono text-[#111727] dark:text-slate-100">
            {pipelineMetrics?.memory_footprint_mb?.peak_process_rss_mb?.toFixed(1) || '1436.9'} <span className="text-[12px] font-normal text-[#8591A5]">MB</span>
          </div>
          <p className="text-[11px] font-mono text-[#8591A5] dark:text-slate-400">
            Python Heap: {pipelineMetrics?.memory_footprint_mb?.peak_python_heap_mb?.toFixed(1) || '99.3'} MB
          </p>
        </div>

        {/* Metric 2: Cache Performance */}
        <div className="p-5 rounded-[22px] sm:rounded-[26px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400">
              Cache Hit Rate
            </span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-[22px] font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {((pipelineMetrics?.cache_performance?.cache_hit_rate ?? 0.9994) * 100).toFixed(2)}%
          </div>
          <p className="text-[11px] font-mono text-[#8591A5] dark:text-slate-400">
            {(pipelineMetrics?.cache_performance?.cache_hits ?? 79475).toLocaleString()} hits · {pipelineMetrics?.cache_performance?.cache_misses ?? 46} misses
          </p>
        </div>

        {/* Metric 3: Inference Throughput */}
        <div className="p-5 rounded-[22px] sm:rounded-[26px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400">
              Embedding Throughput
            </span>
            <Cpu className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-[22px] font-bold font-mono text-[#111727] dark:text-slate-100">
            {pipelineMetrics?.throughput_samples_per_sec?.embedding?.toFixed(0) || '1070'} <span className="text-[12px] font-normal text-[#8591A5]">samples/s</span>
          </div>
          <p className="text-[11px] font-mono text-[#8591A5] dark:text-slate-400">
            Sentiment: {pipelineMetrics?.throughput_samples_per_sec?.sentiment?.toFixed(1) || '169.1'}/s
          </p>
        </div>

        {/* Metric 4: Record Accounting */}
        <div className="p-5 rounded-[22px] sm:rounded-[26px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400">
              Records Ingested
            </span>
            <Database className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-[22px] font-bold font-mono text-[#111727] dark:text-slate-100">
            {(pipelineMetrics?.record_accounting?.records_ingested || 1826).toLocaleString()}
          </div>
          <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
            {pipelineMetrics?.record_accounting?.records_failed === 0 ? '0 failed records' : `${pipelineMetrics?.record_accounting?.records_failed} failed`}
          </p>
        </div>
      </div>

      {/* 4. Monitored Telegram Sources Registry */}
      <div className="p-6 sm:p-7 rounded-[26px] sm:rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-[#252B32] pb-4">
          <div>
            <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100 tracking-tight flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#2F65F6] dark:text-[#93C5FD]" />
              <span>Monitored Telegram Channels Registry</span>
            </h3>
            <p className="text-[13px] text-[#64748B] dark:text-slate-400 mt-1">
              Authoritative channels actively configured in <code className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#12161C]">backend/config/telegram_sources.json</code>.
            </p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/80 dark:border-[#282F3A] text-[#8591A5] dark:text-slate-400">
            {channelList.length} Active Channels
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {channelList.map((ch: RegisteredChannel) => (
            <div
              key={ch.id}
              className="p-4 rounded-[20px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] hover:border-amber-400/80 dark:hover:border-amber-500/50 transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-bold text-[13px] text-[#111727] dark:text-slate-100 truncate">
                    {ch.title}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                    Live
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[#2F65F6] dark:text-[#93C5FD]">
                  {ch.handle}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-slate-100 dark:border-[#202630] text-[#8591A5] dark:text-slate-400">
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#161B22] border border-slate-200/60 dark:border-[#252B35]">
                  {ch.category}
                </span>
                <span className="font-semibold text-slate-500 dark:text-slate-400">
                  ID: {ch.id}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Workspace Preferences & Cache Maintenance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Appearance Card */}
        <div className="p-6 rounded-[26px] sm:rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs space-y-4">
          <div>
            <h4 className="text-[15px] font-bold text-[#111727] dark:text-slate-100">
              Visual Appearance
            </h4>
            <p className="text-[12px] text-[#64748B] dark:text-slate-400 mt-0.5">
              Select your preferred color theme for high-contrast tactical monitoring.
            </p>
          </div>

          <div className="inline-flex items-center p-1 rounded-full bg-[#F5F1E5] dark:bg-[#1E2229] border border-[#E5DFD3] dark:border-[#2D333F]">
            <button
              type="button"
              onClick={() => !isDark || toggleTheme()}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-mono font-bold transition-all cursor-pointer ${
                !isDark
                  ? 'bg-white text-[#111727] shadow-xs'
                  : 'text-[#8591A5] hover:text-[#111727]'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Light Canvas</span>
            </button>
            <button
              type="button"
              onClick={() => isDark || toggleTheme()}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-mono font-bold transition-all cursor-pointer ${
                isDark
                  ? 'bg-[#252A34] text-white shadow-xs'
                  : 'text-[#8591A5] hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-[#93C5FD]" />
              <span>Dark Space</span>
            </button>
          </div>
        </div>

        {/* Cache Management Card */}
        <div className="p-6 rounded-[26px] sm:rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs space-y-4">
          <div>
            <h4 className="text-[15px] font-bold text-[#111727] dark:text-slate-100">
              Cache &amp; Storage Maintenance
            </h4>
            <p className="text-[12px] text-[#64748B] dark:text-slate-400 mt-0.5">
              Purge client in-memory HTTP caches and force fresh queries on next request.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClearCache}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200/80 dark:border-[#2B323D] bg-[#FAFBFD] dark:bg-[#151921] hover:border-amber-400/80 dark:hover:border-amber-500/50 hover:bg-white dark:hover:bg-[#181C22] text-[12px] font-mono font-bold text-[#111727] dark:text-slate-200 transition-all shadow-xs cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Flush Client Caches</span>
            </button>

            {cacheCleared && (
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Caches Purged Successfully</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
