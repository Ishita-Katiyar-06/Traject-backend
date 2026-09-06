import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
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
} from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { telemetryApi } from '../../services/telemetryApi';
import { NarrativeDetailData } from '../../types/api';
import {
  formatPriorityTierBadge,
  formatEvidenceDensityBadge,
  formatDecimal,
  formatPercent,
  COORDINATION_WORDING,
  REACH_WORDING,
  EVIDENCE_DENSITY_WORDING,
} from '../../utils/telemetryFormatters';

export const NarrativeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [narrative, setNarrative] = useState<NarrativeDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
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
  }, [id]);

  if (isLoading) {
    return (
      <div className="py-20 text-center font-sans space-y-3">
        <div className="w-8 h-8 border-3 border-[#2F65F6] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[14px] text-[#64748B]">Querying narrative telemetry record...</p>
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
        <div className="p-8 rounded-[24px] bg-rose-50 border border-rose-200 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h3 className="text-[16px] font-bold text-rose-900">
            {narrative ? 'Failed to Load Details' : 'Narrative Record Not Found'}
          </h3>
          <p className="text-[13px] text-rose-700 max-w-md mx-auto">
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
    <div className="space-y-8 font-sans">
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 rounded-[22px] border border-[rgba(228,233,245,0.85)] bg-white text-[13px] font-sans text-[#64748B] shadow-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[#111727] uppercase font-bold text-[11px] font-mono bg-[#EEF1F8] px-2.5 py-0.5 rounded-full">
            {narrative.narrative_id}
          </span>
          <span className="text-slate-300">•</span>
          <span
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${tierBadge.bg} ${tierBadge.text} ${tierBadge.border}`}
          >
            {tierBadge.label} Priority
          </span>
          <span className="text-slate-300">•</span>
          <span
            className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${densityBadge.bg} ${densityBadge.text}`}
            title={EVIDENCE_DENSITY_WORDING.tooltip}
          >
            {densityBadge.label} Coverage
          </span>
          <span className="text-slate-300">•</span>
          <button
            type="button"
            onClick={() => navigate(`/topics/${narrative.promoted_from_topic_id}`)}
            className="inline-flex items-center gap-1 font-semibold text-[#2F65F6] hover:underline"
          >
            <Radio className="w-3 h-3" />
            <span>Parent Topic #{narrative.promoted_from_topic_id}</span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-[12px]">
          <span className="inline-flex items-center gap-1 text-[#475569]">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span><strong className="text-[#111727]">{narrative.data_coverage.message_count}</strong> messages</span>
          </span>
          {narrative.first_observed_at && (
            <>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1 font-mono text-[#64748B]">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>First: {new Date(narrative.first_observed_at).toLocaleDateString()}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2. Primary 4G Composite Scoring Breakdown */}
      <section className="p-6 md:p-8 rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white shadow-dashboard space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="text-[11px] font-bold text-[#8591A5] uppercase tracking-wider">
              Frozen 4G Composite Index
            </div>
            <h3 className="text-[20px] font-bold text-[#111727] mt-0.5">
              Priority Signal Score
            </h3>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              Strictly backend-calculated ranking signal (Spread 30%, Coordination 30%, Observed Reach 20%, Friction 20%).
            </p>
          </div>

          <div className="p-4 rounded-[20px] bg-[#F8FAFD] border border-slate-200/80 text-right shrink-0">
            <div className="text-[10px] font-bold text-[#8591A5] uppercase">
              Composite Value
            </div>
            <div className="font-mono text-[36px] font-black text-[#111727] tracking-tight leading-none mt-1">
              {formatDecimal(narrative.priority_signal_score, 3)}
            </div>
          </div>
        </div>

        {/* 4 Dimension Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Spread Dimension */}
          <div className="p-5 rounded-[22px] bg-slate-50 border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase">Spread Score</span>
              <span className="text-[10px] font-mono text-slate-400">Weight: 30%</span>
            </div>
            <div className="font-mono text-[26px] font-extrabold text-[#111727]">
              {formatDecimal(narrative.sub_scores.spread_score, 3)}
            </div>
            <p className="text-[11px] text-[#64748B]">
              Multi-channel dissemination and cross-source diffusion rate.
            </p>
          </div>

          {/* Coordination Dimension */}
          <div className="p-5 rounded-[22px] bg-slate-50 border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase">Coordination Score</span>
              <span className="text-[10px] font-mono text-slate-400">Weight: 30%</span>
            </div>
            <div className="font-mono text-[26px] font-extrabold text-[#111727]">
              {formatDecimal(narrative.sub_scores.coordination_score, 3)}
            </div>
            <p className="text-[11px] text-[#64748B]">
              {COORDINATION_WORDING.tooltip}
            </p>
          </div>

          {/* Observed Reach Dimension */}
          <div className="p-5 rounded-[22px] bg-slate-50 border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase">
                {REACH_WORDING.primary}
              </span>
              <span className="text-[10px] font-mono text-slate-400">Weight: 20%</span>
            </div>
            <div className="font-mono text-[26px] font-extrabold text-[#111727]">
              {formatDecimal(narrative.sub_scores.reach_score, 3)}
            </div>
            <p className="text-[11px] text-[#64748B]">
              {REACH_WORDING.tooltip}
            </p>
          </div>

          {/* Friction Dimension */}
          <div className="p-5 rounded-[22px] bg-slate-50 border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase">Friction Score</span>
              <span className="text-[10px] font-mono text-slate-400">Weight: 20%</span>
            </div>
            <div className="font-mono text-[26px] font-extrabold text-[#111727]">
              {formatDecimal(narrative.sub_scores.friction_score, 3)}
            </div>
            <p className="text-[11px] text-[#64748B]">
              Counter-claims, disputations, or platform content moderation friction.
            </p>
          </div>
        </div>

        {/* Semantic Guardrail Disclaimer Note */}
        <div className="p-4 rounded-[18px] bg-blue-50/60 border border-blue-100 flex items-start gap-3 text-[12px] text-blue-900">
          <Info className="w-4 h-4 text-[#2F65F6] shrink-0 mt-0.5" />
          <div>
            <strong>Operational Semantic Protocol:</strong> Priority Signal Score reflects statistical surveillance prioritization. It is not an assessment of malicious intent, threat level, or misinformation ground truth.
          </div>
        </div>
      </section>

      {/* 3. Potential Coordination Signals & Observational Data Coverage */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coordination Indicators (Signal wording only) */}
        <div className="p-6 md:p-7 rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white shadow-dashboard space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-600" />
              <h4 className="text-[16px] font-bold text-[#111727]">
                {COORDINATION_WORDING.plural}
              </h4>
            </div>
            <span className="text-[11px] font-mono text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-semibold">
              Anomaly Indicators
            </span>
          </div>

          <p className="text-[12px] text-[#64748B] leading-relaxed">
            {COORDINATION_WORDING.disclaimer}
          </p>

          <div className="space-y-2.5 pt-2">
            <div
              className={`p-3.5 rounded-[16px] border flex items-center justify-between text-[13px] ${
                narrative.coordination_signals.potential_syndication_spike
                  ? 'bg-amber-50/60 border-amber-200/80 text-amber-900 font-medium'
                  : 'bg-slate-50 border-slate-200/60 text-[#64748B]'
              }`}
            >
              <span>Potential Syndication Spike (&gt;25% uncredited duplicate content)</span>
              <span className={`font-semibold text-[11px] px-2 py-0.5 rounded-full ${narrative.coordination_signals.potential_syndication_spike ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700'}`}>
                {narrative.coordination_signals.potential_syndication_spike ? 'Signal Flagged' : 'Baseline'}
              </span>
            </div>

            <div
              className={`p-3.5 rounded-[16px] border flex items-center justify-between text-[13px] ${
                narrative.coordination_signals.potential_temporal_burst
                  ? 'bg-amber-50/60 border-amber-200/80 text-amber-900 font-medium'
                  : 'bg-slate-50 border-slate-200/60 text-[#64748B]'
              }`}
            >
              <span>Potential Temporal Burst (burstiness index &gt; +0.20)</span>
              <span className={`font-semibold text-[11px] px-2 py-0.5 rounded-full ${narrative.coordination_signals.potential_temporal_burst ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700'}`}>
                {narrative.coordination_signals.potential_temporal_burst ? 'Signal Flagged' : 'Baseline'}
              </span>
            </div>

            <div
              className={`p-3.5 rounded-[16px] border flex items-center justify-between text-[13px] ${
                narrative.coordination_signals.potential_rapid_channel_entry
                  ? 'bg-amber-50/60 border-amber-200/80 text-amber-900 font-medium'
                  : 'bg-slate-50 border-slate-200/60 text-[#64748B]'
              }`}
            >
              <span>Potential Rapid Channel Entry (&gt;10 channels/hr velocity)</span>
              <span className={`font-semibold text-[11px] px-2 py-0.5 rounded-full ${narrative.coordination_signals.potential_rapid_channel_entry ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700'}`}>
                {narrative.coordination_signals.potential_rapid_channel_entry ? 'Signal Flagged' : 'Baseline'}
              </span>
            </div>

            <div
              className={`p-3.5 rounded-[16px] border flex items-center justify-between text-[13px] ${
                narrative.coordination_signals.potential_cross_channel_cascade
                  ? 'bg-amber-50/60 border-amber-200/80 text-amber-900 font-medium'
                  : 'bg-slate-50 border-slate-200/60 text-[#64748B]'
              }`}
            >
              <span>Potential Cross-Channel Cascade (≥2 distinct broadcasting feeds)</span>
              <span className={`font-semibold text-[11px] px-2 py-0.5 rounded-full ${narrative.coordination_signals.potential_cross_channel_cascade ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700'}`}>
                {narrative.coordination_signals.potential_cross_channel_cascade ? 'Signal Flagged' : 'Baseline'}
              </span>
            </div>
          </div>
        </div>

        {/* Evidence Density & Sentiment Profiling */}
        <div className="p-6 md:p-7 rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white shadow-dashboard space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              <h4 className="text-[16px] font-bold text-[#111727]">
                Observational Data Coverage
              </h4>
            </div>
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${densityBadge.bg} ${densityBadge.text}`}
            >
              {densityBadge.label} Density
            </span>
          </div>

          <div className="p-4 rounded-[18px] bg-slate-50 border border-slate-200/60 space-y-2">
            <div className="text-[11px] font-bold text-[#8591A5] uppercase">
              Data Coverage Summary
            </div>
            <div className="text-[14px] font-bold text-[#111727]">
              {narrative.data_coverage.evidence_density.toUpperCase()} Coverage Tier
            </div>
            <div className="text-[12px] text-[#64748B] space-y-1">
              <div>Channels observed: <strong className="text-[#111727]">{narrative.data_coverage.channel_count}</strong></div>
              <div>Duration: <strong className="text-[#111727]">{(narrative.data_coverage.timespan_seconds / 3600).toFixed(1)} hours</strong></div>
              <div>Views data coverage: <strong className="text-[#111727]">{narrative.data_coverage.has_views_coverage ? 'Present' : 'Sparse'}</strong></div>
            </div>
          </div>

          {/* Sentiment Profile */}
          <div className="pt-2">
            <div className="text-[12px] font-bold text-[#111727] mb-2 flex items-center justify-between">
              <span>Sentiment Profile</span>
              {narrative.sentiment_profile.is_available ? (
                <span className="font-mono text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                  Evaluated ({narrative.sentiment_profile.total_text_messages_evaluated} msgs)
                </span>
              ) : (
                <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Unavailable / Uncomputed
                </span>
              )}
            </div>

            {narrative.sentiment_profile.is_available ? (
              <div className="p-4 rounded-[18px] bg-[#F8FAFD] border border-slate-200/80 space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center text-[12px]">
                  <div className="bg-emerald-50 p-2 rounded-[12px] border border-emerald-100">
                    <div className="text-emerald-800 text-[10px] font-bold uppercase">Pos</div>
                    <div className="font-bold text-emerald-900 mt-0.5">{formatPercent(narrative.sentiment_profile.text_positive_ratio)}</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-[12px] border border-slate-200">
                    <div className="text-slate-700 text-[10px] font-bold uppercase">Neu</div>
                    <div className="font-bold text-slate-800 mt-0.5">{formatPercent(narrative.sentiment_profile.text_neutral_ratio)}</div>
                  </div>
                  <div className="bg-rose-50 p-2 rounded-[12px] border border-rose-100">
                    <div className="text-rose-800 text-[10px] font-bold uppercase">Neg</div>
                    <div className="font-bold text-rose-900 mt-0.5">{formatPercent(narrative.sentiment_profile.text_negative_ratio)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-[18px] bg-slate-50 border border-slate-200/60 text-center space-y-1">
                <p className="text-[12px] text-[#64748B]">
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
        <div className="p-6 rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white shadow-dashboard space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#2F65F6]" />
            <h4 className="text-[15px] font-bold text-[#111727]">Extracted Entities & Framing</h4>
          </div>
          {narrative.key_entities && narrative.key_entities.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-2">
              {narrative.key_entities.map((entity, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full bg-slate-100 text-[#111727] text-[12px] font-medium border border-slate-200"
                >
                  {entity}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#8591A5]">No entities extracted for this candidate cluster.</p>
          )}
        </div>

        {/* Monitored Channels */}
        <div className="p-6 rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white shadow-dashboard space-y-3">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[#2F65F6]" />
            <h4 className="text-[15px] font-bold text-[#111727]">Broadcasting Channels & Feeds</h4>
          </div>
          {narrative.broadcasting_channels && narrative.broadcasting_channels.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-2">
              {narrative.broadcasting_channels.map((ch, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full bg-blue-50 text-[#2F65F6] text-[12px] font-mono font-medium border border-blue-100"
                >
                  {ch}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#8591A5]">Channel distribution not available in summary.</p>
          )}
        </div>
      </section>

      {/* 5. Representative Centroid Messages / Evidence Excerpts */}
      <section className="p-6 md:p-8 rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white shadow-dashboard space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-[#2F65F6]" />
            <div>
              <h3 className="text-[17px] font-bold text-[#111727]">
                Representative Centroid Messages & Excerpts
              </h3>
              <p className="text-[12px] text-[#8591A5]">
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
          <div className="space-y-3 pt-2">
            {narrative.representative_message_excerpts.map((excerpt: string, i: number) => (
              <div
                key={i}
                className="p-5 rounded-[20px] bg-[#F8FAFD] border border-slate-200/80 space-y-2 hover:bg-white hover:shadow-xs transition-all"
              >
                <div className="text-[11px] font-mono text-[#8591A5]">
                  CENTROID EXCERPT #{i + 1}
                </div>
                <p className="text-[14px] text-[#334155] leading-relaxed font-sans pt-1">
                  "{excerpt}"
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-[18px] bg-slate-50 text-center text-[13px] text-[#64748B]">
            No centroid message excerpts recorded for this candidate.
          </div>
        )}
      </section>
    </div>
  );
};
