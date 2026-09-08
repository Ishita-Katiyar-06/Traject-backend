import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  Check,
  Layers,
  Clock,
  Tag,
  AlertTriangle,
  FileText,
  GitBranch,
} from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { telemetryApi } from '../../services/telemetryApi';
import { TopicDetailData, NarrativeSummaryResponse } from '../../types/api';
import { formatPercent, formatDecimal } from '../../utils/telemetryFormatters';
import { KeywordScoresBarChart } from '../../components/ui/charts';
import { TrendNodeGraph } from '../../components/trends/TrendNodeGraph';
import { TrendSentimentChart } from '../../components/trends/TrendSentimentChart';
import { NarrativeTreeNode } from '../../components/trends/TrendNarrativeTree';

export const TrendDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [trend, setTrend] = useState<TopicDetailData | null>(null);
  const [associatedNarratives, setAssociatedNarratives] = useState<NarrativeSummaryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isWatching, setIsWatching] = useState(false);

  useEffect(() => {
    if (!id) return;

    setIsLoading(true);
    setIsError(false);
    Promise.all([
      telemetryApi.getTrendById(id),
      telemetryApi.getNarratives({ page: 1, page_size: 100 }),
    ])
      .then(([trendRes, narrativesRes]) => {
        setTrend(trendRes.data);
        const t = trendRes.data;
        const cleanId = (t.topic_id || id).replace(/^trend_|^topic_/, '');
        const allN = narrativesRes.data || [];
        const matched = allN.filter(
          (n) =>
            (t.associated_narrative_ids && t.associated_narrative_ids.includes(n.narrative_id)) ||
            n.promoted_from_topic_id.replace(/^trend_|^topic_/, '') === cleanId
        );
        matched.sort((a, b) => b.priority_signal_score - a.priority_signal_score);
        setAssociatedNarratives(matched);
      })
      .catch((err) => {
        console.error('Failed to load trend detail:', err);
        setIsError(true);
        setErrorMessage(err.message || 'Trend could not be retrieved from /api/v1/trends/{id}.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="py-20 text-center font-sans space-y-3">
        <div className="w-8 h-8 border-3 border-[#2F65F6] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[14px] text-[#64748B] dark:text-slate-400">Querying trend cluster record...</p>
      </div>
    );
  }

  if (isError || !trend) {
    return (
      <div className="space-y-6 font-sans">
        <PageHeader
          title="Trend Record"
          description="Error retrieving backend trend cluster record."
          actions={
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => navigate('/trends')}
            >
              Return to Trends
            </Button>
          }
        />
        <div className="p-8 rounded-[24px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto" />
          <h3 className="text-[16px] font-bold text-rose-900 dark:text-rose-200">Trend Record Not Found</h3>
          <p className="text-[13px] text-rose-700 dark:text-rose-300 max-w-md mx-auto">
            {errorMessage || `Trend "${id}" does not exist or has decayed.`}
          </p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/trends')}>
            Back to Trends List
          </Button>
        </div>
      </div>
    );
  }

  const cleanTrendId = ((trend as any).trend_id || trend.topic_id || id || '').replace(/^topic_|^trend_/, '');

  return (
    <div className="space-y-6 sm:space-y-8 font-sans pb-10">
      {/* 1. Page Header */}
      <PageHeader
        title={
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#2F65F6] dark:text-[#93C5FD] border border-blue-200/70 dark:border-blue-900/40">
                TREND #{cleanTrendId}
              </span>
            </div>
            <h1 className="text-[26px] sm:text-[32px] font-bold text-[#111727] dark:text-[#F8FAFC] tracking-tight leading-tight font-sans">
              {trend.trend_name || `Trend #${cleanTrendId}`}
            </h1>
          </div>
        }
        description={`Algorithmic trend cluster #${cleanTrendId} discovered via multilingual sentence embeddings and HDBSCAN density clustering.`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => navigate('/trends')}
            >
              Trends
            </Button>

            <Button
              variant={isWatching ? 'primary' : 'secondary'}
              size="sm"
              leftIcon={isWatching ? <Check className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              onClick={() => setIsWatching(!isWatching)}
            >
              {isWatching ? 'Tracking' : 'Track Trend'}
            </Button>
          </div>
        }
      />

      {/* Metadata Pill Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 rounded-[20px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] text-[13px] font-sans text-[#64748B] dark:text-slate-400 shadow-dashboard">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[#111727] dark:text-slate-200 uppercase font-bold text-[11px] font-mono bg-[#F1F4F9] dark:bg-[#12161C] px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-[#2B323A]">
            TREND #{cleanTrendId}
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="text-[11px] font-mono font-semibold text-[#2F65F6] dark:text-[#93C5FD] bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-100 dark:border-blue-900/40">
            {formatPercent(trend.percentage_of_dataset)} of dataset
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="inline-flex items-center gap-1 text-[#475569] dark:text-slate-300">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span><strong className="text-[#111727] dark:text-slate-100">{trend.message_count.toLocaleString()}</strong> messages</span>
          </span>
        </div>

        <div className="flex items-center gap-3 text-[12px]">
          {trend.temporal?.first_published_at && (
            <span className="inline-flex items-center gap-1 font-mono text-[#64748B] dark:text-slate-400">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>First: {new Date(trend.temporal.first_published_at).toLocaleDateString()}</span>
            </span>
          )}
          {trend.temporal?.last_published_at && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="inline-flex items-center gap-1 font-mono text-[#64748B] dark:text-slate-400">
                <span>Last: {new Date(trend.temporal.last_published_at).toLocaleDateString()}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Dedicated Section: What this Trend represents */}
      <section className="p-6 md:p-8 rounded-[24px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-dashboard space-y-3 transition-all">
        <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-[#252B32] pb-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#2F65F6]" />
          <h2 className="text-[18px] sm:text-[20px] font-bold text-[#111727] dark:text-slate-100 tracking-tight">
            What this Trend represents
          </h2>
        </div>
        <p className="text-[14px] sm:text-[15px] text-[#334155] dark:text-slate-300 leading-relaxed font-sans font-normal">
          {trend.trend_summary || 'Semantic trend cluster synthesized from dense embedding spaces and representative class-based term frequencies.'}
        </p>
      </section>

      {/* 2. c-TF-IDF Representative Terms */}
      <section className="p-6 md:p-8 rounded-[24px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-dashboard space-y-6 transition-all">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252B32] pb-4">
          <div>
            <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100 tracking-tight">
              Representative Lexical Features
            </h3>
            <p className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-0.5">
              Top keywords identified by class-based TF-IDF across clustered messages
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {trend.representative_keywords.map((kw, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-full bg-[#F6F8FC] dark:bg-[#1D232A] text-[13px] font-semibold text-[#111727] dark:text-slate-200 border border-slate-200/80 dark:border-[#2B323A] flex items-center gap-1.5"
              >
                <span className="text-[#2F65F6] dark:text-[#93C5FD]">#</span>
                <span>{kw.keyword}</span>
                <span className="text-[11px] font-mono text-[#8591A5] dark:text-slate-400">({kw.score.toFixed(3)})</span>
              </span>
            ))}
          </div>

          <div className="pt-2">
            <div className="text-[12px] font-bold text-[#111727] dark:text-slate-100 mb-2 font-sans">
              Class-Based Term Weighting (c-TF-IDF)
            </div>
            <KeywordScoresBarChart keywords={trend.representative_keywords} />
          </div>
        </div>
      </section>

      {/* 2.5 Converging Relationship Flow Graph */}
      <TrendNodeGraph trendId={trend.topic_id} />

      {/* 2.6 Trend Sentiment Trajectory */}
      <TrendSentimentChart trendId={trend.topic_id} />

      {/* 2.7 Trend -> Associated Narratives Tree */}
      <section className="p-6 md:p-8 rounded-[24px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-dashboard space-y-4 transition-all">
        <div className="border-b border-slate-100 dark:border-[#252B32] pb-4 flex items-center justify-between">
          <div>
            <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100 tracking-tight flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-rose-500" />
              <span>Associated Narratives ({associatedNarratives.length})</span>
            </h3>
            <p className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-0.5">
              Hierarchical narrative candidates synthesized from Trend #{cleanTrendId}
            </p>
          </div>
        </div>

        {associatedNarratives.length > 0 ? (
          <div className="relative pl-6 ml-3 border-l-2 border-slate-200 dark:border-[#2B323A] space-y-2.5 pt-2">
            {associatedNarratives.map((n, idx) => (
              <NarrativeTreeNode
                key={n.narrative_id}
                narrative={n}
                parentTrendId={(trend as any).trend_id || trend.topic_id}
                parentCleanTrendId={cleanTrendId}
                isLast={idx === associatedNarratives.length - 1}
              />
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-[13px] text-[#8591A5] dark:text-slate-400">
            No narratives are currently associated with this Trend.
          </div>
        )}
      </section>

      {/* 3. 4F Feature Telemetry (Temporal & Propagation Dynamics) */}
      {(trend.temporal || trend.engagement || trend.propagation) && (
        <section className="p-6 md:p-8 rounded-[24px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-dashboard space-y-5 transition-all">
          <div className="border-b border-slate-100 dark:border-[#252B32] pb-4">
            <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100 tracking-tight">
              Temporal & Propagation Features (Milestone 4F)
            </h3>
            <p className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-0.5">
              Burstiness (B), virality, and engagement velocity indicators
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            <div className="p-4 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/70 dark:border-[#252B32] space-y-1">
              <div className="text-[11px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">Burstiness Index</div>
              <div className="font-mono text-[24px] font-extrabold text-[#111727] dark:text-slate-100">
                {trend.temporal?.burstiness_index !== null && trend.temporal?.burstiness_index !== undefined
                  ? formatDecimal(trend.temporal.burstiness_index, 3)
                  : '—'}
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Peak-to-mean temporal concentration.
              </p>
            </div>

            <div className="p-4 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/70 dark:border-[#252B32] space-y-1">
              <div className="text-[11px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">Channel Velocity</div>
              <div className="font-mono text-[24px] font-extrabold text-[#111727] dark:text-slate-100">
                {trend.temporal?.channel_entry_velocity !== null && trend.temporal?.channel_entry_velocity !== undefined
                  ? formatDecimal(trend.temporal.channel_entry_velocity, 2)
                  : '—'}
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Distinct channels entry rate per hour.
              </p>
            </div>

            <div className="p-4 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/70 dark:border-[#252B32] space-y-1">
              <div className="text-[11px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">Observed Forwards</div>
              <div className="font-mono text-[24px] font-extrabold text-[#111727] dark:text-slate-100">
                {trend.propagation?.observed_forward_count?.toLocaleString() || '0'}
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Forward cascade events recorded.
              </p>
            </div>

            <div className="p-4 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/70 dark:border-[#252B32] space-y-1">
              <div className="text-[11px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">Entities Extracted</div>
              <div className="font-mono text-[24px] font-extrabold text-[#111727] dark:text-slate-100">
                {trend.entities?.length ?? 0}
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Distinct entities in cluster.
              </p>
            </div>
          </div>

          {/* Extracted Named Entities */}
          {trend.entities && trend.entities.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-[#252B32]">
              <div className="text-[12px] font-bold text-[#111727] dark:text-slate-100 mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#2F65F6]" />
                <span>Extracted Entities</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {trend.entities.slice(0, 15).map((ent, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#1D232A] text-[#334155] dark:text-slate-300 text-[12px] font-medium border border-slate-200/60 dark:border-[#2B323A]"
                  >
                    {ent.text} <span className="text-slate-400 text-[10px]">({ent.category})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 4. Representative Message IDs & Corpus Link */}
      <section className="p-6 md:p-8 rounded-[24px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-dashboard space-y-4 transition-all">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252B32] pb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#2F65F6]" />
            <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100 tracking-tight">
              Representative Message Captures
            </h3>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/explorer?topic_id=${trend.topic_id}`)}
          >
            Explore in Corpus Explorer
          </Button>
        </div>

        {trend.representative_message_ids && trend.representative_message_ids.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {trend.representative_message_ids.map((msgId, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-full bg-[#F8FAFD] dark:bg-[#1D232A] border border-slate-200/80 dark:border-[#2B323A] font-mono text-[12px] text-[#2F65F6] dark:text-[#93C5FD]"
              >
                {msgId}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-[#8591A5] dark:text-slate-400">No representative message IDs recorded.</p>
        )}
      </section>
    </div>
  );
};
