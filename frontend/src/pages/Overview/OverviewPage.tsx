import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  ArrowRight,
  Clock,
  Radio,
  Layers,
  Activity,
  AlertTriangle,
  Info,
  Server,
  Zap,
  Database,
  ShieldAlert,
} from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { telemetryApi } from '../../services/telemetryApi';
import { AnalyticsOverviewResponse, NarrativeSummaryResponse, PipelineStatusResponse } from '../../types/api';
import {
  formatPriorityTierBadge,
  formatEvidenceDensityBadge,
  formatDecimal,
  COORDINATION_WORDING,
  REACH_WORDING,
} from '../../utils/telemetryFormatters';
import { PipelineMetricsModal } from '../../components/pipeline/PipelineMetricsModal';
import { PriorityTierChart, SentimentDonutChart } from '../../components/ui/charts';
import { motion } from 'motion/react';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import {
  staggerContainer,
  kpiCardEnter,
  badgeSettle,
  listItemEnter,
} from '../../utils/motion';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState<AnalyticsOverviewResponse | null>(null);
  const [topNarratives, setTopNarratives] = useState<NarrativeSummaryResponse[]>([]);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);

  const loadData = async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    }
    setIsError(false);
    setErrorMessage('');
    try {
      const [analyticsData, narrativesData, statusData] = await Promise.all([
        telemetryApi.getAnalyticsOverview({ skipCache: !isInitial }),
        telemetryApi.getNarratives(
          {
            page: 1,
            page_size: 5,
            sort_by: 'priority_signal_score',
            order: 'desc',
          },
          { skipCache: !isInitial }
        ),
        telemetryApi.getPipelineStatus({ skipCache: !isInitial }).catch(() => null),
      ]);
      setAnalytics(analyticsData);
      setTopNarratives(narrativesData.data);
      if (statusData) {
        setPipelineStatus(statusData);
      }
    } catch (e: any) {
      console.error('Failed to load overview analytics:', e);
      setIsError(true);
      setErrorMessage(e.message || 'Failed to communicate with Traject Analytics API (/api/v1/analytics).');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncAnalytics = async () => {
    setIsRefreshing(true);
    telemetryApi.clearCache();
    const minDelay = new Promise((resolve) => setTimeout(resolve, 600));
    try {
      await Promise.all([loadData(false), minDelay]);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  const overviewData = analytics?.data;
  const priorityDist = overviewData?.priority_distribution;
  const summary = overviewData?.summary_counts;
  const sentiment = overviewData?.sentiment_overview;
  const execution = overviewData?.pipeline_execution;

  return (
    <div className="space-y-6 sm:space-y-8 font-sans pb-10">
      {/* 1. Page Header */}
      <PageHeader
        title="Intelligence Overview"
        description="Authoritative real-time aggregation across monitored narrative candidates, trends, and canonical messages."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Server className="w-4 h-4 text-[#2F65F6]" />}
              onClick={() => setIsMetricsOpen(true)}
            >
              Pipeline Telemetry
            </Button>

            <Button
              variant="secondary"
              size="md"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
              onClick={handleSyncAnalytics}
              disabled={isRefreshing || isLoading}
            >
              Sync Analytics
            </Button>
          </div>
        }
      />

      {/* Error Banner */}
      {isError && (
        <div className="p-4 sm:p-5 rounded-[20px] bg-rose-50/90 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/40 text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h4 className="text-[14px] font-bold leading-snug">Failed to load analytics telemetry</h4>
              <p className="text-[13px] text-rose-700 dark:text-rose-300 mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => loadData(true)} className="shrink-0 self-start sm:self-center">
            Retry Connection
          </Button>
        </div>
      )}

      {/* 2. Live Pipeline Telemetry Banner */}
      <div className="rounded-[20px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-dashboard p-4 sm:px-6 sm:py-3.5 flex flex-wrap items-center justify-between gap-4 text-[13px]">
        <div className="flex items-center gap-3 flex-wrap text-[#64748B] dark:text-slate-400">
          <span className="flex items-center gap-1.5 text-[#111727] dark:text-slate-200 font-semibold">
            <Clock className="w-4 h-4 text-[#2F65F6] dark:text-[#5878C7]" />
            <span>
              Ingestion Timestamp:{' '}
              <span className="font-mono text-[12px] font-medium text-[#475569] dark:text-slate-300">
                {execution?.created_at_utc ? new Date(execution.created_at_utc).toLocaleString() : 'Awaiting sync'}
              </span>
            </span>
          </span>

          {overviewData?.dataset_source && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Dataset:{' '}
                  <span className="font-mono font-medium text-[#111727] dark:text-slate-200">
                    {overviewData.dataset_source}
                  </span>
                </span>
              </span>
            </>
          )}

          {pipelineStatus?.cumulative_record_count && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>
                Corpus:{' '}
                <span className="font-mono font-medium text-[#111727] dark:text-slate-200">
                  <AnimatedNumber value={pipelineStatus.cumulative_record_count} /> msgs
                </span>
              </span>
            </>
          )}

          {pipelineStatus?.last_collection_run && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="flex items-center gap-1.5">
                <span>Last Sync:</span>
                <span className="font-mono text-[12px] text-[#475569] dark:text-slate-300">
                  {new Date(pipelineStatus.last_collection_run).toLocaleTimeString()}
                </span>
                {pipelineStatus.last_new_record_count !== null && pipelineStatus.last_new_record_count !== undefined && (
                  <motion.span
                    key={pipelineStatus.last_new_record_count}
                    variants={badgeSettle}
                    initial="initial"
                    animate="animate"
                    className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-900/50 inline-block"
                  >
                    +{pipelineStatus.last_new_record_count} new
                  </motion.span>
                )}
              </span>
            </>
          )}

          {execution && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>
                Runtime:{' '}
                <span className="font-mono text-[12px] bg-[#F1F4F9] dark:bg-[#1D232A] text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full border border-slate-200/60 dark:border-[#2B323A]">
                  {execution.total_runtime_seconds.toFixed(2)}s
                </span>
              </span>
            </>
          )}

          {pipelineStatus?.active_lineages_count !== undefined && pipelineStatus?.active_lineages_count !== null && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>
                Lineages:{' '}
                <span className="font-mono font-medium text-[#111727] dark:text-slate-200">
                  <AnimatedNumber value={pipelineStatus.active_lineages_count} /> active
                </span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 font-semibold shrink-0">
          {pipelineStatus?.analytics_current === false ? (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <span
                className="text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-2.5 py-0.5 rounded-full font-mono text-[11px] uppercase tracking-wider font-semibold"
                title={pipelineStatus.stale_analytics_reason || 'Analytics artifact does not reflect recent ingested records'}
              >
                Analytics Stale (Pending Run)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-700 dark:text-emerald-400 font-mono text-[12px] uppercase tracking-wider font-bold">
                {pipelineStatus?.corpus_snapshot_id ? 'Snapshot Sync' : 'Pipeline Ready'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Top-Level Summary KPIs (4 Cards in responsive grid) */}
      <motion.section
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        {/* KPI 1: Ingested Messages */}
        <motion.div
          variants={kpiCardEnter}
          className="rounded-[24px] p-6 shadow-dashboard bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] flex flex-col justify-between transition-all duration-200 hover:shadow-dashboard-hover group"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">
                Total Ingested
              </span>
              <p className="text-[12px] text-[#475569] dark:text-slate-400 font-medium mt-0.5">Canonical corpus</p>
            </div>
            <div className="w-10 h-10 rounded-[14px] bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800/40 flex items-center justify-center text-[#2F65F6] dark:text-[#5878C7] shadow-2xs transition-transform duration-200 group-hover:scale-105">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5">
            <div className="text-[34px] sm:text-[36px] font-bold text-[#111727] dark:text-slate-100 font-mono tracking-tight leading-none">
              {isLoading ? (
                <div className="h-9 w-32 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              ) : (
                <AnimatedNumber value={summary?.total_messages ?? 0} />
              )}
            </div>
            <div className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-2">
              Noise filtered: <span className="font-mono text-[#475569] dark:text-slate-300 font-semibold"><AnimatedNumber value={summary?.noise_messages ?? 0} /></span> items
            </div>
          </div>
        </motion.div>

        {/* KPI 2: Trend Clusters */}
        <motion.div
          variants={kpiCardEnter}
          className="rounded-[24px] p-6 shadow-dashboard bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] flex flex-col justify-between transition-all duration-200 hover:shadow-dashboard-hover group"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">
                Discovered Trends
              </span>
              <p className="text-[12px] text-[#475569] dark:text-slate-400 font-medium mt-0.5">c-TF-IDF semantic clusters</p>
            </div>
            <div className="w-10 h-10 rounded-[14px] bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs transition-transform duration-200 group-hover:scale-105">
              <Radio className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5">
            <div className="text-[34px] sm:text-[36px] font-bold text-[#111727] dark:text-slate-100 font-mono tracking-tight leading-none">
              {isLoading ? (
                <div className="h-9 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              ) : (
                <AnimatedNumber value={summary?.total_topics ?? 0} />
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate('/trends')}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2F65F6] dark:text-[#5878C7] hover:underline mt-2 transition-colors group/link"
            >
              <span>Explore trends</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-1" />
            </button>
          </div>
        </motion.div>

        {/* KPI 3: Priority Narratives (The Signature Coral Peach Sunset Gradient) */}
        <motion.div
          variants={kpiCardEnter}
          className="rounded-[24px] p-6 shadow-dashboard bg-gradient-to-br from-[#FFA690] via-[#FF856D] to-[#FFEBE5] dark:from-[#D9533B] dark:via-[#B33E2A] dark:to-[#7A2416] border border-orange-200/60 dark:border-orange-900/40 flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:shadow-dashboard-hover group"
        >
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-white/20 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[12px] font-bold text-[#111727] dark:text-white uppercase tracking-wider">
                Narrative Candidates
              </span>
              <p className="text-[12px] text-[#475569] dark:text-slate-100 font-medium mt-0.5">4G scored candidates</p>
            </div>
            <div className="w-10 h-10 rounded-[14px] bg-white/40 backdrop-blur-sm border border-white/50 flex items-center justify-center text-[#111727] dark:text-white shadow-2xs transition-transform duration-200 group-hover:scale-105">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5 relative z-10">
            <div className="text-[34px] sm:text-[36px] font-bold text-[#111727] dark:text-white font-mono tracking-tight leading-none">
              {isLoading ? (
                <div className="h-9 w-20 bg-white/30 rounded-lg animate-pulse" />
              ) : (
                <AnimatedNumber value={summary?.total_narratives ?? 0} />
              )}
            </div>
            <div className="text-[12px] text-[#111727] dark:text-white font-medium mt-2">
              Elevated / Active:{' '}
              <span className="font-mono font-bold">
                <AnimatedNumber value={(priorityDist?.critical ?? 0) + (priorityDist?.high ?? 0) + (priorityDist?.elevated ?? 0)} />
              </span>
            </div>
          </div>
        </motion.div>

        {/* KPI 4: Critical Priority Attention */}
        <motion.div
          variants={kpiCardEnter}
          className="rounded-[24px] p-6 shadow-dashboard bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] flex flex-col justify-between transition-all duration-200 hover:shadow-dashboard-hover group"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">
                Critical Priority
              </span>
              <p className="text-[12px] text-[#475569] dark:text-slate-400 font-medium mt-0.5">Immediate triage</p>
            </div>
            <div className="w-10 h-10 rounded-[14px] bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-800/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-2xs transition-transform duration-200 group-hover:scale-105">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5">
            <div className="text-[34px] sm:text-[36px] font-bold text-rose-600 dark:text-rose-400 font-mono tracking-tight leading-none">
              {isLoading ? (
                <div className="h-9 w-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              ) : (
                <AnimatedNumber value={priorityDist?.critical ?? 0} />
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate('/narratives?priority_tier=critical')}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 mt-2 transition-colors group/link"
            >
              <span>Filter critical candidates</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-1" />
            </button>
          </div>
        </motion.div>
      </motion.section>

      {/* 4. Priority Tier Distribution & Sentiment Profiling */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Priority Tier Distribution */}
        <div className="rounded-[24px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] p-6 sm:p-7 shadow-dashboard flex flex-col justify-between transition-all duration-200 hover:shadow-dashboard-hover">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252B32] pb-4">
              <div>
                <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100 tracking-tight">
                  Priority Signal Tier Breakdown
                </h3>
                <p className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-0.5">
                  Backend 4G composite scoring distribution
                </p>
              </div>
              <span className="text-[11px] font-mono text-[#64748B] dark:text-slate-400 bg-[#F1F4F9] dark:bg-[#1D232A] px-2.5 py-1 rounded-full border border-slate-200/60 dark:border-[#2B323A] font-semibold">
                Frozen Formula
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-[16px] bg-rose-50/70 dark:bg-rose-950/25 border border-rose-200/60 dark:border-rose-900/30 transition-colors">
                <div className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Critical</div>
                <div className="text-[24px] font-bold text-rose-800 dark:text-rose-200 font-mono mt-1 leading-tight">
                  {priorityDist?.critical ?? 0}
                </div>
                <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-medium font-mono">Score ≥ 0.75</div>
              </div>

              <div className="p-3.5 rounded-[16px] bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/60 dark:border-amber-900/30 transition-colors">
                <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">High</div>
                <div className="text-[24px] font-bold text-amber-800 dark:text-amber-200 font-mono mt-1 leading-tight">
                  {priorityDist?.high ?? 0}
                </div>
                <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium font-mono">0.55 – 0.74</div>
              </div>

              <div className="p-3.5 rounded-[16px] bg-blue-50/70 dark:bg-blue-950/25 border border-blue-200/60 dark:border-blue-900/30 transition-colors">
                <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Elevated</div>
                <div className="text-[24px] font-bold text-blue-800 dark:text-blue-200 font-mono mt-1 leading-tight">
                  {priorityDist?.elevated ?? 0}
                </div>
                <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-medium font-mono">0.35 – 0.54</div>
              </div>

              <div className="p-3.5 rounded-[16px] bg-[#F8FAFD] dark:bg-[#1D232A] border border-slate-200/70 dark:border-[#2B323A] transition-colors">
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Routine</div>
                <div className="text-[24px] font-bold text-slate-800 dark:text-slate-200 font-mono mt-1 leading-tight">
                  {priorityDist?.routine ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium font-mono">&lt; 0.35</div>
              </div>
            </div>

            {/* Analytical Distribution Chart */}
            <div className="pt-1">
              <PriorityTierChart data={priorityDist} isLoading={isLoading} />
            </div>
          </div>

          <div className="p-3.5 rounded-[16px] bg-[#F8FAFD] dark:bg-[#12161C] border border-slate-200/60 dark:border-[#2B323A] text-[12px] text-[#64748B] dark:text-slate-400 flex items-center gap-2.5 mt-4">
            <Info className="w-4 h-4 text-[#2F65F6] dark:text-[#5878C7] shrink-0" />
            <span className="leading-relaxed">
              Priority Signal Score = 0.30 · Spread + 0.30 · Coordination + 0.20 · {REACH_WORDING.primary} + 0.20 · Friction.
            </span>
          </div>
        </div>

        {/* Sentiment Overview & Availability */}
        <div className="rounded-[24px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] p-6 sm:p-7 shadow-dashboard flex flex-col justify-between transition-all duration-200 hover:shadow-dashboard-hover">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252B32] pb-4">
              <div>
                <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100 tracking-tight">
                  Corpus Sentiment Overview
                </h3>
                <p className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-0.5">
                  Evaluated message distribution
                </p>
              </div>
              {sentiment && sentiment.evaluated_messages_count > 0 ? (
                <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 px-2.5 py-1 rounded-full font-semibold">
                  Evaluated ({sentiment.evaluated_messages_count.toLocaleString()} msgs)
                </span>
              ) : (
                <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-[#F1F4F9] dark:bg-[#1D232A] px-2.5 py-1 rounded-full font-semibold border border-slate-200/60 dark:border-[#2B323A]">
                  Coverage Limited
                </span>
              )}
            </div>

            {sentiment && sentiment.evaluated_messages_count > 0 ? (
              <div className="pt-2">
                <SentimentDonutChart
                  positiveRatio={sentiment.distribution.positive_ratio}
                  neutralRatio={sentiment.distribution.neutral_ratio}
                  negativeRatio={sentiment.distribution.negative_ratio}
                  evaluatedCount={sentiment.evaluated_messages_count}
                  isLoading={isLoading}
                />
              </div>
            ) : (
              <div className="py-10 px-6 rounded-[20px] bg-[#F8FAFD] dark:bg-[#12161C] border border-slate-200/60 dark:border-[#2B323A] text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-center mx-auto text-amber-500">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h4 className="text-[15px] font-bold text-[#111727] dark:text-slate-200">
                  Sentiment Inference Unavailable
                </h4>
                <p className="text-[13px] text-[#64748B] dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Corpus sentiment classification has not been evaluated or has insufficient data coverage. Values are preserved as uncomputed rather than fabricated neutral.
                </p>
              </div>
            )}
          </div>

          {/* Model Container matching the left container perfectly */}
          <div className="p-3.5 rounded-[16px] bg-[#F8FAFD] dark:bg-[#12161C] border border-slate-200/60 dark:border-[#2B323A] text-[12px] text-[#64748B] dark:text-slate-400 flex items-center justify-center gap-2 mt-4">
            <span className="font-mono text-[11.5px] truncate">
              Model: <strong className="text-[#334155] dark:text-slate-200 font-medium">{sentiment?.sentiment_model_id || 'cardiffnlp/twitter-roberta-base-sentiment-latest'}</strong>
            </span>
          </div>
        </div>
      </section>

      {/* 5. Top Emerging Narrative Candidates (Operational Surface) */}
      <section className="rounded-[24px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] p-6 sm:p-7 shadow-dashboard space-y-5 transition-all duration-200 hover:shadow-dashboard-hover">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252B32] pb-4">
          <div>
            <h3 className="text-[18px] font-bold text-[#111727] dark:text-slate-100 tracking-tight">
              Top Priority Narrative Signals
            </h3>
            <p className="text-[13px] text-[#8591A5] dark:text-slate-400 font-normal mt-0.5">
              Ranked by backend Priority Signal Score across monitored narrative candidates
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/narratives')}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#2F65F6] dark:text-[#93C5FD] hover:text-[#2152DE] transition-colors group"
          >
            <span>View all narratives</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-24 bg-slate-50 dark:bg-[#12161C] rounded-[18px] animate-pulse" />
            ))}
          </div>
        ) : topNarratives.length === 0 ? (
          <div className="py-12 px-6 rounded-[18px] bg-[#F8FAFD] dark:bg-[#12161C] text-center border border-slate-200/60 dark:border-[#252B32] space-y-2">
            <ShieldAlert className="w-7 h-7 text-slate-400 mx-auto" />
            <p className="text-[14px] font-semibold text-[#111727] dark:text-slate-200">
              No narrative candidates available
            </p>
            <p className="text-[13px] text-[#64748B] dark:text-slate-400 max-w-sm mx-auto">
              Run the 4G scoring pipeline or wait for record ingestion to populate priority candidates.
            </p>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-3"
          >
            {topNarratives.map((item) => {
              const tierBadge = formatPriorityTierBadge(item.priority_tier);
              const densityBadge = formatEvidenceDensityBadge(item.evidence_density);

              return (
                <motion.div
                  key={item.narrative_id}
                  variants={listItemEnter}
                  onClick={() => navigate(`/narratives/${item.narrative_id}`)}
                  className="p-4 sm:p-5 rounded-[18px] border border-slate-200/70 dark:border-[#252B32] bg-white dark:bg-[#171C22] hover:bg-[#F8FAFD] dark:hover:bg-[#1A2027] hover:border-[#2F65F6]/40 dark:hover:border-[#2F65F6]/40 shadow-xs hover:shadow-dashboard transition-all duration-200 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-mono text-[11px] font-bold text-[#64748B] dark:text-slate-400 bg-[#F1F4F9] dark:bg-[#12161C] px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-[#2B323A]">
                        {item.narrative_id}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${tierBadge.bg} ${tierBadge.text} ${tierBadge.border}`}>
                        {tierBadge.label} Priority
                      </span>
                      <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${densityBadge.bg} ${densityBadge.text}`}>
                        {densityBadge.label} Coverage
                      </span>
                      {item.has_coordination_signals && (
                        <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-2.5 py-0.5 rounded-full">
                          {COORDINATION_WORDING.primary}
                        </span>
                      )}
                    </div>
                    <h4 className="text-[15px] font-bold text-[#111727] dark:text-slate-100 group-hover:text-[#2F65F6] dark:group-hover:text-[#5878C7] transition-colors truncate">
                      {item.headline_claim}
                    </h4>
                    <p className="text-[12px] text-[#8591A5] dark:text-slate-400 mt-1 font-mono">
                      Topic: #{item.promoted_from_topic_id} • {item.message_count.toLocaleString()} messages observed
                      {item.first_observed_at && (
                        <> • First seen: {new Date(item.first_observed_at).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>

                  {/* Metrics Cluster */}
                  <div className="flex items-center gap-4 sm:gap-6 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-[#252B32]">
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">
                        Priority Score
                      </div>
                      <div className="font-mono text-[22px] font-extrabold text-[#111727] dark:text-slate-100 leading-tight">
                        <AnimatedNumber value={item.priority_signal_score} decimals={3} />
                      </div>
                    </div>

                    <div className="hidden sm:grid grid-cols-4 gap-2 text-center text-[10px] font-mono">
                      <div className="bg-[#F8FAFD] dark:bg-[#12161C] p-2 rounded-[10px] border border-slate-200/60 dark:border-[#252B32] min-w-[50px]">
                        <div className="text-[#8591A5] dark:text-slate-400 font-medium">SPREAD</div>
                        <div className="font-bold text-[#111727] dark:text-slate-200 mt-0.5">{formatDecimal(item.sub_scores.spread_score, 2)}</div>
                      </div>
                      <div className="bg-[#F8FAFD] dark:bg-[#12161C] p-2 rounded-[10px] border border-slate-200/60 dark:border-[#252B32] min-w-[50px]">
                        <div className="text-[#8591A5] dark:text-slate-400 font-medium">COORD</div>
                        <div className="font-bold text-[#111727] dark:text-slate-200 mt-0.5">{formatDecimal(item.sub_scores.coordination_score, 2)}</div>
                      </div>
                      <div className="bg-[#F8FAFD] dark:bg-[#12161C] p-2 rounded-[10px] border border-slate-200/60 dark:border-[#252B32] min-w-[50px]">
                        <div className="text-[#8591A5] dark:text-slate-400 font-medium">REACH</div>
                        <div className="font-bold text-[#111727] dark:text-slate-200 mt-0.5">{formatDecimal(item.sub_scores.reach_score, 2)}</div>
                      </div>
                      <div className="bg-[#F8FAFD] dark:bg-[#12161C] p-2 rounded-[10px] border border-slate-200/60 dark:border-[#252B32] min-w-[50px]">
                        <div className="text-[#8591A5] dark:text-slate-400 font-medium">FRICT</div>
                        <div className="font-bold text-[#111727] dark:text-slate-200 mt-0.5">{formatDecimal(item.sub_scores.friction_score, 2)}</div>
                      </div>
                    </div>

                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#1D232A] flex items-center justify-center text-[#8591A5] dark:text-slate-400 group-hover:bg-[#2F65F6] group-hover:text-white transition-all">
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </section>

      {/* Telemetry Modal */}
      <PipelineMetricsModal
        isOpen={isMetricsOpen}
        onClose={() => setIsMetricsOpen(false)}
      />
    </div>
  );
};
