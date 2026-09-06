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
import { AnalyticsOverviewResponse, NarrativeSummaryResponse } from '../../types/api';
import {
  formatPriorityTierBadge,
  formatEvidenceDensityBadge,
  formatPercent,
  formatDecimal,
  COORDINATION_WORDING,
  REACH_WORDING,
} from '../../utils/telemetryFormatters';
import { PipelineMetricsModal } from '../../components/pipeline/PipelineMetricsModal';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState<AnalyticsOverviewResponse | null>(null);
  const [topNarratives, setTopNarratives] = useState<NarrativeSummaryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage('');
    try {
      const [analyticsData, narrativesData] = await Promise.all([
        telemetryApi.getAnalyticsOverview(),
        telemetryApi.getNarratives({
          page: 1,
          page_size: 5,
          sort_by: 'priority_signal_score',
          order: 'desc',
        }),
      ]);
      setAnalytics(analyticsData);
      setTopNarratives(narrativesData.data);
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
        <div className="p-4 rounded-[20px] bg-rose-50 border border-rose-200 text-rose-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[14px] font-bold">Failed to load analytics telemetry</h4>
              <p className="text-[13px] text-rose-700 mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* 2. Pipeline Execution Banner (Live Backend Metadata) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 rounded-[20px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs text-[13px] text-[#64748B]">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-[#111727] font-semibold">
            <Clock className="w-4 h-4 text-[#2F65F6]" />
            <span>
              Ingestion Timestamp:{' '}
              <span className="font-mono text-[12px] text-[#475569]">
                {execution?.created_at_utc ? new Date(execution.created_at_utc).toLocaleString() : 'Awaiting sync'}
              </span>
            </span>
          </span>
          {overviewData?.dataset_source && (
            <>
              <span className="text-slate-300">•</span>
              <span>
                Dataset:{' '}
                <span className="font-mono font-medium text-[#111727]">
                  {overviewData.dataset_source}
                </span>
              </span>
            </>
          )}
          {execution && (
            <>
              <span className="text-slate-300">•</span>
              <span>
                Runtime:{' '}
                <span className="font-mono text-[12px] bg-slate-100 px-2 py-0.5 rounded-full">
                  {execution.total_runtime_seconds.toFixed(2)}s
                </span>
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-700 font-mono text-[12px] uppercase tracking-wider">
            Pipeline Ready
          </span>
        </div>
      </div>

      {/* 3. Top-Level Summary KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Ingested Messages */}
        <div className="rounded-[24px] p-6 shadow-dashboard bg-white border border-[rgba(228,233,245,0.85)] flex flex-col justify-between transition-all duration-200 hover:shadow-dashboard-hover">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#8591A5] uppercase tracking-wider">
                Total Ingested
              </span>
              <p className="text-[12px] text-[#475569] font-medium mt-0.5">Canonical corpus</p>
            </div>
            <div className="w-10 h-10 rounded-[14px] bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2F65F6]">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5">
            <div className="text-[34px] font-bold text-[#111727] font-mono tracking-tight leading-none">
              {isLoading ? '...' : (summary?.total_messages ?? 0).toLocaleString()}
            </div>
            <div className="text-[12px] text-[#8591A5] font-medium mt-2">
              Noise filtered: {(summary?.noise_messages ?? 0).toLocaleString()} items
            </div>
          </div>
        </div>

        {/* KPI 2: Topic Clusters */}
        <div className="rounded-[24px] p-6 shadow-dashboard bg-white border border-[rgba(228,233,245,0.85)] flex flex-col justify-between transition-all duration-200 hover:shadow-dashboard-hover">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#8591A5] uppercase tracking-wider">
                Discovered Topics
              </span>
              <p className="text-[12px] text-[#475569] font-medium mt-0.5">c-TF-IDF semantic clusters</p>
            </div>
            <div className="w-10 h-10 rounded-[14px] bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Radio className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5">
            <div className="text-[34px] font-bold text-[#111727] font-mono tracking-tight leading-none">
              {isLoading ? '...' : summary?.total_topics ?? 0}
            </div>
            <button
              type="button"
              onClick={() => navigate('/topics')}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2F65F6] hover:underline mt-2"
            >
              <span>Explore topics</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* KPI 3: Priority Narratives */}
        <div className="rounded-[24px] p-6 shadow-dashboard bg-gradient-to-br from-[#FFA690] via-[#FF856D] to-[#FFEBE5] flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:shadow-dashboard-hover">
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-white/20 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[12px] font-bold text-[#111727] uppercase tracking-wider">
                Active Narratives
              </span>
              <p className="text-[12px] text-[#475569] font-medium mt-0.5">4G scored candidates</p>
            </div>
            <div className="w-10 h-10 rounded-[14px] bg-white/40 backdrop-blur-sm border border-white/50 flex items-center justify-center text-[#111727]">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5 relative z-10">
            <div className="text-[34px] font-bold text-[#111727] font-mono tracking-tight leading-none">
              {isLoading ? '...' : summary?.total_narratives ?? 0}
            </div>
            <div className="text-[12px] text-[#111727] font-medium mt-2">
              Critical / High:{' '}
              <span className="font-bold">
                {(priorityDist?.critical ?? 0) + (priorityDist?.high ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Critical Tier Attention */}
        <div className="rounded-[24px] p-6 shadow-dashboard bg-white border border-[rgba(228,233,245,0.85)] flex flex-col justify-between transition-all duration-200 hover:shadow-dashboard-hover">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#8591A5] uppercase tracking-wider">
                Critical Priority
              </span>
              <p className="text-[12px] text-[#475569] font-medium mt-0.5">Immediate triage</p>
            </div>
            <div className="w-10 h-10 rounded-[14px] bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5">
            <div className="text-[34px] font-bold text-rose-600 font-mono tracking-tight leading-none">
              {isLoading ? '...' : priorityDist?.critical ?? 0}
            </div>
            <button
              type="button"
              onClick={() => navigate('/narratives?priority_tier=critical')}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-rose-700 hover:underline mt-2"
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
        <div className="rounded-[26px] bg-white border border-[rgba(228,233,245,0.85)] p-6 shadow-dashboard space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-[16px] font-bold text-[#111727]">Priority Signal Tier Breakdown</h3>
              <p className="text-[12px] text-[#8591A5]">Backend 4G composite scoring distribution</p>
            </div>
            <span className="text-[11px] font-mono text-[#64748B] bg-slate-100 px-2.5 py-1 rounded-full">
              Frozen Formula
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-4 rounded-[18px] bg-rose-50/70 border border-rose-200/60">
              <div className="text-[11px] font-bold text-rose-700 uppercase">Critical</div>
              <div className="text-[26px] font-bold text-rose-800 font-mono mt-1">
                {priorityDist?.critical ?? 0}
              </div>
              <div className="text-[11px] text-rose-600 mt-1 font-medium">Score ≥ 0.75</div>
            </div>

            <div className="p-4 rounded-[18px] bg-amber-50/70 border border-amber-200/60">
              <div className="text-[11px] font-bold text-amber-700 uppercase">High</div>
              <div className="text-[26px] font-bold text-amber-800 font-mono mt-1">
                {priorityDist?.high ?? 0}
              </div>
              <div className="text-[11px] text-amber-600 mt-1 font-medium">0.55 – 0.74</div>
            </div>

            <div className="p-4 rounded-[18px] bg-blue-50/70 border border-blue-200/60">
              <div className="text-[11px] font-bold text-blue-700 uppercase">Elevated</div>
              <div className="text-[26px] font-bold text-blue-800 font-mono mt-1">
                {priorityDist?.elevated ?? 0}
              </div>
              <div className="text-[11px] text-blue-600 mt-1 font-medium">0.35 – 0.54</div>
            </div>

            <div className="p-4 rounded-[18px] bg-slate-50 border border-slate-200/70">
              <div className="text-[11px] font-bold text-slate-700 uppercase">Routine</div>
              <div className="text-[26px] font-bold text-slate-800 font-mono mt-1">
                {priorityDist?.routine ?? 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 font-medium">&lt; 0.35</div>
            </div>
          </div>

          <div className="p-3.5 rounded-[16px] bg-[#F8FAFD] border border-slate-200/60 text-[12px] text-[#64748B] flex items-center gap-2">
            <Info className="w-4 h-4 text-[#2F65F6] shrink-0" />
            <span>
              Priority Signal Score = 0.30 · Spread + 0.30 · Coordination + 0.20 · {REACH_WORDING.primary} + 0.20 · Friction.
            </span>
          </div>
        </div>

        {/* Sentiment Overview & Availability */}
        <div className="rounded-[26px] bg-white border border-[rgba(228,233,245,0.85)] p-6 shadow-dashboard space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-[16px] font-bold text-[#111727]">Corpus Sentiment Overview</h3>
              <p className="text-[12px] text-[#8591A5]">Evaluated message distribution</p>
            </div>
            {sentiment && sentiment.evaluated_messages_count > 0 ? (
              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-semibold">
                Evaluated ({sentiment.evaluated_messages_count} msgs)
              </span>
            ) : (
              <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full font-semibold">
                Coverage Limited
              </span>
            )}
          </div>

          {sentiment && sentiment.evaluated_messages_count > 0 ? (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-[16px] bg-emerald-50/70 border border-emerald-100">
                  <div className="text-[11px] font-semibold text-emerald-800 uppercase">Positive</div>
                  <div className="text-[20px] font-bold text-emerald-900 font-mono mt-0.5">
                    {formatPercent(sentiment.distribution.positive_ratio)}
                  </div>
                </div>
                <div className="p-3.5 rounded-[16px] bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-700 uppercase">Neutral</div>
                  <div className="text-[20px] font-bold text-slate-800 font-mono mt-0.5">
                    {formatPercent(sentiment.distribution.neutral_ratio)}
                  </div>
                </div>
                <div className="p-3.5 rounded-[16px] bg-rose-50/70 border border-rose-100">
                  <div className="text-[11px] font-semibold text-rose-800 uppercase">Negative</div>
                  <div className="text-[20px] font-bold text-rose-900 font-mono mt-0.5">
                    {formatPercent(sentiment.distribution.negative_ratio)}
                  </div>
                </div>
              </div>
              <p className="text-[12px] text-[#64748B]">
                Inference model: <span className="font-mono">{sentiment.sentiment_model_id || 'vader_baseline'}</span> across {sentiment.evaluated_messages_count} messages.
              </p>
            </div>
          ) : (
            <div className="p-5 rounded-[18px] bg-slate-50 border border-slate-200 text-center space-y-2">
              <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
              <h4 className="text-[14px] font-bold text-[#111727]">
                Sentiment Inference Unavailable
              </h4>
              <p className="text-[12px] text-[#64748B] max-w-md mx-auto">
                Corpus sentiment classification has not been evaluated or has insufficient data coverage. Values are preserved as unavailable rather than fabricated neutral.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 5. Top Emerging Narrative Candidates */}
      <section className="rounded-[26px] bg-white border border-[rgba(228,233,245,0.85)] p-6 md:p-8 shadow-dashboard space-y-5">
        <div className="flex items-center justify-between border-b border-[rgba(228,233,245,0.85)] pb-4">
          <div>
            <h3 className="text-[18px] font-bold text-[#111727] tracking-tight">
              Top Priority Narrative Signals
            </h3>
            <p className="text-[13px] text-[#8591A5] font-medium mt-0.5">
              Ranked by backend Priority Signal Score across monitored narrative candidates
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/narratives')}
            className="inline-flex items-center gap-1 text-[13px] font-bold text-[#2F65F6] hover:text-[#2152DE] transition-colors group"
          >
            <span>View all narratives</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 bg-slate-50 rounded-[18px] animate-pulse" />
            ))}
          </div>
        ) : topNarratives.length === 0 ? (
          <div className="p-8 text-center text-[14px] text-[#64748B]">
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
                  className="p-4 sm:p-5 rounded-[20px] border border-slate-200/80 bg-white hover:bg-slate-50/80 hover:border-slate-300 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="font-mono text-[11px] font-bold text-[#8591A5] bg-[#F1F4F9] px-2 py-0.5 rounded-full">
                        {item.narrative_id}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${tierBadge.bg} ${tierBadge.text} ${tierBadge.border}`}>
                        {tierBadge.label} Priority
                      </span>
                      <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${densityBadge.bg} ${densityBadge.text}`}>
                        {densityBadge.label} Coverage
                      </span>
                      {item.has_coordination_signals && (
                        <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          {COORDINATION_WORDING.primary}
                        </span>
                      )}
                    </div>
                    <h4 className="text-[15px] font-bold text-[#111727] truncate">
                      {item.headline_claim}
                    </h4>
                    <p className="text-[12px] text-[#8591A5] mt-1 font-mono">
                      Topic: #{item.promoted_from_topic_id} • {item.message_count} messages observed
                    </p>
                  </div>

                  {/* Metrics Cluster */}
                  <div className="flex items-center gap-4 sm:gap-6 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-[#8591A5] uppercase">
                        Priority Score
                      </div>
                      <div className="font-mono text-[20px] font-extrabold text-[#111727]">
                        {formatDecimal(item.priority_signal_score, 3)}
                      </div>
                    </div>

                    <div className="hidden sm:grid grid-cols-4 gap-2 text-center text-[10px] font-mono">
                      <div className="bg-slate-50 p-1.5 rounded-[10px] border border-slate-100">
                        <div className="text-[#8591A5]">SPREAD</div>
                        <div className="font-bold text-[#111727]">{formatDecimal(item.sub_scores.spread_score, 2)}</div>
                      </div>
                      <div className="bg-slate-50 p-1.5 rounded-[10px] border border-slate-100">
                        <div className="text-[#8591A5]">COORD</div>
                        <div className="font-bold text-[#111727]">{formatDecimal(item.sub_scores.coordination_score, 2)}</div>
                      </div>
                      <div className="bg-slate-50 p-1.5 rounded-[10px] border border-slate-100">
                        <div className="text-[#8591A5]">REACH</div>
                        <div className="font-bold text-[#111727]">{formatDecimal(item.sub_scores.reach_score, 2)}</div>
                      </div>
                      <div className="bg-slate-50 p-1.5 rounded-[10px] border border-slate-100">
                        <div className="text-[#8591A5]">FRICT</div>
                        <div className="font-bold text-[#111727]">{formatDecimal(item.sub_scores.friction_score, 2)}</div>
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[#8591A5] hover:bg-[#2F65F6] hover:text-white transition-colors">
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
