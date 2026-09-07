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
} from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { telemetryApi } from '../../services/telemetryApi';
import { AnalyticsOverviewResponse, NarrativeSummaryResponse, PipelineStatusResponse } from '../../types/api';
import {
  formatPriorityTierBadge,
  formatEvidenceDensityBadge,
  formatPercent,
  formatDecimal,
  COORDINATION_WORDING,
  REACH_WORDING,
} from '../../utils/telemetryFormatters';
import { PipelineMetricsModal } from '../../components/pipeline/PipelineMetricsModal';
import { PriorityTierChart, SentimentDonutChart } from '../../components/ui/charts';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState<AnalyticsOverviewResponse | null>(null);
  const [topNarratives, setTopNarratives] = useState<NarrativeSummaryResponse[]>([]);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage('');
    try {
      const [analyticsData, narrativesData, statusData] = await Promise.all([
        telemetryApi.getAnalyticsOverview(),
        telemetryApi.getNarratives({
          page: 1,
          page_size: 5,
          sort_by: 'priority_signal_score',
          order: 'desc',
        }),
        telemetryApi.getPipelineStatus().catch(() => null),
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

  useEffect(() => {
    loadData();
  }, []);

  const overviewData = analytics?.data;
  const priorityDist = overviewData?.priority_distribution;
  const summary = overviewData?.summary_counts;
  const sentiment = overviewData?.sentiment_overview;
  const execution = overviewData?.pipeline_execution;

  return (
    <div className="space-y-8 font-sans">
      {/* 1. Page Header */}
      <PageHeader
        title="Intelligence Overview"
        description="Authoritative real-time aggregation across monitored narrative candidates, topics, and canonical messages."
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
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={loadData}
              disabled={isLoading}
            >
              Sync Analytics
            </Button>
          </div>
        }
      />

      {/* Error Banner */}
      {isError && (
        <div className="p-4 rounded-[16px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[14px] font-bold">Failed to load analytics telemetry</h4>
              <p className="text-[13px] text-rose-700 dark:text-rose-300 mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* 2. Pipeline Execution Banner (Live Backend Metadata) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 rounded-[20px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] shadow-xs text-[13px] text-[#64748B] dark:text-slate-400">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-[#111727] dark:text-slate-200 font-semibold">
            <Clock className="w-4 h-4 text-[#2F65F6] dark:text-[#5878C7]" />
            <span>
              Ingestion Timestamp:{' '}
              <span className="font-mono text-[12px] text-[#475569] dark:text-slate-300">
                {execution?.created_at_utc ? new Date(execution.created_at_utc).toLocaleString() : 'Awaiting sync'}
              </span>
            </span>
          </span>
          {overviewData?.dataset_source && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>
                Dataset:{' '}
                <span className="font-mono font-medium text-[#111727] dark:text-slate-200">
                  {overviewData.dataset_source}
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
                  {pipelineStatus.cumulative_record_count.toLocaleString()} msgs
                </span>
              </span>
            </>
          )}
          {pipelineStatus?.last_collection_run && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>
                Last Sync:{' '}
                <span className="font-mono text-[12px] text-[#475569] dark:text-slate-300">
                  {new Date(pipelineStatus.last_collection_run).toLocaleTimeString()}
                </span>
                {pipelineStatus.last_new_record_count !== null && pipelineStatus.last_new_record_count !== undefined && (
                  <span className="ml-1 text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/50">
                    +{pipelineStatus.last_new_record_count} new
                  </span>
                )}
              </span>
            </>
          )}
          {execution && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>
                Runtime:{' '}
                <span className="font-mono text-[12px] bg-slate-100 dark:bg-[#1D232A] text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full">
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
                  {pipelineStatus.active_lineages_count} active
                </span>
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 font-semibold">
          {pipelineStatus?.analytics_current === false ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <span
                className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-2 py-0.5 rounded-full font-mono text-[11px] uppercase tracking-wider"
                title={pipelineStatus.stale_analytics_reason || 'Analytics artifact does not reflect recent ingested records'}
              >
                Analytics Stale (Pending Run)
              </span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-700 dark:text-emerald-400 font-mono text-[12px] uppercase tracking-wider">
                {pipelineStatus?.corpus_snapshot_id ? 'Snapshot Sync' : 'Pipeline Ready'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 3. Top-Level Summary KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Ingested Messages */}
        <div className="rounded-[20px] p-6 shadow-dashboard bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] flex flex-col justify-between transition-all duration-200 hover:shadow-dashboard-hover">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">
                Total Ingested
              </span>
              <p className="text-[12px] text-[#475569] dark:text-slate-300 font-medium mt-0.5">Canonical corpus</p>
            </div>
            <div className="w-10 h-10 rounded-[14px] bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-[#2F65F6] dark:text-[#93C5FD]">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5">
            <div className="text-[34px] font-bold text-[#111727] dark:text-slate-100 font-mono tracking-tight leading-none">
              {isLoading ? '...' : (summary?.total_messages ?? 0).toLocaleString()}
            </div>
            <div className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-2">
              Noise filtered: {(summary?.noise_messages ?? 0).toLocaleString()} items
            </div>
          </div>
        </div>

        {/* KPI 2: Topic Clusters */}
        <div className="rounded-[20px] p-6 shadow-dashboard bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] flex flex-col justify-between transition-all duration-200 hover:shadow-dashboard-hover">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">
                Discovered Topics
              </span>
              <p className="text-[12px] text-[#475569] dark:text-slate-300 font-medium mt-0.5">c-TF-IDF semantic clusters</p>
            </div>
            <div className="w-10 h-10 rounded-[14px] bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Radio className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5">
            <div className="text-[34px] font-bold text-[#111727] dark:text-slate-100 font-mono tracking-tight leading-none">
              {isLoading ? '...' : summary?.total_topics ?? 0}
            </div>
            <button
              type="button"
              onClick={() => navigate('/topics')}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2F65F6] dark:text-[#93C5FD] hover:underline mt-2"
            >
              <span>Explore topics</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* KPI 3: Priority Narratives */}
        <div className="rounded-[20px] p-6 shadow-dashboard bg-gradient-to-br from-[#FFA690] via-[#FF856D] to-[#FFEBE5] dark:from-[#3D221D] dark:via-[#2F1C18] dark:to-[#1E1716] dark:border dark:border-[#522921] flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:shadow-dashboard-hover">
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-white/20 dark:bg-white/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[12px] font-bold text-[#111727] dark:text-[#FFA194] uppercase tracking-wider">
                Active Narratives
              </span>
              <p className="text-[12px] text-[#475569] dark:text-slate-300 font-medium mt-0.5">4G scored candidates</p>
            </div>
            <div className="w-10 h-10 rounded-[14px] bg-white/40 dark:bg-white/10 backdrop-blur-sm border border-white/50 dark:border-white/15 flex items-center justify-center text-[#111727] dark:text-[#FFA194]">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5 relative z-10">
            <div className="text-[34px] font-bold text-[#111727] dark:text-white font-mono tracking-tight leading-none">
              {isLoading ? '...' : summary?.total_narratives ?? 0}
            </div>
            <div className="text-[12px] text-[#111727] dark:text-slate-300 font-medium mt-2">
              Critical / High:{' '}
              <span className="font-bold text-[#111727] dark:text-white">
                {(priorityDist?.critical ?? 0) + (priorityDist?.high ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Critical Tier Attention */}
        <div className="rounded-[20px] p-6 shadow-dashboard bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] flex flex-col justify-between transition-all duration-200 hover:shadow-dashboard-hover">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">
                Critical Priority
              </span>
              <p className="text-[12px] text-[#475569] dark:text-slate-300 font-medium mt-0.5">Immediate triage</p>
            </div>
            <div className="w-10 h-10 rounded-[14px] bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5">
            <div className="text-[34px] font-bold text-rose-600 dark:text-rose-400 font-mono tracking-tight leading-none">
              {isLoading ? '...' : priorityDist?.critical ?? 0}
            </div>
            <button
              type="button"
              onClick={() => navigate('/narratives?priority_tier=critical')}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-rose-700 dark:text-rose-400 hover:underline mt-2"
            >
              <span>Filter critical candidates</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </section>

      {/* 4. Priority Tier Distribution & Sentiment Profiling */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Tier Distribution */}
        <div className="rounded-[20px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] p-6 shadow-dashboard space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2B323A] pb-3">
            <div>
              <h3 className="text-[16px] font-bold text-[#111727] dark:text-slate-100">Priority Signal Tier Breakdown</h3>
              <p className="text-[12px] text-[#8591A5] dark:text-slate-400">Backend 4G composite scoring distribution</p>
            </div>
            <span className="text-[11px] font-mono text-[#64748B] dark:text-slate-400 bg-slate-100 dark:bg-[#1D232A] px-2.5 py-1 rounded-full">
              Frozen Formula
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-4 rounded-[14px] bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40">
              <div className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase">Critical</div>
              <div className="text-[26px] font-bold text-rose-800 dark:text-rose-200 font-mono mt-1">
                {priorityDist?.critical ?? 0}
              </div>
              <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-medium">Score ≥ 0.75</div>
            </div>

            <div className="p-4 rounded-[14px] bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
              <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase">High</div>
              <div className="text-[26px] font-bold text-amber-800 dark:text-amber-200 font-mono mt-1">
                {priorityDist?.high ?? 0}
              </div>
              <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">0.55 – 0.74</div>
            </div>

            <div className="p-4 rounded-[14px] bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40">
              <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase">Elevated</div>
              <div className="text-[26px] font-bold text-blue-800 dark:text-blue-200 font-mono mt-1">
                {priorityDist?.elevated ?? 0}
              </div>
              <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-medium">0.35 – 0.54</div>
            </div>

            <div className="p-4 rounded-[14px] bg-slate-50 dark:bg-[#1D232A] border border-slate-200/70 dark:border-[#2B323A]">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Routine</div>
              <div className="text-[26px] font-bold text-slate-800 dark:text-slate-200 font-mono mt-1">
                {priorityDist?.routine ?? 0}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">&lt; 0.35</div>
            </div>
          </div>

          {/* Analytical Distribution Chart */}
          <div className="pt-2">
            <PriorityTierChart data={priorityDist} isLoading={isLoading} />
          </div>

          <div className="p-3.5 rounded-[14px] bg-[#F8FAFD] dark:bg-[#12161C] border border-slate-200/60 dark:border-[#2B323A] text-[12px] text-[#64748B] dark:text-slate-400 flex items-center gap-2">
            <Info className="w-4 h-4 text-[#2F65F6] dark:text-[#5878C7] shrink-0" />
            <span>
              Priority Signal Score = 0.30 · Spread + 0.30 · Coordination + 0.20 · {REACH_WORDING.primary} + 0.20 · Friction.
            </span>
          </div>
        </div>

        {/* Sentiment Overview & Availability */}
        <div className="rounded-[20px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] p-6 shadow-dashboard space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2B323A] pb-3">
            <div>
              <h3 className="text-[16px] font-bold text-[#111727] dark:text-slate-100">Corpus Sentiment Overview</h3>
              <p className="text-[12px] text-[#8591A5] dark:text-slate-400">Evaluated message distribution</p>
            </div>
            {sentiment && sentiment.evaluated_messages_count > 0 ? (
              <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 px-2.5 py-0.5 rounded-full font-semibold">
                Evaluated ({sentiment.evaluated_messages_count} msgs)
              </span>
            ) : (
              <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#1D232A] px-2.5 py-0.5 rounded-full font-semibold">
                Coverage Limited
              </span>
            )}
          </div>

          {sentiment && sentiment.evaluated_messages_count > 0 ? (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-[14px] bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                  <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase">Positive</div>
                  <div className="text-[20px] font-bold text-emerald-900 dark:text-emerald-200 font-mono mt-0.5">
                    {formatPercent(sentiment.distribution.positive_ratio)}
                  </div>
                </div>
                <div className="p-3.5 rounded-[14px] bg-slate-50 dark:bg-[#1D232A] border border-slate-200 dark:border-[#2B323A]">
                  <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase">Neutral</div>
                  <div className="text-[20px] font-bold text-slate-800 dark:text-slate-200 font-mono mt-0.5">
                    {formatPercent(sentiment.distribution.neutral_ratio)}
                  </div>
                </div>
                <div className="p-3.5 rounded-[14px] bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
                  <div className="text-[11px] font-semibold text-rose-800 dark:text-rose-300 uppercase">Negative</div>
                  <div className="text-[20px] font-bold text-rose-900 dark:text-rose-200 font-mono mt-0.5">
                    {formatPercent(sentiment.distribution.negative_ratio)}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <SentimentDonutChart
                  positiveRatio={sentiment.distribution.positive_ratio}
                  neutralRatio={sentiment.distribution.neutral_ratio}
                  negativeRatio={sentiment.distribution.negative_ratio}
                  evaluatedCount={sentiment.evaluated_messages_count}
                  modelId={sentiment.sentiment_model_id}
                  isLoading={isLoading}
                />
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-[16px] bg-slate-50 dark:bg-[#12161C] border border-slate-200 dark:border-[#2B323A] text-center space-y-2">
              <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
              <h4 className="text-[14px] font-bold text-[#111727] dark:text-slate-200">
                Sentiment Inference Unavailable
              </h4>
              <p className="text-[12px] text-[#64748B] dark:text-slate-400 max-w-md mx-auto">
                Corpus sentiment classification has not been evaluated or has insufficient data coverage. Values are preserved as unavailable rather than fabricated neutral.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 5. Top Emerging Narrative Candidates */}
      <section className="rounded-[20px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] p-6 md:p-8 shadow-dashboard space-y-5">
        <div className="flex items-center justify-between border-b border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] pb-4">
          <div>
            <h3 className="text-[18px] font-bold text-[#111727] dark:text-slate-100 tracking-tight">
              Top Priority Narrative Signals
            </h3>
            <p className="text-[13px] text-[#8591A5] dark:text-slate-400 font-medium mt-0.5">
              Ranked by backend Priority Signal Score across monitored narrative candidates
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/narratives')}
            className="inline-flex items-center gap-1 text-[13px] font-bold text-[#2F65F6] dark:text-[#93C5FD] hover:text-[#2152DE] transition-colors group"
          >
            <span>View all narratives</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 bg-slate-50 dark:bg-[#12161C] rounded-[16px] animate-pulse" />
            ))}
          </div>
        ) : topNarratives.length === 0 ? (
          <div className="p-8 text-center text-[14px] text-[#64748B] dark:text-slate-400">
            No narrative candidates available. Run the 4G scoring pipeline to populate candidates.
          </div>
        ) : (
          <div className="space-y-3">
            {topNarratives.map((item) => {
              const tierBadge = formatPriorityTierBadge(item.priority_tier);
              const densityBadge = formatEvidenceDensityBadge(item.evidence_density);

              return (
                <div
                  key={item.narrative_id}
                  onClick={() => navigate(`/narratives/${item.narrative_id}`)}
                  className="p-4 sm:p-5 rounded-[16px] border border-slate-200/80 dark:border-[#2B323A] bg-white dark:bg-[#171C22] hover:bg-slate-50/80 dark:hover:bg-[#1D232A] hover:border-slate-300 dark:hover:border-slate-600 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="font-mono text-[11px] font-bold text-[#8591A5] dark:text-slate-400 bg-[#F1F4F9] dark:bg-[#12161C] px-2 py-0.5 rounded-full">
                        {item.narrative_id}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${tierBadge.bg} ${tierBadge.text} ${tierBadge.border}`}>
                        {tierBadge.label} Priority
                      </span>
                      <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${densityBadge.bg} ${densityBadge.text}`}>
                        {densityBadge.label} Coverage
                      </span>
                      {item.has_coordination_signals && (
                        <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-2 py-0.5 rounded-full">
                          {COORDINATION_WORDING.primary}
                        </span>
                      )}
                    </div>
                    <h4 className="text-[15px] font-bold text-[#111727] dark:text-slate-100 truncate">
                      {item.headline_claim}
                    </h4>
                    <p className="text-[12px] text-[#8591A5] dark:text-slate-400 mt-1 font-mono">
                      Topic: #{item.promoted_from_topic_id} • {item.message_count} messages observed
                    </p>
                  </div>

                  {/* Metrics Cluster */}
                  <div className="flex items-center gap-4 sm:gap-6 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-[#2B323A]">
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-[#8591A5] dark:text-slate-400 uppercase">
                        Priority Score
                      </div>
                      <div className="font-mono text-[20px] font-extrabold text-[#111727] dark:text-slate-100">
                        {formatDecimal(item.priority_signal_score, 3)}
                      </div>
                    </div>

                    <div className="hidden sm:grid grid-cols-4 gap-2 text-center text-[10px] font-mono">
                      <div className="bg-slate-50 dark:bg-[#12161C] p-1.5 rounded-[8px] border border-slate-100 dark:border-[#2B323A]">
                        <div className="text-[#8591A5] dark:text-slate-400">SPREAD</div>
                        <div className="font-bold text-[#111727] dark:text-slate-200">{formatDecimal(item.sub_scores.spread_score, 2)}</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#12161C] p-1.5 rounded-[8px] border border-slate-100 dark:border-[#2B323A]">
                        <div className="text-[#8591A5] dark:text-slate-400">COORD</div>
                        <div className="font-bold text-[#111727] dark:text-slate-200">{formatDecimal(item.sub_scores.coordination_score, 2)}</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#12161C] p-1.5 rounded-[8px] border border-slate-100 dark:border-[#2B323A]">
                        <div className="text-[#8591A5] dark:text-slate-400">REACH</div>
                        <div className="font-bold text-[#111727] dark:text-slate-200">{formatDecimal(item.sub_scores.reach_score, 2)}</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#12161C] p-1.5 rounded-[8px] border border-slate-100 dark:border-[#2B323A]">
                        <div className="text-[#8591A5] dark:text-slate-400">FRICT</div>
                        <div className="font-bold text-[#111727] dark:text-slate-200">{formatDecimal(item.sub_scores.friction_score, 2)}</div>
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-[#1D232A] flex items-center justify-center text-[#8591A5] dark:text-slate-400 hover:bg-[#2F65F6] hover:text-white transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
