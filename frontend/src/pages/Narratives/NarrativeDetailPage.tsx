import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
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
  Send,
} from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { telemetryApi } from '../../services/telemetryApi';
import { NarrativeDetailData, TopicDetailData } from '../../types/api';
import { resolveChannelInfo } from '../../utils/channelRegistry';
import {
  formatPriorityTierBadge,
  formatEvidenceDensityBadge,
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

import { getNarrativeDisplayName, getNarrativeExplanation } from '../../utils/narrativeIdentity';
import { watchlistService } from '../../services/watchlistService';

export const NarrativeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [narrative, setNarrative] = useState<NarrativeDetailData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isWatching, setIsWatching] = useState(false);
  const [parentTrend, setParentTrend] = useState<TopicDetailData | null>(null);

  const trendFromState = (location.state as any)?.fromTrend;
  const trendFromQuery = searchParams.get('trend');
  const parentTrendTarget = trendFromState || trendFromQuery || narrative?.promoted_from_topic_id || '';
  const cleanParentTrendId = parentTrendTarget ? parentTrendTarget.replace(/^topic_|^trend_/, '') : '';

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setIsError(false);
    setErrorMessage('');

    telemetryApi
      .getNarrativeById(id)
      .then((res) => {
        setNarrative(res.data);
        const pTarget = trendFromState || trendFromQuery || res.data.promoted_from_topic_id;
        if (pTarget) {
          telemetryApi
            .getTrendById(pTarget)
            .then((trRes) => setParentTrend(trRes.data))
            .catch(() => {});
        }
      })
      .catch((err) => {
        console.error('Failed to load narrative detail:', err);
        setIsError(true);
        setErrorMessage(err.message || 'Narrative could not be retrieved from /api/v1/narratives/{id}.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (id) {
      setIsWatching(watchlistService.isWatched(id));
    }
  }, [id]);

  const handleToggleWatch = () => {
    if (!id || !narrative) return;
    const isNowWatched = watchlistService.toggleWatch({
      id,
      type: 'Narrative',
      title: displayName,
      currentStatus: `${(narrative.priority_signal_score * 100).toFixed(1)}% Priority`,
      lastChange: narrative.priority_tier.toUpperCase(),
      route: `/narratives/${id}`,
      addedAt: new Date().toISOString(),
    });
    setIsWatching(isNowWatched);
  };

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

  const displayName = getNarrativeDisplayName(narrative);
  const explanation = getNarrativeExplanation(narrative);

  return (
    <div className="space-y-6 sm:space-y-8 font-sans pb-10">
      {/* 1. Page Header */}
      <PageHeader
        title={displayName}
        description={`Authoritative 4G narrative dossier for ${narrative.narrative_id}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => {
                if (parentTrendTarget) {
                  navigate(`/trends/${parentTrendTarget}`);
                } else {
                  navigate('/narratives');
                }
              }}
            >
              {parentTrendTarget ? `Trend #${cleanParentTrendId}` : 'Narratives'}
            </Button>

            <Button
              variant={isWatching ? 'primary' : 'secondary'}
              size="sm"
              leftIcon={isWatching ? <Check className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              onClick={handleToggleWatch}
            >
              {isWatching ? 'Tracking' : 'Track Candidate'}
            </Button>
          </div>
        }
      />

      {/* Narrative Identity & Evidence-Grounded Explanation */}
      <div className="p-6 sm:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-3 py-1 rounded-full border border-rose-200/70 dark:border-rose-900/50 uppercase">
              {narrative.narrative_id.toUpperCase()}
            </span>
            {narrative.is_dominant ? (
              <span className="text-[11px] font-bold px-3 py-1 rounded-full border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40 uppercase font-mono">
                Dominant Viewpoint
              </span>
            ) : narrative.is_dominant === false ? (
              <span className="text-[11px] font-bold px-3 py-1 rounded-full border bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/40 uppercase font-mono">
                Alternative Perspective
              </span>
            ) : null}
            {parentTrendTarget && (
              <button
                type="button"
                onClick={() => navigate(`/trends/${parentTrendTarget}`)}
                className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#2F65F6] dark:text-[#93C5FD] bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-1 rounded-full border border-blue-200/70 dark:border-blue-900/40 transition-colors cursor-pointer"
                title={`Inspect Parent Trend #${cleanParentTrendId}`}
              >
                <Radio className="w-3 h-3 text-[#2F65F6] dark:text-[#93C5FD]" />
                <span>Parent Trend #{cleanParentTrendId}{parentTrend?.trend_name ? ` • ${parentTrend.trend_name}` : ''}</span>
              </button>
            )}
          </div>
          <span className="text-[11px] font-mono text-[#8591A5] dark:text-slate-400">
            Synthesized from {narrative.data_coverage.message_count.toLocaleString()} messages across {narrative.data_coverage.channel_count} discovery channels
          </span>
        </div>

        <div>
          <h2 className="text-[22px] sm:text-[26px] font-bold text-[#111727] dark:text-slate-100 tracking-tight leading-snug">
            {displayName}
          </h2>
          <div className="text-[12px] font-mono text-[#8591A5] dark:text-slate-400 mt-1">
            Claim Framing: <span className="text-slate-700 dark:text-slate-300">{narrative.headline_claim}</span>
          </div>
        </div>

        <div className="p-5 sm:p-6 rounded-[22px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] space-y-2">
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2F65F6] dark:text-[#5878C7] flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            <span>What this narrative represents</span>
          </div>
          <p className="text-[13px] sm:text-[14px] text-[#334155] dark:text-slate-300 leading-relaxed font-sans">
            {explanation}
          </p>
        </div>

        {narrative.sibling_narrative_ids && narrative.sibling_narrative_ids.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-[#252B32] flex items-center gap-2 flex-wrap text-[12px]">
            <span className="text-[#8591A5] dark:text-slate-400 font-medium">Alternative Perspectives for this Trend:</span>
            {narrative.sibling_narrative_ids.map((sibId) => (
              <button
                key={sibId}
                type="button"
                onClick={() => navigate(`/narratives/${sibId}?trend=${encodeURIComponent(parentTrendTarget)}`)}
                className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#111727] dark:text-white bg-[#F5F1E5] dark:bg-[#1E2229] hover:border-amber-400 dark:hover:border-amber-500/50 px-3 py-1 rounded-full border border-[#E5DFD3] dark:border-[#2D333F] transition-all cursor-pointer shadow-xs"
              >
                <span>{sibId.toUpperCase()}</span>
                <ArrowUpRight className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Metadata Pill Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 rounded-full border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md text-[13px] font-sans text-[#64748B] dark:text-slate-400 shadow-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[#111727] dark:text-slate-200 uppercase font-bold text-[11px] font-mono bg-[#EEF1F8] dark:bg-[#12161C] px-3 py-1 rounded-full border border-slate-200/60 dark:border-[#2B323A]">
            {narrative.narrative_id}
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span
            className={`text-[11px] font-bold px-3 py-1 rounded-full border ${tierBadge.bg} ${tierBadge.text} ${tierBadge.border}`}
          >
            {tierBadge.label} Priority
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span
            className={`text-[11px] font-semibold px-3 py-1 rounded-full ${densityBadge.bg} ${densityBadge.text}`}
            title={EVIDENCE_DENSITY_WORDING.tooltip}
          >
            {densityBadge.label} Coverage
          </span>
          {narrative.is_cross_source && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/50 px-3 py-1 rounded-full">
                Cross-Source ({narrative.distinct_sources_count || 2} channels)
              </span>
            </>
          )}
          {narrative.is_cross_domain && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-[11px] font-semibold text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 px-3 py-1 rounded-full">
                Cross-Domain ({narrative.distinct_domains_count || 2} domains)
              </span>
            </>
          )}
          {narrative.quality_classification && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#1D232A] border border-slate-200 dark:border-[#2B323A] px-3 py-1 rounded-full uppercase tracking-wider">
                {narrative.quality_classification.replace(/_/g, ' ')}
              </span>
            </>
          )}
          {parentTrendTarget && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <button
                type="button"
                onClick={() => navigate(`/trends/${parentTrendTarget}`)}
                className="inline-flex items-center gap-1 font-semibold text-[#2F65F6] dark:text-[#93C5FD] hover:underline cursor-pointer"
              >
                <Radio className="w-3 h-3" />
                <span>Parent Trend #{cleanParentTrendId}{parentTrend?.trend_name ? ` (${parentTrend.trend_name})` : ''}</span>
              </button>
            </>
          )}
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
      <section className="p-6 md:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-6 transition-all">
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

          <div className="p-5 rounded-[24px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/80 dark:border-[#282F3A] text-right shrink-0 shadow-xs">
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
            <div className="p-5 sm:p-6 rounded-[22px] bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 space-y-2 transition-all hover:scale-[1.01]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Spread Score</span>
                <span className="text-[10px] font-mono text-blue-600/80 dark:text-blue-400">Weight: 30%</span>
              </div>
              <div className="font-mono text-[26px] font-extrabold text-[#111727] dark:text-slate-100 leading-tight">
                <AnimatedNumber value={narrative.sub_scores.spread_score} decimals={3} />
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">
                Multi-channel dissemination and cross-source diffusion rate.
              </p>
            </div>

            {/* Coordination Dimension */}
            <div className="p-5 sm:p-6 rounded-[22px] bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-2 transition-all hover:scale-[1.01]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">Coordination Score</span>
                <span className="text-[10px] font-mono text-amber-600/80 dark:text-amber-400">Weight: 30%</span>
              </div>
              <div className="font-mono text-[26px] font-extrabold text-[#111727] dark:text-slate-100 leading-tight">
                <AnimatedNumber value={narrative.sub_scores.coordination_score} decimals={3} />
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">
                {COORDINATION_WORDING.tooltip}
              </p>
            </div>

            {/* Observed Reach Dimension */}
            <div className="p-5 sm:p-6 rounded-[22px] bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 space-y-2 transition-all hover:scale-[1.01]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  {REACH_WORDING.primary}
                </span>
                <span className="text-[10px] font-mono text-emerald-600/80 dark:text-emerald-400">Weight: 20%</span>
              </div>
              <div className="font-mono text-[26px] font-extrabold text-[#111727] dark:text-slate-100 leading-tight">
                <AnimatedNumber value={narrative.sub_scores.reach_score} decimals={3} />
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">
                {REACH_WORDING.tooltip}
              </p>
            </div>

            {/* Friction Dimension */}
            <div className="p-5 sm:p-6 rounded-[22px] bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 space-y-2 transition-all hover:scale-[1.01]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">Friction Score</span>
                <span className="text-[10px] font-mono text-purple-600/80 dark:text-purple-400">Weight: 20%</span>
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
          <div className="p-5 rounded-[24px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/80 dark:border-[#282F3A] flex flex-col items-center justify-center">
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
        <div className="p-4.5 rounded-[20px] bg-blue-50/50 dark:bg-blue-950/25 border border-blue-200/60 dark:border-blue-900/40 flex items-start gap-3 text-[12px] text-blue-900 dark:text-blue-200">
          <Info className="w-4 h-4 text-[#2F65F6] dark:text-[#5878C7] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Operational Semantic Protocol:</strong> Priority Signal Score reflects statistical surveillance prioritization. It is not an assessment of malicious intent, threat level, or misinformation ground truth.
          </div>
        </div>
      </section>

      {/* 3. Potential Coordination Signals & Observational Data Coverage */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coordination Indicators (Signal wording only) */}
        <div className="p-6 md:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-4 transition-all">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252B32] pb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h4 className="text-[16px] font-bold text-[#111727] dark:text-slate-100">
                {COORDINATION_WORDING.plural}
              </h4>
            </div>
            <span className="text-[11px] font-mono text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-3 py-1 rounded-full font-semibold">
              Anomaly Indicators
            </span>
          </div>

          <p className="text-[12px] text-[#64748B] dark:text-slate-400 leading-relaxed">
            {COORDINATION_WORDING.disclaimer}
          </p>

          <div className="space-y-2.5 pt-1">
            <div
              className={`p-3.5 rounded-[18px] border flex items-center justify-between text-[13px] transition-all ${
                narrative.coordination_signals.potential_syndication_spike
                  ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/90 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 font-medium'
                  : 'bg-[#FAFBFD] dark:bg-[#12161C] border-slate-200/70 dark:border-[#282F3A] text-[#64748B] dark:text-slate-400'
              }`}
            >
              <span>Potential Syndication Spike (&gt;25% uncredited duplicate content)</span>
              <span className={`font-semibold text-[11px] px-3 py-1 rounded-full ${narrative.coordination_signals.potential_syndication_spike ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {narrative.coordination_signals.potential_syndication_spike ? 'Signal Flagged' : 'Baseline'}
              </span>
            </div>

            <div
              className={`p-3.5 rounded-[18px] border flex items-center justify-between text-[13px] transition-all ${
                narrative.coordination_signals.potential_temporal_burst
                  ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/90 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 font-medium'
                  : 'bg-[#FAFBFD] dark:bg-[#12161C] border-slate-200/70 dark:border-[#282F3A] text-[#64748B] dark:text-slate-400'
              }`}
            >
              <span>Potential Temporal Burst (burstiness index &gt; +0.20)</span>
              <span className={`font-semibold text-[11px] px-3 py-1 rounded-full ${narrative.coordination_signals.potential_temporal_burst ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {narrative.coordination_signals.potential_temporal_burst ? 'Signal Flagged' : 'Baseline'}
              </span>
            </div>

            <div
              className={`p-3.5 rounded-[18px] border flex items-center justify-between text-[13px] transition-all ${
                narrative.coordination_signals.potential_rapid_channel_entry
                  ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/90 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 font-medium'
                  : 'bg-[#FAFBFD] dark:bg-[#12161C] border-slate-200/70 dark:border-[#282F3A] text-[#64748B] dark:text-slate-400'
              }`}
            >
              <span>Potential Rapid Channel Entry (&gt;10 channels/hr velocity)</span>
              <span className={`font-semibold text-[11px] px-3 py-1 rounded-full ${narrative.coordination_signals.potential_rapid_channel_entry ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {narrative.coordination_signals.potential_rapid_channel_entry ? 'Signal Flagged' : 'Baseline'}
              </span>
            </div>

            <div
              className={`p-3.5 rounded-[18px] border flex items-center justify-between text-[13px] transition-all ${
                narrative.coordination_signals.potential_cross_channel_cascade
                  ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/90 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 font-medium'
                  : 'bg-[#FAFBFD] dark:bg-[#12161C] border-slate-200/70 dark:border-[#282F3A] text-[#64748B] dark:text-slate-400'
              }`}
            >
              <span>Potential Cross-Channel Cascade (≥2 distinct broadcasting feeds)</span>
              <span className={`font-semibold text-[11px] px-3 py-1 rounded-full ${narrative.coordination_signals.potential_cross_channel_cascade ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {narrative.coordination_signals.potential_cross_channel_cascade ? 'Signal Flagged' : 'Baseline'}
              </span>
            </div>
          </div>
        </div>

        {/* Evidence Density & Sentiment Profiling */}
        <div className="p-6 md:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-4 transition-all">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252B32] pb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-[16px] font-bold text-[#111727] dark:text-slate-100">
                Observational Data Coverage
              </h4>
            </div>
            <span
              className={`text-[11px] font-bold px-3 py-1 rounded-full ${densityBadge.bg} ${densityBadge.text}`}
            >
              {densityBadge.label} Density
            </span>
          </div>

          <div className="p-4.5 rounded-[20px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] space-y-2">
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
                <span className="font-mono text-[11px] text-blue-700 dark:text-[#93C5FD] bg-blue-50 dark:bg-blue-950/40 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-900/40 font-semibold">
                  Evaluated ({narrative.sentiment_profile.total_text_messages_evaluated.toLocaleString()} msgs)
                </span>
              ) : (
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#1D232A] px-3 py-1 rounded-full font-semibold border border-slate-200/60 dark:border-[#2B323A]">
                  Unavailable / Uncomputed
                </span>
              )}
            </div>

            {narrative.sentiment_profile.is_available ? (
              <div className="p-4.5 rounded-[20px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/80 dark:border-[#282F3A] space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center text-[12px]">
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-[14px] border border-emerald-100 dark:border-emerald-900/40">
                    <div className="text-emerald-800 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wider">Pos</div>
                    <div className="font-bold text-emerald-900 dark:text-emerald-200 font-mono mt-0.5">{formatPercent(narrative.sentiment_profile.text_positive_ratio)}</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#1D232A] p-3 rounded-[14px] border border-slate-200 dark:border-[#2B323A]">
                    <div className="text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider">Neu</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 font-mono mt-0.5">{formatPercent(narrative.sentiment_profile.text_neutral_ratio)}</div>
                  </div>
                  <div className="bg-rose-50 dark:bg-rose-950/30 p-3 rounded-[14px] border border-rose-100 dark:border-rose-900/40">
                    <div className="text-rose-800 dark:text-rose-300 text-[10px] font-bold uppercase tracking-wider">Neg</div>
                    <div className="font-bold text-rose-900 dark:text-rose-200 font-mono mt-0.5">{formatPercent(narrative.sentiment_profile.text_negative_ratio)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4.5 rounded-[20px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] text-center space-y-1">
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
        <div className="p-6 md:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-4 transition-all">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#2F65F6] dark:text-[#5878C7]" />
            <h4 className="text-[15px] font-bold text-[#111727] dark:text-slate-100">Extracted Entities & Framing</h4>
          </div>
          {narrative.key_entities && narrative.key_entities.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {narrative.key_entities.map((entity, i) => (
                <span
                  key={i}
                  className="px-3.5 py-1.5 rounded-full bg-[#FAFBFD] dark:bg-[#151921] text-[#111727] dark:text-slate-200 text-[12px] font-mono font-medium border border-slate-200/80 dark:border-[#282F3A] shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
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
        <div className="p-6 md:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-4 transition-all">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[#2F65F6] dark:text-[#5878C7]" />
            <h4 className="text-[15px] font-bold text-[#111727] dark:text-slate-100">Broadcasting Channels & Feeds</h4>
          </div>
          {narrative.broadcasting_channels && narrative.broadcasting_channels.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {narrative.broadcasting_channels.map((ch, i) => (
                <span
                  key={i}
                  className="px-3.5 py-1.5 rounded-full bg-blue-50/60 dark:bg-blue-950/30 text-[#2F65F6] dark:text-[#93C5FD] text-[12px] font-mono font-semibold border border-blue-200/60 dark:border-blue-900/40 shadow-2xs"
                >
                  {ch}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#8591A5] dark:text-slate-400">Channel distribution not available in summary.</p>
          )}

          {narrative.domains_represented && narrative.domains_represented.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-[#252B32] space-y-2">
              <div className="text-[11px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">
                Strategic Domains Represented
              </div>
              <div className="flex flex-wrap gap-1.5">
                {narrative.domains_represented.map((dom, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full bg-purple-50/60 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-900/40 text-[11px] font-mono font-semibold"
                  >
                    {dom}
                  </span>
                ))}
              </div>
            </div>
          )}

          {narrative.validation_notes && narrative.validation_notes.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-[#252B32] space-y-1.5">
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
      <section className="p-6 md:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-6 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#252B32] pb-4">
          <div className="flex items-center gap-2.5">
            <Share2 className="w-5 h-5 text-[#2F65F6] dark:text-[#5878C7]" />
            <div>
              <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100">
                Diffusion Footprint & Source Network
              </h3>
              <p className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-0.5">
                Observed discovery channels, semantic trend genesis, and secondary broadcast networks.
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
          <div className="p-5 rounded-[24px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                Origin Broadcasts
              </span>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
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
                      className="p-3 rounded-[16px] bg-white dark:bg-[#181C22] border border-slate-200/80 dark:border-[#2B323D] shadow-xs"
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
                <div className="p-3 rounded-[16px] bg-white dark:bg-[#181C22] border border-slate-200/80 dark:border-[#2B323D] text-[12px] text-[#64748B] dark:text-slate-400">
                  {narrative.domains_represented && narrative.domains_represented.length > 0
                    ? narrative.domains_represented.map((d) => `Domain: ${d}`).join(', ')
                    : 'Discovered in cross-platform stream'}
                </div>
              )}
            </div>
          </div>

          {/* 2. Semantic Cluster Genesis */}
          <div className="p-5 rounded-[24px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2F65F6] dark:text-[#5878C7] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Parent Trend
              </span>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#2F65F6] dark:text-[#93C5FD] border border-blue-200 dark:border-blue-900/50">
                TREND #{cleanParentTrendId || narrative.promoted_from_topic_id.replace(/^topic_|^trend_/, '')}
              </span>
            </div>

            <div className="p-3 rounded-[16px] bg-white dark:bg-[#181C22] border border-slate-200/80 dark:border-[#2B323D] shadow-xs space-y-1.5">
              <div className="text-[13px] font-bold text-[#111727] dark:text-slate-100">
                {parentTrend?.trend_name || `Synthesized Trend #${cleanParentTrendId || narrative.promoted_from_topic_id.replace(/^topic_|^trend_/, '')}`}
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 line-clamp-2">
                {parentTrend?.trend_summary || `Evaluated from ${narrative.data_coverage.message_count} messages across ${narrative.data_coverage.channel_count} discovery channels.`}
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {(narrative.key_entities || []).slice(0, 3).map((e) => (
                  <span
                    key={e}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/40"
                  >
                    {e.replace(/^(domain:|hashtag:|gazetteer_geo:)/, '')}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Amplification & Broadcaster Network */}
          <div className="p-5 rounded-[24px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" />
                Broadcasters
              </span>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50">
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
                      className="p-3 rounded-[16px] bg-white dark:bg-[#181C22] border border-slate-200/80 dark:border-[#2B323D] shadow-xs"
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
                <div className="p-3 rounded-[16px] bg-white dark:bg-[#181C22] border border-slate-200/80 dark:border-[#2B323D] text-[12px] text-[#64748B] dark:text-slate-400">
                  Broadcast primarily within primary discovery channel
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Representative Centroid Messages / Evidence Excerpts */}
      <section className="p-6 md:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-5 transition-all">
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
            className="space-y-3 pt-1"
          >
            {narrative.representative_message_excerpts.map((excerpt: string, i: number) => (
              <motion.div
                key={i}
                variants={listItemEnter}
                className="p-5 sm:p-6 rounded-[22px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] space-y-2 hover:bg-white dark:hover:bg-[#181C22] hover:border-amber-400/60 dark:hover:border-amber-500/40 hover:shadow-xs transition-all"
              >
                <div className="text-[11px] font-mono text-amber-700 dark:text-amber-400 font-bold">
                  CENTROID EXCERPT #{i + 1}
                </div>
                <p className="text-[14px] text-[#334155] dark:text-slate-200 leading-relaxed font-sans pt-0.5">
                  "{excerpt}"
                </p>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="p-8 rounded-[20px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/60 dark:border-[#252B32] text-center text-[13px] text-[#64748B] dark:text-slate-400">
            No centroid message excerpts recorded for this candidate.
          </div>
        )}
      </section>
    </div>
  );
};
