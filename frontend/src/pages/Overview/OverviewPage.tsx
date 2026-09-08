import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  ArrowRight,
  ArrowUpRight,
  Radio,
  Layers,
  AlertTriangle,
  Server,
  Zap,
  ShieldAlert,
  Sparkles,
  Terminal,
  BarChart3,
  Flame,
  GitFork,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { telemetryApi } from '../../services/telemetryApi';
import {
  AnalyticsOverviewResponse,
  MessageSummaryResponse,
  NarrativeSummaryResponse,
  PipelineStatusResponse,
  TrendSummaryResponse,
} from '../../types/api';
import {
  formatPriorityTierBadge,
  formatEvidenceDensityBadge,
  formatPercent,
} from '../../utils/telemetryFormatters';
import { PipelineMetricsModal } from '../../components/pipeline/PipelineMetricsModal';
import { PriorityTierChart, SentimentDonutChart } from '../../components/ui/charts';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { useLiveStream } from '../../contexts/LiveStreamContext';
import { getNarrativeDisplayName } from '../../utils/narrativeIdentity';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState<AnalyticsOverviewResponse | null>(null);
  const [topNarratives, setTopNarratives] = useState<NarrativeSummaryResponse[]>([]);
  const [spotlightTrend, setSpotlightTrend] = useState<TrendSummaryResponse | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatusResponse | null>(null);
  const [recentMessages, setRecentMessages] = useState<MessageSummaryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);

  // Collapsible cards state
  const [selectedTier, setSelectedTier] = useState<'critical' | 'high' | 'elevated' | 'routine' | null>(null);
  const [telemetryArenaTab, setTelemetryArenaTab] = useState<'trend' | 'stream'>('trend');
  const [hoveredNarrativeId, setHoveredNarrativeId] = useState<string | null>(null);

  const { totalCorpusCount, liveMessages } = useLiveStream();

  const loadData = async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    setIsError(false);
    setErrorMessage('');
    try {
      const [analyticsData, narrativesData, statusData, trendsData, messagesData] = await Promise.all([
        telemetryApi.getAnalyticsOverview({ skipCache: !isInitial }),
        telemetryApi.getNarratives(
          {
            page: 1,
            page_size: 6,
            sort_by: 'priority_signal_score',
            order: 'desc',
          },
          { skipCache: !isInitial }
        ),
        telemetryApi.getPipelineStatus({ skipCache: !isInitial }).catch(() => null),
        telemetryApi.getTrends(
          {
            page: 1,
            page_size: 5,
            sort_by: 'message_count',
            order: 'desc',
          },
          { skipCache: !isInitial }
        ).catch(() => null),
        telemetryApi.getMessages(
          {
            page: 1,
            page_size: 6,
            sort_by: 'published_at',
            order: 'desc',
          },
          { skipCache: !isInitial }
        ).catch(() => null),
      ]);
      setAnalytics(analyticsData);
      setTopNarratives(narrativesData.data);
      if (statusData) setPipelineStatus(statusData);
      if (trendsData?.data && trendsData.data.length > 0) {
        setSpotlightTrend(trendsData.data[0]);
      }
      if (messagesData?.data) {
        setRecentMessages(messagesData.data);
      }
    } catch (e: any) {
      console.error('Failed to load overview analytics:', e);
      setIsError(true);
      setErrorMessage(e.message || 'Failed to communicate with Traject Analytics API.');
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

    // Automatic silent background refresh every 30s to pick up pipeline updates
    const pollInterval = setInterval(() => {
      loadData(false);
    }, 30000);

    // Re-validate when tab regains focus
    const handleFocus = () => {
      loadData(false);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const overviewData = analytics?.data;
  const priorityDist = overviewData?.priority_distribution;
  const summary = overviewData?.summary_counts;
  const sentiment = overviewData?.sentiment_overview;

  // Real-time dynamic counts
  const rawCorpusCount = summary?.total_messages ?? pipelineStatus?.cumulative_record_count ?? 0;
  const displayTotalMessages = totalCorpusCount !== null && totalCorpusCount > 0
    ? Math.max(totalCorpusCount, rawCorpusCount)
    : rawCorpusCount;
  const liveDelta = rawCorpusCount > 0 && displayTotalMessages > rawCorpusCount
    ? displayTotalMessages - rawCorpusCount
    : liveMessages.length;

  const cleanTrendId = spotlightTrend
    ? (spotlightTrend.trend_id || spotlightTrend.topic_id || '').replace(/^topic_|^trend_/, '')
    : '';

  return (
    <div className="space-y-7 font-sans pb-16 relative">
      {/* =========================================================================
          ZONE 1: EDITORIAL MASTHEAD & PIPELINE STATUS RIBBON
          Disciplined 2-row layout: Title + Action Dock (Row 1), Pipeline Ribbon + KPIs (Row 2)
          ========================================================================= */}
      <section className="space-y-5 pt-1 pb-1">
        {/* Row 1: Executive Title & Action Dock */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-normal tracking-tight text-slate-900 dark:text-slate-100 font-sans leading-tight">
              Intelligence Command Center
            </h1>
            <p className="text-[13.5px] text-slate-500 dark:text-slate-400 font-normal">
              Authoritative multi-stage OSINT pipeline aggregation and narrative prioritization.
            </p>
          </div>

          {/* Clean Action Dock (Telemetry & Sync) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsMetricsOpen(true)}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-slate-300/80 dark:border-[#333C48] bg-white/90 dark:bg-[#181C22]/90 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#20262E] transition-all shadow-xs cursor-pointer"
            >
              <Server className="w-3.5 h-3.5 text-[#2F65F6] dark:text-[#5878C7]" />
              <span>Pipeline Telemetry</span>
            </button>

            <button
              type="button"
              onClick={handleSyncAnalytics}
              disabled={isRefreshing || isLoading}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-slate-300/80 dark:border-[#333C48] bg-white/90 dark:bg-[#181C22]/90 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#20262E] transition-all shadow-xs disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Sync Analytics</span>
            </button>
          </div>
        </div>

        {/* Row 2: Continuous Segmented Pipeline Ribbon (Left) + 3 Executive KPIs (Right) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-1">
          {/* Left: Continuous Unbroken Pipeline Mix Ribbon */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
              Pipeline Mix:
            </span>

            {/* Critical Pill */}
            <button
              type="button"
              onClick={() => navigate('/narratives?priority_tier=critical')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer ${(priorityDist?.critical ?? 0) > 0
                  ? 'bg-rose-500 text-white font-bold shadow-xs'
                  : 'bg-[#181D24] text-white dark:bg-[#222832]'
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              <span>Critical</span>
              <span className="font-mono text-[11px] opacity-85">{priorityDist?.critical ?? 0}</span>
            </button>

            {/* Elevated / High Pill (The signature warm yellow pill from reference) */}
            <button
              type="button"
              onClick={() => navigate('/narratives')}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-400 dark:bg-amber-400 text-slate-950 font-bold text-[12px] shadow-xs hover:bg-amber-300 transition-colors cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-950" />
              <span>Elevated / High</span>
              <span className="font-mono text-[11px]">
                {(priorityDist?.high ?? 0) + (priorityDist?.elevated ?? 0)}
              </span>
            </button>

            {/* Routine Pill (Clean capsule) */}
            <button
              type="button"
              onClick={() => navigate('/narratives?priority_tier=routine')}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-slate-300/80 dark:border-[#333C48] bg-white/80 dark:bg-[#181C22]/80 text-slate-700 dark:text-slate-300 text-[12px] font-medium hover:border-slate-400 transition-colors cursor-pointer"
            >
              <span>Routine</span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                {priorityDist?.routine ?? 0}
              </span>
            </button>

            {/* MTProto Push Active Indicator */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[12px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>MTProto Push Active</span>
              {liveDelta > 0 && <span className="font-mono text-[11px] font-bold">+{liveDelta}</span>}
            </div>
          </div>

          {/* Right: The 3 Executive KPIs, perfectly aligned on the same horizontal axis */}
          <div className="flex items-center gap-7 sm:gap-9 shrink-0">
            {/* KPI 1: Corpus */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/90 dark:bg-[#181C22]/90 border border-slate-200/80 dark:border-[#333C48] flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-2xs">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="text-3xl sm:text-[34px] font-light font-sans text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                  <AnimatedNumber value={displayTotalMessages > 0 ? displayTotalMessages : (summary?.total_messages ?? 0)} />
                </div>
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">
                  Corpus
                </div>
              </div>
            </div>

            {/* KPI 2: Trends */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/90 dark:bg-[#181C22]/90 border border-slate-200/80 dark:border-[#333C48] flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <div className="text-3xl sm:text-[34px] font-light font-sans text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                  <AnimatedNumber value={summary?.total_topics ?? 0} />
                </div>
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">
                  Trends
                </div>
              </div>
            </div>

            {/* KPI 3: Narratives */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100/80 dark:bg-amber-950/50 border border-amber-300/60 dark:border-amber-900/50 flex items-center justify-center text-amber-700 dark:text-amber-300 shadow-2xs">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-3xl sm:text-[34px] font-light font-sans text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                  <AnimatedNumber value={summary?.total_narratives ?? 0} />
                </div>
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">
                  Narratives
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Error State Banner */}
      {isError && (
        <div className="p-4 sm:p-5 rounded-[22px] bg-rose-50/90 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/40 text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
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

      {/* =========================================================================
          ZONE 2: PRIMARY ANALYTICAL VISUALIZATION ARENA
          Uncramped, generous breathing room for the two main charts:
          Priority Tier Distribution (ECharts) & Corpus Sentiment Multi-Track Donut (ECharts)
          ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Chart 1: Priority Signal Tier Breakdown (50% Width) */}
        <div className="rounded-[26px] bg-white/95 dark:bg-[#181C22]/95 border border-slate-200/80 dark:border-[#2B323D] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2B323D] pb-3 mb-3">
              <div>
                <h3 className="text-[17px] font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Priority Signal Tier Breakdown
                </h3>
                <p className="text-[12.5px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Backend 4G composite scoring distribution across narrative candidates
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/narratives')}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#2F65F6] dark:text-[#5878C7] hover:underline transition-colors"
              >
                <span>View all</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 4 Responsive Tier Indicator Cards - Apple-style Clean White Compact Containers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 mb-3">
              {/* Critical */}
              <button
                type="button"
                onClick={() => setSelectedTier(selectedTier === 'critical' ? null : 'critical')}
                className={`p-3 sm:p-3.5 text-left rounded-[18px] bg-white dark:bg-[#181C22] border transition-all cursor-pointer relative shadow-xs hover:shadow-md flex flex-col justify-between min-h-[102px] group ${selectedTier === 'critical'
                    ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-sm'
                    : 'border-slate-200/90 dark:border-[#2C333E] hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
              >
                <div>
                  <ShieldAlert className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400" strokeWidth={1.8} />
                </div>
                <div className="mt-1.5">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">Critical</div>
                  <div className="text-[22px] sm:text-[24px] font-black text-slate-900 dark:text-white leading-none my-0.5 tracking-tight font-sans">
                    {priorityDist?.critical ?? 0}
                  </div>
                  <div className="text-[10.5px] font-semibold text-rose-600 dark:text-rose-400 font-sans">Score ≥ 0.75</div>
                </div>
              </button>

              {/* High */}
              <button
                type="button"
                onClick={() => setSelectedTier(selectedTier === 'high' ? null : 'high')}
                className={`p-3 sm:p-3.5 text-left rounded-[18px] bg-white dark:bg-[#181C22] border transition-all cursor-pointer relative shadow-xs hover:shadow-md flex flex-col justify-between min-h-[102px] group ${selectedTier === 'high'
                    ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
                    : 'border-slate-200/90 dark:border-[#2C333E] hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
              >
                <div>
                  <Zap className="w-4.5 h-4.5 text-amber-500 dark:text-amber-400" strokeWidth={1.8} />
                </div>
                <div className="mt-1.5">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">High</div>
                  <div className="text-[22px] sm:text-[24px] font-black text-slate-900 dark:text-white leading-none my-0.5 tracking-tight font-sans">
                    {priorityDist?.high ?? 0}
                  </div>
                  <div className="text-[10.5px] font-semibold text-amber-600 dark:text-amber-400 font-sans">0.55 – 0.74</div>
                </div>
              </button>

              {/* Elevated */}
              <button
                type="button"
                onClick={() => setSelectedTier(selectedTier === 'elevated' ? null : 'elevated')}
                className={`p-3 sm:p-3.5 text-left rounded-[18px] bg-white dark:bg-[#181C22] border transition-all cursor-pointer relative shadow-xs hover:shadow-md flex flex-col justify-between min-h-[102px] group ${selectedTier === 'elevated'
                    ? 'border-[#2F65F6] ring-2 ring-[#2F65F6]/20 shadow-sm'
                    : 'border-slate-200/90 dark:border-[#2C333E] hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
              >
                <div>
                  <Radio className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" strokeWidth={1.8} />
                </div>
                <div className="mt-1.5">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">Elevated</div>
                  <div className="text-[22px] sm:text-[24px] font-black text-slate-900 dark:text-white leading-none my-0.5 tracking-tight font-sans">
                    {priorityDist?.elevated ?? 0}
                  </div>
                  <div className="text-[10.5px] font-semibold text-blue-600 dark:text-blue-400 font-sans">0.35 – 0.54</div>
                </div>
              </button>

              {/* Routine */}
              <button
                type="button"
                onClick={() => setSelectedTier(selectedTier === 'routine' ? null : 'routine')}
                className={`p-3 sm:p-3.5 text-left rounded-[18px] bg-white dark:bg-[#181C22] border transition-all cursor-pointer relative shadow-xs hover:shadow-md flex flex-col justify-between min-h-[102px] group ${selectedTier === 'routine'
                    ? 'border-slate-500 ring-2 ring-slate-500/20 shadow-sm'
                    : 'border-slate-200/90 dark:border-[#2C333E] hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
              >
                <div>
                  <Layers className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" strokeWidth={1.8} />
                </div>
                <div className="mt-1.5">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">Routine</div>
                  <div className="text-[22px] sm:text-[24px] font-black text-slate-900 dark:text-white leading-none my-0.5 tracking-tight font-sans">
                    {priorityDist?.routine ?? 0}
                  </div>
                  <div className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 font-sans">&lt; 0.35</div>
                </div>
              </button>
            </div>

            {/* Modern Priority Signal Tier Visualizer */}
            <div className="w-full">
              <PriorityTierChart
                data={priorityDist}
                isLoading={isLoading}
                selectedTier={selectedTier}
                onSelectTier={setSelectedTier}
              />
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-[#2B323D] flex items-center justify-between text-[11.5px] text-slate-500 dark:text-slate-400">
            <span>Score formula: 0.30·Spread + 0.30·Coord + 0.20·Reach + 0.20·Friction</span>
            <span className="font-sans text-[10.5px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">4G Deterministic</span>
          </div>
        </div>

        {/* Chart 2: Corpus Sentiment Overview & Multi-Track Donut (50% Width) */}
        <div className="rounded-[26px] bg-white/95 dark:bg-[#181C22]/95 border border-slate-200/80 dark:border-[#2B323D] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2B323D] pb-3 mb-2">
              <div>
                <h3 className="text-[17px] font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Corpus Sentiment Overview
                </h3>
                <p className="text-[12.5px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Multi-track RoBERTa classification
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-[11.5px] font-sans font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200/60 dark:border-slate-700">
                  {(sentiment?.evaluated_messages_count ?? 0).toLocaleString()} msgs evaluated
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/explorer')}
                  className="inline-flex items-center gap-1 text-[12px] font-bold text-[#2F65F6] dark:text-[#5878C7] hover:underline transition-colors"
                >
                  <span>Explorer</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Authentic Concentric Multi-Track Sentiment Graph */}
            <div className="w-full flex-1 flex items-center justify-center my-auto py-1">
              <SentimentDonutChart
                positiveRatio={sentiment?.distribution?.positive_ratio ?? 0}
                neutralRatio={sentiment?.distribution?.neutral_ratio ?? 0}
                negativeRatio={sentiment?.distribution?.negative_ratio ?? 0}
                evaluatedCount={sentiment?.evaluated_messages_count ?? 0}
                modelId={sentiment?.sentiment_model_id ?? ''}
                isLoading={isLoading}
                className="w-full"
              />
            </div>
          </div>

          <div className="pt-4 mt-6 border-t border-slate-100 dark:border-[#2B323D] flex items-center justify-between text-[12px] text-slate-500 dark:text-slate-400">
            <span className="truncate max-w-[220px]" title={sentiment?.sentiment_model_id || 'RoBERTa'}>
              Model: {sentiment?.sentiment_model_id || 'RoBERTa'}
            </span>
            <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          ZONE 3: REFINED TELEMETRY & INTELLIGENCE ARENA (Crextio Styled)
          Aligned with the warm cream, deep charcoal & golden amber design system.
          Single-container presentation with clean pill switching.
          ========================================================================= */}
      <section className="space-y-4">
        {/* Arena Mode Switcher Header (Crextio Styled) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <h2 className="text-[17px] sm:text-[18px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight font-sans">
                Operational Telemetry
              </h2>
            </div>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">
              {telemetryArenaTab === 'trend'
                ? 'Semantic Trend Orbit & Topic Cluster Dossier'
                : 'Real-time MTProto Packet Pipeline & Ingestion Conduit'}
            </p>
          </div>

          {/* Capsule Switcher Dock (Crextio Rounded-Full Pill) */}
          <div className="flex items-center gap-1 p-1 bg-[#F5F1E5] dark:bg-[#1E2229] rounded-full border border-[#E5DFD3] dark:border-[#2D333F] shadow-2xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTelemetryArenaTab('trend')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-[12.5px] font-medium transition-all cursor-pointer ${
                telemetryArenaTab === 'trend'
                  ? 'bg-[#181D24] text-white dark:bg-white dark:text-[#181D24] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 dark:text-amber-500" />
              <span>Trend Orbit</span>
            </button>

            <button
              type="button"
              onClick={() => setTelemetryArenaTab('stream')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-[12.5px] font-medium transition-all cursor-pointer ${
                telemetryArenaTab === 'stream'
                  ? 'bg-[#181D24] text-white dark:bg-white dark:text-[#181D24] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-amber-400 dark:text-amber-500" />
              <span>Live Wire</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                telemetryArenaTab === 'stream'
                  ? 'bg-white/20 text-white dark:bg-[#181D24]/10 dark:text-[#181D24]'
                  : 'bg-[#EAE5D9] dark:bg-[#2A313E] text-slate-700 dark:text-slate-300'
              }`}>
                {liveMessages.length > 0 ? liveMessages.length : recentMessages.length}
              </span>
            </button>
          </div>
        </div>

        {/* CONTAINER VIEWPORT: SINGLE-CONTAINER PRESENTATION */}
        {telemetryArenaTab === 'trend' ? (
          /* =========================================================================
              CONTAINER 1: EDITORIAL TREND ORBIT DOSSIER (Crextio Clean Card)
              Horizontal Split: Topics & Metrics on Left, Orbit Radar on Right
              ========================================================================= */
          <div className="rounded-[30px] bg-gradient-to-br from-[#FFFDF9] via-white to-[#F8F5ED]/90 dark:from-[#1E2229] dark:to-[#171A21] border border-[#E6DFC9] dark:border-[#2D333F] p-7 sm:p-8 shadow-[0_6px_28px_rgba(245,158,11,0.03)] relative overflow-hidden w-full font-sans">
            {/* Ambient warm golden glow auras */}
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-amber-400/10 dark:bg-amber-400/5 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-amber-500/8 dark:bg-amber-500/5 blur-3xl pointer-events-none" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-8 items-center">
              {/* LEFT SIDE: Header, Headline, Summary, 4 Metrics Pods & Action Button */}
              <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
                {/* Header: Trend Tag, Cluster Pill & Dominance Pill */}
                <div className="flex items-center justify-between border-b border-[#EFECE4] dark:border-[#2A303C] pb-3.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Trend Orbit Badge - Solid Amber with Sparkle */}
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-slate-950 dark:text-white bg-amber-400/25 dark:bg-amber-400/20 border border-amber-400/50 px-3.5 py-1 rounded-full shadow-2xs">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Trend Orbit</span>
                    </span>

                    {/* Cluster Tag - Vibrant Indigo */}
                    <span className="text-[12px] font-mono font-bold text-slate-950 dark:text-white bg-indigo-50/90 dark:bg-indigo-950/50 px-3.5 py-1 rounded-full border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs">
                      {cleanTrendId ? `#trend_${cleanTrendId}` : 'Cluster Stream'}
                    </span>

                    {/* Live Signal Status - Vibrant Emerald */}
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-950 dark:text-white bg-emerald-50/90 dark:bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Primary Cluster</span>
                    </span>
                  </div>

                  {/* Dominance Badge with warm golden amber tint */}
                  <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/15 via-amber-400/20 to-amber-500/15 border border-amber-400/60 px-4 py-1.5 rounded-full shadow-xs">
                    <span className="text-[11px] text-slate-950 dark:text-white font-bold uppercase tracking-wider">Share</span>
                    <span className="font-mono text-[14px] font-extrabold text-slate-950 dark:text-white">
                      {formatPercent(spotlightTrend?.percentage_of_dataset ?? 0)}
                    </span>
                  </div>
                </div>

                {/* Headline & Summary */}
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[10.5px] font-bold uppercase tracking-wider bg-amber-500/15 text-slate-950 dark:text-white border border-amber-400/40">
                      Dominant Discourse
                    </span>
                  </div>
                  <h3 className="text-[22px] sm:text-[25px] font-extrabold text-slate-900 dark:text-white leading-tight tracking-tight font-sans">
                    {spotlightTrend?.trend_name || spotlightTrend?.label || (isLoading ? 'Analyzing Discourse...' : 'Discourse Synthesizing')}
                  </h3>
                  <p className="text-[13.5px] text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
                    {spotlightTrend?.trend_summary ||
                      (isLoading ? 'Ingesting telemetry across cluster nodes...' : 'Discovered semantic topic cluster aggregated across channels.')}
                  </p>
                </div>

                {/* 4 Metric Pods (Matching Priority Tier cards style: top icon, uppercase mono label, bold number, colored text) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-1">
                  {/* Volume Pod */}
                  <div className="p-3 sm:p-3.5 rounded-[18px] bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-[#2C333E] hover:border-slate-300 dark:hover:border-slate-600 text-left transition-all shadow-xs hover:shadow-md flex flex-col justify-between min-h-[102px] group/pod">
                    <div>
                      <BarChart3 className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" strokeWidth={1.8} />
                    </div>
                    <div className="mt-1.5">
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">Volume</div>
                      <div className="text-[22px] sm:text-[24px] font-black text-slate-900 dark:text-white leading-none my-0.5 tracking-tight font-sans">
                        {spotlightTrend?.message_count ?? 0}
                      </div>
                      <div className="text-[10.5px] font-semibold text-blue-600 dark:text-blue-400 font-sans">Active Messages</div>
                    </div>
                  </div>

                  {/* Dominance Pod */}
                  <div className="p-3 sm:p-3.5 rounded-[18px] bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-[#2C333E] hover:border-slate-300 dark:hover:border-slate-600 text-left transition-all shadow-xs hover:shadow-md flex flex-col justify-between min-h-[102px] group/pod">
                    <div>
                      <Flame className="w-4.5 h-4.5 text-amber-500 dark:text-amber-400" strokeWidth={1.8} />
                    </div>
                    <div className="mt-1.5">
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">Dominance</div>
                      <div className="text-[22px] sm:text-[24px] font-black text-slate-900 dark:text-white leading-none my-0.5 tracking-tight font-sans">
                        {formatPercent(spotlightTrend?.percentage_of_dataset ?? 0)}
                      </div>
                      <div className="text-[10.5px] font-semibold text-amber-600 dark:text-amber-400 font-sans">Cluster Share</div>
                    </div>
                  </div>

                  {/* Cluster Label Pod */}
                  <div className="p-3 sm:p-3.5 rounded-[18px] bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-[#2C333E] hover:border-slate-300 dark:hover:border-slate-600 text-left transition-all shadow-xs hover:shadow-md flex flex-col justify-between min-h-[102px] group/pod">
                    <div>
                      <Layers className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.8} />
                    </div>
                    <div className="mt-1.5">
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">Cluster ID</div>
                      <div className="text-[22px] sm:text-[24px] font-black text-slate-900 dark:text-white leading-none my-0.5 tracking-tight font-sans">
                        {spotlightTrend?.cluster_label !== undefined ? `#${spotlightTrend.cluster_label}` : '—'}
                      </div>
                      <div className="text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400 font-sans">HDBSCAN Core</div>
                    </div>
                  </div>

                  {/* Narratives Pod */}
                  <div className="p-3 sm:p-3.5 rounded-[18px] bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-[#2C333E] hover:border-slate-300 dark:hover:border-slate-600 text-left transition-all shadow-xs hover:shadow-md flex flex-col justify-between min-h-[102px] group/pod">
                    <div>
                      <GitFork className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400" strokeWidth={1.8} />
                    </div>
                    <div className="mt-1.5">
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">Narratives</div>
                      <div className="text-[22px] sm:text-[24px] font-black text-slate-900 dark:text-white leading-none my-0.5 tracking-tight font-sans">
                        {spotlightTrend?.associated_narrative_ids?.length ?? 0}
                      </div>
                      <div className="text-[10.5px] font-semibold text-purple-600 dark:text-purple-400 font-sans">Linked Threads</div>
                    </div>
                  </div>
                </div>

                {/* Inspect Dossier Action Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = spotlightTrend?.trend_id || (cleanTrendId ? `trend_${cleanTrendId}` : '');
                      if (targetId) {
                        navigate(`/trends/${targetId}`);
                      } else {
                        navigate('/trends');
                      }
                    }}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#181D24] dark:bg-amber-400 hover:bg-slate-900 dark:hover:bg-amber-300 text-white dark:text-[#14181F] text-[13px] font-semibold shadow-md hover:shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <span>Inspect Dossier</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* RIGHT SIDE: The Orbit Constellation Visualizer (Apple-Minimalist Radar) */}
              <div className="lg:col-span-5 flex items-center justify-center">
                <div className="w-full relative rounded-[24px] bg-[#FAF9F5] dark:bg-[#13171F] border border-slate-200/80 dark:border-white/[0.08] p-3 sm:p-4 overflow-hidden flex items-center justify-center min-h-[310px] sm:min-h-[340px] shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                  <svg viewBox="0 0 420 340" className="w-full h-[300px] sm:h-[330px] select-none overflow-visible">
                    <defs>
                      {/* Apple Subtle Glow */}
                      <radialGradient id="appleOrbitAura" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.08" />
                        <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.02" />
                        <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
                      </radialGradient>
                      {/* Apple Soft Drop Shadow for Floating Pills */}
                      <filter id="applePillShadow" x="-15%" y="-30%" width="130%" height="180%">
                        <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="#0F172A" floodOpacity="0.05" />
                      </filter>
                      {/* Apple Soft Shadow for Central Hub */}
                      <filter id="appleHubShadow" x="-25%" y="-25%" width="150%" height="150%">
                        <feDropShadow dx="0" dy="2" stdDeviation="3.5" floodColor="#0F172A" floodOpacity="0.07" />
                      </filter>
                    </defs>

                    {/* Ambient Core Glow */}
                    <circle cx="210" cy="170" r="140" fill="url(#appleOrbitAura)" />

                    {/* Apple Minimalist Polar Tracks (Visible Authentic Precision Tracks) */}
                    <circle cx="210" cy="170" r="52" fill="none" stroke="#94A3B8" strokeWidth="1.1" opacity="0.85" className="dark:stroke-[#4B5563] dark:opacity-90" />
                    <circle cx="210" cy="170" r="96" fill="none" stroke="#94A3B8" strokeWidth="1.1" opacity="0.75" className="dark:stroke-[#4B5563] dark:opacity-80" />
                    <circle cx="210" cy="170" r="138" fill="none" stroke="#94A3B8" strokeWidth="1.1" opacity="0.65" className="dark:stroke-[#4B5563] dark:opacity-70" />

                    {/* Minimal Precision Crosshairs */}
                    <line x1="50" y1="170" x2="370" y2="170" stroke="#94A3B8" strokeWidth="0.9" opacity="0.6" className="dark:stroke-[#4B5563] dark:opacity-60" />
                    <line x1="210" y1="25" x2="210" y2="315" stroke="#94A3B8" strokeWidth="0.9" opacity="0.6" className="dark:stroke-[#4B5563] dark:opacity-60" />

                    {/* Dynamic Orbital Keywords (100% Data-Driven from Cluster) */}
                    {(() => {
                      const cx = 210;
                      const cy = 170;
                      const keywords = (spotlightTrend?.representative_keywords && spotlightTrend.representative_keywords.length > 0)
                        ? spotlightTrend.representative_keywords.slice(0, 6)
                        : (spotlightTrend?.label
                            ? spotlightTrend.label.split(',').map((kw, i) => ({
                                keyword: kw.trim(),
                                score: Math.max(0.3, +(1.0 - i * 0.15).toFixed(2)),
                              })).filter((k) => k.keyword.length > 0).slice(0, 6)
                            : []);

                      const nodePositions = [
                        { x: 305, y: 95 },   // Top Right
                        { x: 305, y: 235 },  // Bottom Right
                        { x: 210, y: 292 },  // Bottom Center
                        { x: 115, y: 235 },  // Bottom Left
                        { x: 115, y: 95 },   // Top Left
                        { x: 210, y: 48 },   // Top Center
                      ];

                      if (keywords.length === 0) {
                        return (
                          <text x={cx} y={cy + 55} textAnchor="middle" className="font-sans text-[11px] fill-slate-400 dark:fill-slate-500 font-medium">
                            {isLoading ? 'Scanning cluster coordinates...' : 'Awaiting cluster keywords...'}
                          </text>
                        );
                      }

                      return keywords.map((kw, idx) => {
                        const pos = nodePositions[idx] || { x: cx, y: cy };
                        const isTopRank = idx === 0;
                        const tag = `#${kw.keyword}`;
                        const score = Number(kw.score).toFixed(1);
                        const badgeWidth = Math.max(86, Math.round(tag.length * 7.4 + 42));
                        const badgeHeight = 26;
                        const badgeY = pos.y - badgeHeight / 2;

                        return (
                          <g key={idx} className="group/node cursor-pointer select-none">
                            {/* Clean Ray Connector with Authentic Definition */}
                            <line
                              x1={cx}
                              y1={cy}
                              x2={pos.x}
                              y2={pos.y}
                              stroke="#94A3B8"
                              strokeWidth="1.1"
                              opacity="0.75"
                              className="dark:stroke-[#4B5563] group-hover/node:stroke-amber-400 group-hover/node:opacity-100 dark:group-hover/node:stroke-amber-400 transition-all duration-200"
                            />

                            {/* Minimalist Floating Pill */}
                            <rect
                              x={pos.x - badgeWidth / 2}
                              y={badgeY}
                              width={badgeWidth}
                              height={badgeHeight}
                              rx={badgeHeight / 2}
                              fill={isTopRank ? '#FFFFFF' : '#FFFFFF'}
                              stroke={isTopRank ? '#F59E0B' : '#CBD5E1'}
                              strokeWidth={isTopRank ? '1.4' : '1.1'}
                              filter="url(#applePillShadow)"
                              className="dark:fill-[#1A1F29] dark:stroke-[#3E4A5C] group-hover/node:stroke-amber-400 dark:group-hover/node:stroke-amber-400 transition-colors duration-200"
                            />

                            {/* Tag text - Crisp Sans Typography */}
                            <text
                              x={pos.x - badgeWidth / 2 + 11}
                              y={pos.y + 4}
                              textAnchor="start"
                              fill="#1E293B"
                              className="font-sans font-medium text-[11px] tracking-tight dark:fill-white"
                            >
                              {tag}
                            </text>

                            {/* Score Micro-Badge */}
                            <rect
                              x={pos.x + badgeWidth / 2 - 27}
                              y={pos.y - 7.5}
                              width="19"
                              height="15"
                              rx="7.5"
                              fill={isTopRank ? '#FEF3C7' : '#F1F5F9'}
                              className={isTopRank ? 'dark:fill-amber-950/60' : 'dark:fill-[#262E3B]'}
                            />
                            <text
                              x={pos.x + badgeWidth / 2 - 17.5}
                              y={pos.y + 3.5}
                              textAnchor="middle"
                              fill={isTopRank ? '#B45309' : '#64748B'}
                              className={`font-mono text-[9px] ${isTopRank ? 'font-bold dark:fill-white' : 'font-medium dark:fill-white'}`}
                            >
                              {score}
                            </text>
                          </g>
                        );
                      });
                    })()}

                    {/* Central Hub (Apple Nucleus) */}
                    <circle cx="210" cy="170" r="34" fill="none" stroke="#F59E0B" strokeWidth="1" opacity="0.5" />
                    <circle cx="210" cy="170" r="27" fill="#FFFFFF" filter="url(#appleHubShadow)" className="dark:fill-[#1A1F29]" />
                    <circle cx="210" cy="170" r="27" fill="none" stroke="#F59E0B" strokeWidth="1.4" opacity="1" />
                    <text x="210" y="163" textAnchor="middle" className="font-mono text-[7px] font-semibold tracking-[0.2em] fill-slate-400 dark:fill-slate-400">
                      CLUSTER
                    </text>
                    <text x="210" y="179" textAnchor="middle" className="font-sans text-[14px] font-bold fill-slate-900 dark:fill-white">
                      {spotlightTrend?.cluster_label !== undefined ? `#${spotlightTrend.cluster_label}` : '—'}
                    </text>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
              CONTAINER 2: MTPROTO TELEMETRY STREAM (Crextio Deep Charcoal Card)
              Warm gold accents, clean activity wave, and corporate dispatch rows
              ========================================================================= */
          <div className="rounded-[30px] bg-[#1E2229] text-white border border-[#2D333F] p-7 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.06)] flex flex-col justify-between relative overflow-hidden w-full font-sans">
            <div className="relative z-10">
              {/* Header: Title + Subtitle + Crextio Badges */}
              <div className="flex items-center justify-between border-b border-[#2C3340] pb-4 mb-4 flex-wrap gap-2">
                <div>
                  <div className="text-[20px] font-semibold text-white tracking-tight flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                    <span>MTProto Telemetry Stream</span>
                  </div>
                  <div className="text-[12.5px] text-slate-400 font-normal mt-0.5">
                    Layer 182 • Automated Real-time Telemetry Ingestion
                  </div>
                </div>

                {/* Crextio Warm Badges */}
                <div className="flex items-center gap-2">
                  <span className="py-1 px-3 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30 text-[11px] font-medium">
                    {liveMessages.length > 0 ? `${liveMessages.length} live stream` : `${recentMessages.length} ingested records`}
                  </span>
                  <span className="py-1 px-3 rounded-full bg-[#282F3B] text-slate-300 border border-[#374151] text-[11px] font-medium">
                    0% Loss
                  </span>
                </div>
              </div>

              {/* 6 Containers of Live Telemetry Data */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 my-4">
                {(() => {
                  const feed = [
                    ...liveMessages.map((msg, i) => ({
                      id: String(msg.message_id || `live_${i}`),
                      channel: msg.channel_username || msg.channel_title || 'telemetry_node',
                      timestamp: msg.timestamp,
                      text: msg.text,
                      isLive: true,
                    })),
                    ...recentMessages.map((msg, i) => ({
                      id: String(msg.native_id || msg.canonical_id || `rec_${i}`),
                      channel: msg.channel_title || msg.author_id || 'ingestion_node',
                      timestamp: msg.published_at,
                      text: msg.text_content,
                      isLive: false,
                    })),
                  ].slice(0, 6);

                  if (feed.length === 0) {
                    return (
                      <div className="col-span-full py-12 text-center text-slate-400 text-[13px] font-mono">
                        {isLoading ? 'Connecting to MTProto ingestion conduit...' : 'Awaiting incoming live telemetry packets...'}
                      </div>
                    );
                  }

                  return feed.map((msg, i) => (
                    <div
                      key={msg.id || i}
                      onClick={() => navigate(`/explorer?keyword=${encodeURIComponent(msg.id || '')}`)}
                      className="p-4 rounded-[20px] bg-[#252B35] hover:bg-[#2B333E] border border-[#323946] hover:border-amber-400/50 transition-all cursor-pointer group/feed flex flex-col justify-between shadow-2xs min-h-[140px]"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[12px] mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white group-hover/feed:text-amber-300 transition-colors truncate max-w-[140px]">
                              @{msg.channel}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                              msg.isLive
                                ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30'
                                : 'bg-amber-400/15 text-amber-300 border-amber-400/30'
                            }`}>
                              {msg.isLive ? 'Stream' : 'Ingest'}
                            </span>
                          </div>
                          <span className="text-slate-400 text-[11px] font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[12.5px] text-slate-300 line-clamp-3 leading-relaxed font-normal">
                          {msg.text || '<verified payload recorded>'}
                        </p>
                      </div>

                      <div className="pt-2.5 mt-2 border-t border-[#323946]/70 flex items-center justify-between text-[10.5px]">
                        <span className="text-slate-400 font-mono flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${msg.isLive ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400'}`} />
                          <span>{msg.isLive ? 'Live Packet' : 'Verified Canonical'}</span>
                        </span>
                        <span className="text-amber-400/80 font-mono font-medium">
                          #{msg.id.length > 8 ? msg.id.slice(-6) : msg.id}
                        </span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Terminal Pipeline Footer */}
            <div className="relative z-10 pt-4 border-t border-[#2C3340] flex items-center justify-between gap-4 mt-4">
              <div className="flex items-center gap-2 text-[12px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Pipeline Sync: Stages 1-4 Online</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/explorer')}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 text-[12.5px] font-bold shadow-xs transition-all cursor-pointer shrink-0"
              >
                <span>Launch Explorer</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================================
          ZONE 4: RANKED NARRATIVE SIGNALS MATRIX (Slim Crextio Table Roster)
          Matches Crextio roster reference: slim single-line rows, fine dotted line,
          headline-only focus, and exact warm golden-yellow hover/active highlight (#FECB49)
          ========================================================================= */}
      <section className="rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 border border-slate-200/80 dark:border-[#2B323D] p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-3">
        <div className="flex items-center justify-between pb-1">
          <div>
            <h3 className="text-[17px] font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Top Priority Narrative Signals
            </h3>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">
              Ranked by Priority Signal Score across monitored narrative candidates
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/narratives')}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#2F65F6] dark:text-[#5878C7] hover:underline transition-colors group cursor-pointer"
          >
            <span>View all narratives</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2 pt-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="h-12 bg-slate-50 dark:bg-[#12161C] rounded-[16px] animate-pulse" />
            ))}
          </div>
        ) : topNarratives.length === 0 ? (
          <div className="py-12 text-center text-[13.5px] text-slate-500 dark:text-slate-400 space-y-2">
            <ShieldAlert className="w-7 h-7 text-slate-400 mx-auto" />
            <p>No narrative candidates available. Run the 4G scoring pipeline to populate candidates.</p>
          </div>
        ) : (
          <div className="w-full">
            {/* Table Header Row */}
            <div className="hidden md:flex items-center justify-between gap-6 px-4 py-2 text-[12px] font-medium text-slate-400 dark:text-slate-500 select-none">
              <div className="flex-1 min-w-0">Headline</div>
              <div className="grid grid-cols-[115px_105px_95px_65px_65px] gap-6 shrink-0 text-left">
                <div>Coverage</div>
                <div>Trend</div>
                <div>Priority</div>
                <div className="text-right">Score</div>
                <div className="text-right">Volume</div>
              </div>
            </div>

            {/* Fine Dotted Divider Matching Reference */}
            <div className="border-b border-dotted border-slate-200 dark:border-slate-800 my-1.5" />

            {/* Slim Table Rows */}
            <div className="space-y-1.5 pt-1">
              {topNarratives.map((item, index) => {
                const tierBadge = formatPriorityTierBadge(item.priority_tier);
                const densityBadge = formatEvidenceDensityBadge(item.evidence_density);
                const isHighlighted = hoveredNarrativeId === item.narrative_id;

                const rawName =
                  item.narrative_name?.replace(/#/g, '') ||
                  item.headline_claim ||
                  getNarrativeDisplayName(item);
                const displayName = rawName
                  .replace(/–/g, ' ')
                  .replace(/\s+Discourse$/i, '')
                  .trim();

                const coverageLabel = item.distinct_sources_count
                  ? `${item.distinct_sources_count} ${item.distinct_sources_count === 1 ? 'channel' : 'channels'}`
                  : item.evidence_density
                  ? `${densityBadge.label} Density`
                  : '1 channel';

                return (
                  <div
                    key={item.narrative_id}
                    onMouseEnter={() => setHoveredNarrativeId(item.narrative_id)}
                    onMouseLeave={() => setHoveredNarrativeId(null)}
                    onClick={() => navigate(`/narratives/${item.narrative_id}`)}
                    className={`flex items-center justify-between gap-6 px-4 py-2.5 rounded-[18px] cursor-pointer select-none transition-all duration-150 ${
                      isHighlighted
                        ? 'bg-[#FECB49] text-slate-950 font-medium shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-[#FECB49] hover:text-slate-950'
                    }`}
                  >
                    {/* Left Side: Headline */}
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                      {/* Circular Number Bullet */}
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 transition-colors ${
                          isHighlighted
                            ? 'bg-slate-950/10 text-slate-950'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {index + 1}
                      </div>

                      {/* Slim Headline Only */}
                      <span
                        className={`text-[13.5px] truncate font-medium ${
                          isHighlighted
                            ? 'text-slate-950 font-bold'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                        title={displayName}
                      >
                        {displayName}
                      </span>
                    </div>

                    {/* Right Side: Coverage -> Volume */}
                    <div className="hidden md:grid grid-cols-[115px_105px_95px_65px_65px] gap-6 shrink-0 items-center">
                      {/* Coverage */}
                      <div className="min-w-0">
                        <span
                          className={`text-[12.5px] font-mono truncate block ${
                            isHighlighted ? 'text-slate-900 font-medium' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {coverageLabel}
                        </span>
                      </div>

                      {/* Origin Trend */}
                      <div className="min-w-0">
                        <span
                          className={`text-[12.5px] font-mono truncate block ${
                            isHighlighted ? 'text-slate-900 font-medium' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          Trend #{item.promoted_from_topic_id.replace(/^topic_|^trend_/, '')}
                        </span>
                      </div>

                      {/* Priority Tier */}
                      <div className="flex items-center min-w-0">
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium transition-colors ${
                            isHighlighted
                              ? 'bg-black/10 text-slate-950 border border-black/10 font-semibold'
                              : `${tierBadge.bg} ${tierBadge.text} border ${tierBadge.border}`
                          }`}
                        >
                          {tierBadge.label}
                        </span>
                      </div>

                      {/* Score */}
                      <div className="text-right min-w-0">
                        <span
                          className={`font-mono text-[13px] font-bold block ${
                            isHighlighted ? 'text-slate-950' : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {item.priority_signal_score.toFixed(3)}
                        </span>
                      </div>

                      {/* Volume */}
                      <div className="text-right min-w-0">
                        <span
                          className={`font-mono text-[12px] block ${
                            isHighlighted ? 'text-slate-900 font-medium' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {item.message_count.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Mobile Score preview */}
                    <div className="md:hidden shrink-0 font-mono text-[12px] font-bold">
                      {item.priority_signal_score.toFixed(3)}
                    </div>
                  </div>
                );
              })}
            </div>
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
