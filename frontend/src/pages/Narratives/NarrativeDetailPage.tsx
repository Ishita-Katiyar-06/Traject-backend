import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Radio,
  Layers,
  Check,
  Eye,
  AlertTriangle,
  Info,
  MessageSquare,
  Tag,
  Shield,
  Activity,
  Share2,
  GitCommit,
  History,
  Send,
} from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { telemetryApi } from '../../services/telemetryApi';
import { NarrativeDetailData, NarrativeLineageDetailResponse } from '../../types/api';
import { resolveChannelInfo } from '../../utils/channelRegistry';
import {
  formatPriorityTierBadge,
  formatEvidenceDensityBadge,
  formatDecimal,
  formatPercent,
  COORDINATION_WORDING,
  REACH_WORDING,
  EVIDENCE_DENSITY_WORDING,
} from '../../utils/telemetryFormatters';
import { NarrativeSubScoresRadar } from '../../components/ui/charts';
import { NarrativeSentimentChart } from '../../components/narratives/NarrativeSentimentChart';
import { motion } from 'motion/react';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import {
  staggerContainer,
  listItemEnter,
} from '../../utils/motion';

export const NarrativeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [narrative, setNarrative] = useState<NarrativeDetailData | null>(null);
  const [lineageDetail, setLineageDetail] = useState<NarrativeLineageDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isWatching, setIsWatching] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setIsError(false);
    setErrorMessage('');

    telemetryApi
      .getNarrativeById(id)
      .then((res) => {
        setNarrative(res.data);
      })
      .catch((err) => {
        console.error('Failed to load narrative detail:', err);
        setIsError(true);
        setErrorMessage(err.message || 'Narrative could not be retrieved from /api/v1/narratives/{id}.');
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Milestone 6E: Fetch temporal lineage data
    telemetryApi
      .getLineageByNarrative(id)
      .then((res) => setLineageDetail(res))
      .catch(() => setLineageDetail(null));
  }, [id]);

  if (isLoading) {
    return (
      <div className="py-20 text-center font-sans space-y-3">
        <div className="w-8 h-8 border-3 border-[#2F65F6] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[14px] text-[#64748B] dark:text-slate-400">Querying narrative telemetry record...</p>
      </div>
    );
  }

  if (isError || !narrative) {
    return (
      <div className="space-y-6 font-sans">
        <PageHeader
          title="Narrative Telemetry Record"
          description="Error retrieving backend intelligence candidate record."
          actions={
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => navigate('/narratives')}
            >
              Return to Narratives
            </Button>
          }
        />
        <div className="p-8 rounded-[24px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto" />
          <h3 className="text-[16px] font-bold text-rose-900 dark:text-rose-200">
            {narrative ? 'Failed to Load Details' : 'Narrative Record Not Found'}
          </h3>
          <p className="text-[13px] text-rose-700 dark:text-rose-300 max-w-md mx-auto">
            {errorMessage || `Narrative ID "${id}" does not exist or has not been scored in Milestone 5A.`}
          </p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/narratives')}>
            Back to Narratives List
          </Button>
        </div>
      </div>
    );
  }

  const tierBadge = formatPriorityTierBadge(narrative.priority_tier);
  const densityBadge = formatEvidenceDensityBadge(narrative.data_coverage.evidence_density);

  return (
    <div className="space-y-6 sm:space-y-8 font-sans pb-10">
      {/* 1. Page Header */}
      <PageHeader
        title={narrative.headline_claim}
        description={`Authoritative 4G narrative evaluation for candidate cluster ${narrative.narrative_id}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => navigate('/narratives')}
            >
              Narratives
            </Button>

            <Button
              variant={isWatching ? 'primary' : 'secondary'}
              size="sm"
              leftIcon={isWatching ? <Check className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              onClick={() => setIsWatching(!isWatching)}
            >
              {isWatching ? 'Tracking' : 'Track Candidate'}
            </Button>
          </div>
        }
      />

      {/* Metadata Pill Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 rounded-[20px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] text-[13px] font-sans text-[#64748B] dark:text-slate-400 shadow-dashboard">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[#111727] dark:text-slate-200 uppercase font-bold text-[11px] font-mono bg-[#EEF1F8] dark:bg-[#12161C] px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-[#2B323A]">
            {narrative.narrative_id}
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${tierBadge.bg} ${tierBadge.text} ${tierBadge.border}`}
          >
            {tierBadge.label} Priority
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span
            className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${densityBadge.bg} ${densityBadge.text}`}
            title={EVIDENCE_DENSITY_WORDING.tooltip}
          >
            {densityBadge.label} Coverage
          </span>
          {narrative.is_cross_source && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/50 px-2.5 py-0.5 rounded-full">
                Cross-Source ({narrative.distinct_sources_count || 2} channels)
              </span>
            </>
          )}
          {narrative.is_cross_domain && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-[11px] font-semibold text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 px-2.5 py-0.5 rounded-full">
                Cross-Domain ({narrative.distinct_domains_count || 2} domains)
              </span>
            </>
          )}
          {narrative.quality_classification && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#1D232A] border border-slate-200 dark:border-[#2B323A] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {narrative.quality_classification.replace(/_/g, ' ')}
              </span>
            </>
          )}
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <button
            type="button"
            onClick={() => navigate(`/trends/${narrative.promoted_from_topic_id}`)}
            className="inline-flex items-center gap-1 font-semibold text-[#2F65F6] dark:text-[#93C5FD] hover:underline"
          >
            <Radio className="w-3 h-3" />
            <span>Parent Trend #{narrative.promoted_from_topic_id}</span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-[12px]">
          <span className="inline-flex items-center gap-1 text-[#475569] dark:text-slate-300">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span><strong className="text-[#111727] dark:text-slate-100 font-mono">{narrative.data_coverage.message_count.toLocaleString()}</strong> messages</span>
          </span>
          {narrative.first_observed_at && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="inline-flex items-center gap-1 font-mono text-[#64748B] dark:text-slate-400">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>First: {new Date(narrative.first_observed_at).toLocaleDateString()}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2. Primary 4G Composite Scoring Breakdown */}
      <section className="p-6 md:p-8 rounded-[24px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-dashboard space-y-6 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-[#252B32] pb-5">
          <div>
            <div className="text-[11px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">
              Frozen 4G Composite Index
            </div>
            <h3 className="text-[20px] font-bold text-[#111727] dark:text-slate-100 mt-0.5 tracking-tight">
              Priority Signal Score
            </h3>
            <p className="text-[13px] text-[#64748B] dark:text-slate-400 mt-0.5">
              Strictly backend-calculated ranking signal (Spread 30%, Coordination 30%, Observed Reach 20%, Friction 20%).
            </p>
          </div>

          <div className="p-4 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/80 dark:border-[#252B32] text-right shrink-0">
            <div className="text-[10px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">
              Composite Value
            </div>
            <div className="font-mono text-[36px] font-black text-[#111727] dark:text-slate-100 tracking-tight leading-none mt-1">
              <AnimatedNumber value={narrative.priority_signal_score} decimals={3} />
            </div>
          </div>
        </div>

        {/* 4 Dimension Cards + Analytical Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Spread Dimension */}
            <div className="p-5 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/70 dark:border-[#252B32] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Spread Score</span>
                <span className="text-[10px] font-mono text-slate-400">Weight: 30%</span>
              </div>
              <div className="font-mono text-[26px] font-extrabold text-[#111727] dark:text-slate-100 leading-tight">
                <AnimatedNumber value={narrative.sub_scores.spread_score} decimals={3} />
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">
                Multi-channel dissemination and cross-source diffusion rate.
              </p>
            </div>

            {/* Coordination Dimension */}
            <div className="p-5 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/70 dark:border-[#252B32] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Coordination Score</span>
                <span className="text-[10px] font-mono text-slate-400">Weight: 30%</span>
              </div>
              <div className="font-mono text-[26px] font-extrabold text-[#111727] dark:text-slate-100 leading-tight">
                <AnimatedNumber value={narrative.sub_scores.coordination_score} decimals={3} />
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">
                {COORDINATION_WORDING.tooltip}
              </p>
            </div>

            {/* Observed Reach Dimension */}
            <div className="p-5 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/70 dark:border-[#252B32] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  {REACH_WORDING.primary}
                </span>
                <span className="text-[10px] font-mono text-slate-400">Weight: 20%</span>
              </div>
              <div className="font-mono text-[26px] font-extrabold text-[#111727] dark:text-slate-100 leading-tight">
                <AnimatedNumber value={narrative.sub_scores.reach_score} decimals={3} />
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">
                {REACH_WORDING.tooltip}
              </p>
            </div>

            {/* Friction Dimension */}
            <div className="p-5 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/70 dark:border-[#252B32] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Friction Score</span>
                <span className="text-[10px] font-mono text-slate-400">Weight: 20%</span>
              </div>
              <div className="font-mono text-[26px] font-extrabold text-[#111727] dark:text-slate-100 leading-tight">
                <AnimatedNumber value={narrative.sub_scores.friction_score} decimals={3} />
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">
                Counter-claims, disputations, or platform content moderation friction.
              </p>
            </div>
          </div>

          {/* Analytical Radar Chart Profile */}
          <div className="p-4 rounded-[22px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/70 dark:border-[#252B32] flex flex-col items-center justify-center">
            <div className="text-[12px] font-bold text-[#111727] dark:text-slate-100 mb-1 font-sans">
              4G Formula Signal Geometry
            </div>
            <NarrativeSubScoresRadar
              subScores={narrative.sub_scores}
              priorityScore={narrative.priority_signal_score}
            />
          </div>
        </div>

        {/* Semantic Guardrail Disclaimer Note */}
        <div className="p-4 rounded-[18px] bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 flex items-start gap-3 text-[12px] text-blue-900 dark:text-blue-200">
          <Info className="w-4 h-4 text-[#2F65F6] dark:text-[#5878C7] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Operational Semantic Protocol:</strong> Priority Signal Score reflects statistical surveillance prioritization. It is not an assessment of malicious intent, threat level, or misinformation ground truth.
          </div>
        </div>
      </section>

      {/* 3. Potential Coordination Signals & Observational Data Coverage */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coordination Indicators (Signal wording only) */}
        <div className="p-6 md:p-7 rounded-[24px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-dashboard space-y-4 transition-all">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252B32] pb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h4 className="text-[16px] font-bold text-[#111727] dark:text-slate-100">
                {COORDINATION_WORDING.plural}
              </h4>
            </div>
            <span className="text-[11px] font-mono text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-2.5 py-0.5 rounded-full font-semibold">
              Anomaly Indicators
            </span>
          </div>

          <p className="text-[12px] text-[#64748B] dark:text-slate-400 leading-relaxed">
            {COORDINATION_WORDING.disclaimer}
          </p>

          <div className="space-y-2.5 pt-1">
            <div
              className={`p-3.5 rounded-[16px] border flex items-center justify-between text-[13px] ${
                narrative.coordination_signals.potential_syndication_spike
                  ? 'bg-amber-50/60 dark:bg-amber-950/25 border-amber-200/80 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 font-medium'
                  : 'bg-[#F8FAFD] dark:bg-[#13171C] border-slate-200/60 dark:border-[#252B32] text-[#64748B] dark:text-slate-400'
              }`}
            >
              <span>Potential Syndication Spike (&gt;25% uncredited duplicate content)</span>
              <span className={`font-semibold text-[11px] px-2.5 py-0.5 rounded-full ${narrative.coordination_signals.potential_syndication_spike ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {narrative.coordination_signals.potential_syndication_spike ? 'Signal Flagged' : 'Baseline'}
              </span>
            </div>

            <div
              className={`p-3.5 rounded-[16px] border flex items-center justify-between text-[13px] ${
                narrative.coordination_signals.potential_temporal_burst
                  ? 'bg-amber-50/60 dark:bg-amber-950/25 border-amber-200/80 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 font-medium'
                  : 'bg-[#F8FAFD] dark:bg-[#13171C] border-slate-200/60 dark:border-[#252B32] text-[#64748B] dark:text-slate-400'
              }`}
            >
              <span>Potential Temporal Burst (burstiness index &gt; +0.20)</span>
              <span className={`font-semibold text-[11px] px-2.5 py-0.5 rounded-full ${narrative.coordination_signals.potential_temporal_burst ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {narrative.coordination_signals.potential_temporal_burst ? 'Signal Flagged' : 'Baseline'}
              </span>
            </div>

            <div
              className={`p-3.5 rounded-[16px] border flex items-center justify-between text-[13px] ${
                narrative.coordination_signals.potential_rapid_channel_entry
                  ? 'bg-amber-50/60 dark:bg-amber-950/25 border-amber-200/80 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 font-medium'
                  : 'bg-[#F8FAFD] dark:bg-[#13171C] border-slate-200/60 dark:border-[#252B32] text-[#64748B] dark:text-slate-400'
              }`}
            >
              <span>Potential Rapid Channel Entry (&gt;10 channels/hr velocity)</span>
              <span className={`font-semibold text-[11px] px-2.5 py-0.5 rounded-full ${narrative.coordination_signals.potential_rapid_channel_entry ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {narrative.coordination_signals.potential_rapid_channel_entry ? 'Signal Flagged' : 'Baseline'}
              </span>
            </div>

            <div
              className={`p-3.5 rounded-[16px] border flex items-center justify-between text-[13px] ${
                narrative.coordination_signals.potential_cross_channel_cascade
                  ? 'bg-amber-50/60 dark:bg-amber-950/25 border-amber-200/80 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 font-medium'
                  : 'bg-[#F8FAFD] dark:bg-[#13171C] border-slate-200/60 dark:border-[#252B32] text-[#64748B] dark:text-slate-400'
              }`}
            >
              <span>Potential Cross-Channel Cascade (≥2 distinct broadcasting feeds)</span>
              <span className={`font-semibold text-[11px] px-2.5 py-0.5 rounded-full ${narrative.coordination_signals.potential_cross_channel_cascade ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {narrative.coordination_signals.potential_cross_channel_cascade ? 'Signal Flagged' : 'Baseline'}
              </span>
            </div>
          </div>
        </div>

        {/* Evidence Density & Sentiment Profiling */}
        <div className="p-6 md:p-7 rounded-[24px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-dashboard space-y-4 transition-all">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252B32] pb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-[16px] font-bold text-[#111727] dark:text-slate-100">
                Observational Data Coverage
              </h4>
            </div>
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${densityBadge.bg} ${densityBadge.text}`}
            >
              {densityBadge.label} Density
            </span>
          </div>

          <div className="p-4 rounded-[18px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/60 dark:border-[#252B32] space-y-2">
            <div className="text-[11px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">
              Data Coverage Summary
            </div>
            <div className="text-[14px] font-bold text-[#111727] dark:text-slate-100">
              {narrative.data_coverage.evidence_density.toUpperCase()} Coverage Tier
            </div>
            <div className="text-[12px] text-[#64748B] dark:text-slate-400 space-y-1">
              <div>Channels observed: <strong className="text-[#111727] dark:text-slate-200 font-mono">{narrative.data_coverage.channel_count}</strong></div>
              <div>Duration: <strong className="text-[#111727] dark:text-slate-200 font-mono">{(narrative.data_coverage.timespan_seconds / 3600).toFixed(1)} hours</strong></div>
              <div>Views data coverage: <strong className="text-[#111727] dark:text-slate-200">{narrative.data_coverage.has_views_coverage ? 'Present' : 'Sparse'}</strong></div>
            </div>
          </div>

          {/* Sentiment Profile */}
          <div className="pt-1">
            <div className="text-[12px] font-bold text-[#111727] dark:text-slate-100 mb-2 flex items-center justify-between">
              <span>Sentiment Profile</span>
              {narrative.sentiment_profile.is_available ? (
                <span className="font-mono text-[11px] text-blue-700 dark:text-[#93C5FD] bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-900/40 font-semibold">
                  Evaluated ({narrative.sentiment_profile.total_text_messages_evaluated.toLocaleString()} msgs)
                </span>
              ) : (
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#1D232A] px-2 py-0.5 rounded-full font-semibold border border-slate-200/60 dark:border-[#2B323A]">
                  Unavailable / Uncomputed
                </span>
              )}
            </div>

            {narrative.sentiment_profile.is_available ? (
              <div className="p-4 rounded-[18px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/80 dark:border-[#252B32] space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center text-[12px]">
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-[12px] border border-emerald-100 dark:border-emerald-900/40">
                    <div className="text-emerald-800 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wider">Pos</div>
                    <div className="font-bold text-emerald-900 dark:text-emerald-200 font-mono mt-0.5">{formatPercent(narrative.sentiment_profile.text_positive_ratio)}</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#1D232A] p-2.5 rounded-[12px] border border-slate-200 dark:border-[#2B323A]">
                    <div className="text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider">Neu</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 font-mono mt-0.5">{formatPercent(narrative.sentiment_profile.text_neutral_ratio)}</div>
                  </div>
                  <div className="bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-[12px] border border-rose-100 dark:border-rose-900/40">
                    <div className="text-rose-800 dark:text-rose-300 text-[10px] font-bold uppercase tracking-wider">Neg</div>
                    <div className="font-bold text-rose-900 dark:text-rose-200 font-mono mt-0.5">{formatPercent(narrative.sentiment_profile.text_negative_ratio)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-[18px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/60 dark:border-[#252B32] text-center space-y-1">
                <p className="text-[12px] text-[#64748B] dark:text-slate-400 leading-relaxed">
                  Sentiment inference is unavailable for this narrative candidate. Values are preserved as uncomputed rather than fabricated neutral.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Key Entities & Monitored Channels */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Key Entities */}
        <div className="p-6 rounded-[24px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-dashboard space-y-3 transition-all">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#2F65F6] dark:text-[#5878C7]" />
            <h4 className="text-[15px] font-bold text-[#111727] dark:text-slate-100">Extracted Entities & Framing</h4>
          </div>
          {narrative.key_entities && narrative.key_entities.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-2">
              {narrative.key_entities.map((entity, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full bg-slate-100 dark:bg-[#1D232A] text-[#111727] dark:text-slate-200 text-[12px] font-medium border border-slate-200 dark:border-[#2B323A]"
                >
                  {entity}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#8591A5] dark:text-slate-400">No entities extracted for this candidate cluster.</p>
          )}
        </div>

        {/* Monitored Channels */}
        <div className="p-6 rounded-[24px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-dashboard space-y-3 transition-all">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[#2F65F6] dark:text-[#5878C7]" />
            <h4 className="text-[15px] font-bold text-[#111727] dark:text-slate-100">Broadcasting Channels & Feeds</h4>
          </div>
          {narrative.broadcasting_channels && narrative.broadcasting_channels.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-2">
              {narrative.broadcasting_channels.map((ch, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#2F65F6] dark:text-[#93C5FD] text-[12px] font-mono font-medium border border-blue-100 dark:border-blue-900/40"
                >
                  {ch}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#8591A5] dark:text-slate-400">Channel distribution not available in summary.</p>
          )}

          {narrative.domains_represented && narrative.domains_represented.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-[#252B32] space-y-1.5">
              <div className="text-[11px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">
                Strategic Domains Represented
              </div>
              <div className="flex flex-wrap gap-1.5">
                {narrative.domains_represented.map((dom, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50 text-[11px] font-mono font-semibold"
                  >
                    {dom}
                  </span>
                ))}
              </div>
            </div>
          )}

          {narrative.validation_notes && narrative.validation_notes.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-[#252B32] space-y-1">
              <div className="text-[11px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">
                Observational Evidence Notes
              </div>
              <ul className="list-disc list-inside text-[12px] text-slate-600 dark:text-slate-400 space-y-0.5">
                {narrative.validation_notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* 4. Narrative Sentiment Time-Series Graph */}
      <NarrativeSentimentChart narrativeId={narrative.narrative_id} />

      {/* 4.5 Diffusion Footprint & Source Network Dossier */}
      <section className="p-6 md:p-8 rounded-[24px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-dashboard space-y-6 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#252B32] pb-4">
          <div className="flex items-center gap-2.5">
            <Share2 className="w-5 h-5 text-[#2F65F6] dark:text-[#5878C7]" />
            <div>
              <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100">
                Diffusion Footprint & Source Network
              </h3>
              <p className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-0.5">
                Observed discovery channels, semantic topic genesis, and secondary broadcast networks.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/propagation?cascade=${narrative.narrative_id}`)}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Explore in Propagation Engine
          </Button>
        </div>

        {/* 3-Pillar Transmission Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Origin Discovery Feeds */}
          <div className="p-5 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/70 dark:border-[#252B32] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                Origin Broadcasts
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                {(narrative.origin_channels || []).length || (narrative.domains_represented || []).length} sources
              </span>
            </div>

            <div className="space-y-2">
              {narrative.origin_channels && narrative.origin_channels.length > 0 ? (
                narrative.origin_channels.map((chan) => {
                  const info = resolveChannelInfo(chan);
                  return (
                    <div
                      key={chan}
                      className="p-2.5 rounded-xl bg-white dark:bg-[#1A2027] border border-slate-200/80 dark:border-[#252B32] shadow-xs"
                    >
                      <div className="text-[13px] font-bold text-[#111727] dark:text-slate-100 truncate">
                        {info.title}
                      </div>
                      <div className="text-[11px] font-mono text-[#8591A5] dark:text-slate-400 flex items-center justify-between mt-0.5">
                        <span>{info.handle}</span>
                        <span className="capitalize text-emerald-600 dark:text-emerald-400 font-semibold">{info.category}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-3 rounded-xl bg-white dark:bg-[#1A2027] border border-slate-200/80 dark:border-[#252B32] text-[12px] text-[#64748B] dark:text-slate-400">
                  {narrative.domains_represented && narrative.domains_represented.length > 0
                    ? narrative.domains_represented.map((d) => `Domain: ${d}`).join(', ')
                    : 'Discovered in cross-platform stream'}
                </div>
              )}
            </div>
          </div>

          {/* 2. Semantic Cluster Genesis */}
          <div className="p-5 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/70 dark:border-[#252B32] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2F65F6] dark:text-[#5878C7] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Topic Cluster
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#2F65F6] dark:text-[#93C5FD] border border-blue-200 dark:border-blue-900/50">
                {narrative.promoted_from_topic_id}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-[#1A2027] border border-slate-200/80 dark:border-[#252B32] shadow-xs space-y-1.5">
              <div className="text-[13px] font-bold text-[#111727] dark:text-slate-100">
                Synthesized Topic #{narrative.promoted_from_topic_id}
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 line-clamp-2">
                Evaluated from {narrative.data_coverage.message_count} messages across {narrative.data_coverage.channel_count} discovery channels.
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {(narrative.key_entities || []).slice(0, 3).map((e) => (
                  <span
                    key={e}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/40"
                  >
                    {e.replace(/^(domain:|hashtag:|gazetteer_geo:)/, '')}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Amplification & Broadcaster Network */}
          <div className="p-5 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/70 dark:border-[#252B32] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" />
                Broadcasters
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50">
                {(narrative.broadcasting_channels || []).length} broadcasters
              </span>
            </div>

            <div className="space-y-2">
              {narrative.broadcasting_channels && narrative.broadcasting_channels.length > 0 ? (
                narrative.broadcasting_channels.map((chan) => {
                  const info = resolveChannelInfo(chan);
                  return (
                    <div
                      key={chan}
                      className="p-2.5 rounded-xl bg-white dark:bg-[#1A2027] border border-slate-200/80 dark:border-[#252B32] shadow-xs"
                    >
                      <div className="text-[13px] font-bold text-[#111727] dark:text-slate-100 truncate">
                        {info.title}
                      </div>
                      <div className="text-[11px] font-mono text-[#8591A5] dark:text-slate-400 flex items-center justify-between mt-0.5">
                        <span>{info.handle}</span>
                        <span className="capitalize text-purple-600 dark:text-purple-400 font-semibold">{info.category}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-3 rounded-xl bg-white dark:bg-[#1A2027] border border-slate-200/80 dark:border-[#252B32] text-[12px] text-[#64748B] dark:text-slate-400">
                  Broadcast primarily within primary discovery channel
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Temporal Narrative Lineage (Milestone 6E) */}
      <section className="p-6 md:p-8 rounded-[24px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-dashboard space-y-6 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#252B32] pb-4">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-[#2F65F6] dark:text-[#5878C7]" />
            <div>
              <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100">
                Temporal Narrative Lineage
              </h3>
              <p className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-0.5">
                Cross-snapshot lineage continuity, observed volume trajectories, and transition history
              </p>
            </div>
          </div>

          {lineageDetail && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#1D232A] px-2.5 py-1 rounded-full font-semibold border border-slate-200/60 dark:border-[#2B323A]">
                {lineageDetail.lineage.lineage_id}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider ${
                  lineageDetail.lineage.state === 'new'
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50'
                    : lineageDetail.lineage.state === 'persisting'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                    : lineageDetail.lineage.state === 'weakening'
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50'
                    : lineageDetail.lineage.state === 'reappeared'
                    ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {lineageDetail.lineage.state}
              </span>
            </div>
          )}
        </div>

        {lineageDetail ? (
          <div className="space-y-6">
            {/* Metric Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/70 dark:border-[#252B32]">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Snapshot Span</div>
                <div className="text-[20px] font-bold text-[#111727] dark:text-slate-100 font-mono mt-1">
                  {lineageDetail.lineage.snapshot_count} snapshot{lineageDetail.lineage.snapshot_count !== 1 ? 's' : ''}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Consecutive: {lineageDetail.lineage.consecutive_snapshot_count}
                </p>
              </div>

              <div className="p-4 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/70 dark:border-[#252B32]">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Observed Message Trend</div>
                <div className="text-[20px] font-bold text-[#111727] dark:text-slate-100 font-mono mt-1">
                  {lineageDetail.lineage.message_count_current.toLocaleString()} msgs
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {lineageDetail.lineage.message_count_previous !== null
                    ? `Previous: ${lineageDetail.lineage.message_count_previous.toLocaleString()} msgs`
                    : 'Initial observation'}
                </p>
              </div>

              <div className="p-4 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/70 dark:border-[#252B32]">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">First Observed Snapshot</div>
                <div className="text-[13px] font-bold text-[#111727] dark:text-slate-100 font-mono truncate mt-1">
                  {lineageDetail.lineage.first_snapshot_id}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                  {new Date(lineageDetail.lineage.first_seen_at).toLocaleDateString()}
                </p>
              </div>

              <div className="p-4 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/70 dark:border-[#252B32]">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lineage Match Score</div>
                <div className="text-[20px] font-bold text-[#111727] dark:text-slate-100 font-mono mt-1">
                  {lineageDetail.lineage.lineage_match_score !== null
                    ? formatDecimal(lineageDetail.lineage.lineage_match_score, 3)
                    : 'Initial (1.000)'}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Similarity across snapshot boundary
                </p>
              </div>
            </div>

            {/* Transition Event Timeline */}
            {lineageDetail.events && lineageDetail.events.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="text-[11px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <GitCommit className="w-3.5 h-3.5 text-slate-400" />
                  <span>Lineage Transition Events ({lineageDetail.events.length})</span>
                </div>
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="space-y-2.5"
                >
                  {lineageDetail.events.map((ev, i) => (
                    <motion.div
                      key={ev.event_id || i}
                      variants={listItemEnter}
                      className="p-3.5 rounded-[16px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/80 dark:border-[#252B32] flex items-start justify-between gap-4 text-[12px]"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold uppercase text-slate-700 dark:text-slate-300 bg-white dark:bg-[#1A2027] border border-slate-200 dark:border-[#2B323A] px-2 py-0.5 rounded-full">
                            {ev.event_type}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            Snapshot: {ev.snapshot_id}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 font-sans leading-relaxed">{ev.explanation}</p>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 rounded-[18px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/60 dark:border-[#252B32] text-center space-y-1 text-slate-500 dark:text-slate-400 text-[13px]">
            <p>No active temporal lineage linked to narrative ID <span className="font-mono font-semibold text-[#111727] dark:text-slate-200">{narrative.narrative_id}</span>.</p>
            <p className="text-[11px] text-slate-400">
              Run <span className="font-mono">python backend/scripts/update_temporal_lineage.py</span> to track cross-snapshot continuity.
            </p>
          </div>
        )}
      </section>

      {/* 6. Representative Centroid Messages / Evidence Excerpts */}
      <section className="p-6 md:p-8 rounded-[24px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-dashboard space-y-4 transition-all">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252B32] pb-4">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-[#2F65F6] dark:text-[#5878C7]" />
            <div>
              <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100">
                Representative Centroid Messages & Excerpts
              </h3>
              <p className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-0.5">
                Backend-identified nearest-to-centroid observational posts for this candidate cluster
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/explorer?topicId=${narrative.promoted_from_topic_id}`)}
          >
            Explore in Corpus
          </Button>
        </div>

        {narrative.representative_message_excerpts && narrative.representative_message_excerpts.length > 0 ? (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-3 pt-2"
          >
            {narrative.representative_message_excerpts.map((excerpt: string, i: number) => (
              <motion.div
                key={i}
                variants={listItemEnter}
                className="p-5 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/80 dark:border-[#252B32] space-y-2 hover:bg-white dark:hover:bg-[#171C22] hover:shadow-xs transition-all"
              >
                <div className="text-[11px] font-mono text-[#8591A5] dark:text-slate-400">
                  CENTROID EXCERPT #{i + 1}
                </div>
                <p className="text-[14px] text-[#334155] dark:text-slate-200 leading-relaxed font-sans pt-1">
                  "{excerpt}"
                </p>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="p-8 rounded-[18px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/60 dark:border-[#252B32] text-center text-[13px] text-[#64748B] dark:text-slate-400">
            No centroid message excerpts recorded for this candidate.
          </div>
        )}
      </section>
    </div>
  );
};
