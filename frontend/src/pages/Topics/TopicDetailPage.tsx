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
} from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { telemetryApi } from '../../services/telemetryApi';
import { TopicDetailData } from '../../types/api';
import { formatPercent, formatDecimal } from '../../utils/telemetryFormatters';
import { KeywordScoresBarChart } from '../../components/ui/charts';

export const TopicDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [topic, setTopic] = useState<TopicDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isWatching, setIsWatching] = useState(false);

  useEffect(() => {
    if (!id) return;

    setIsLoading(true);
    setIsError(false);
    telemetryApi
      .getTopicById(id)
      .then((res) => {
        setTopic(res.data);
      })
      .catch((err) => {
        console.error('Failed to load topic detail:', err);
        setIsError(true);
        setErrorMessage(err.message || 'Topic could not be retrieved from /api/v1/topics/{id}.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="py-20 text-center font-sans space-y-3">
        <div className="w-8 h-8 border-3 border-[#2F65F6] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[14px] text-[#64748B]">Querying topic cluster record...</p>
      </div>
    );
  }

  if (isError || !topic) {
    return (
      <div className="space-y-6 font-sans">
        <PageHeader
          title="Topic Cluster Record"
          description="Error retrieving backend topic cluster from Milestone 5A."
          actions={
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => navigate('/topics')}
            >
              Return to Topics
            </Button>
          }
        />
        <div className="p-8 rounded-[24px] bg-rose-50 border border-rose-200 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h3 className="text-[16px] font-bold text-rose-900">Topic Cluster Not Found</h3>
          <p className="text-[13px] text-rose-700 max-w-md mx-auto">
            {errorMessage || `Topic "${id}" does not exist or has decayed.`}
          </p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/topics')}>
            Back to Topics List
          </Button>
        </div>
      </div>
    );
  }

  const primaryKeyword = topic.representative_keywords[0]?.keyword || `Cluster #${topic.cluster_label}`;

  return (
    <div className="space-y-8 font-sans">
      {/* 1. Page Header */}
      <PageHeader
        title={`Topic: ${primaryKeyword}`}
        description={`Semantic topic discovery cluster ${topic.topic_id} extracted via HDBSCAN and c-TF-IDF.`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => navigate('/topics')}
            >
              Topics
            </Button>

            <Button
              variant={isWatching ? 'primary' : 'secondary'}
              size="sm"
              leftIcon={isWatching ? <Check className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              onClick={() => setIsWatching(!isWatching)}
            >
              {isWatching ? 'Tracking' : 'Track Topic'}
            </Button>
          </div>
        }
      />

      {/* Metadata Pill Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 rounded-[22px] border border-[rgba(228,233,245,0.85)] bg-white text-[13px] font-sans text-[#64748B] shadow-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[#111727] uppercase font-bold text-[11px] font-mono bg-[#EEF1F8] px-2.5 py-0.5 rounded-full">
            {topic.topic_id.toUpperCase()}
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-[11px] font-mono font-semibold text-[#2F65F6] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
            {formatPercent(topic.percentage_of_dataset)} of dataset
          </span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center gap-1 text-[#475569]">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span><strong className="text-[#111727]">{topic.message_count.toLocaleString()}</strong> messages</span>
          </span>
        </div>

        <div className="flex items-center gap-3 text-[12px]">
          {topic.temporal?.first_published_at && (
            <span className="inline-flex items-center gap-1 font-mono text-[#64748B]">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>First: {new Date(topic.temporal.first_published_at).toLocaleDateString()}</span>
            </span>
          )}
          {topic.temporal?.last_published_at && (
            <>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1 font-mono text-[#64748B]">
                <span>Last: {new Date(topic.temporal.last_published_at).toLocaleDateString()}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2. c-TF-IDF Lexical Representation */}
      <section className="p-6 md:p-8 rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white shadow-dashboard space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-[17px] font-bold text-[#111727]">
              c-TF-IDF Lexical Keywords
            </h3>
            <p className="text-[12px] text-[#8591A5]">
              Authoritative class-based term frequency inverse document frequency representations
            </p>
          </div>
          <span className="text-[11px] font-mono text-[#2F65F6] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 font-semibold">
            {topic.representative_keywords.length} terms
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start pt-2">
          {/* Keyword Badges */}
          <div className="space-y-3">
            <div className="text-[12px] font-semibold text-[#8591A5] uppercase tracking-wider">
              Token Frequency Index
            </div>
            <div className="flex flex-wrap gap-2">
              {topic.representative_keywords.map((kw, i) => (
                <span
                  key={i}
                  className="px-3.5 py-1.5 rounded-full bg-[#F6F8FC] border border-slate-200/80 text-[#111727] text-[13px] font-medium font-mono"
                >
                  #{kw.keyword} <span className="text-[#8591A5] text-[11px]">({kw.score.toFixed(2)})</span>
                </span>
              ))}
            </div>
          </div>

          {/* c-TF-IDF Analytical Ranking Bar Chart */}
          <div className="p-4 rounded-[20px] bg-[#F8FAFD] border border-slate-200/70">
            <div className="text-[12px] font-bold text-[#111727] mb-2 font-sans">
              Class-Based Term Weighting (c-TF-IDF)
            </div>
            <KeywordScoresBarChart keywords={topic.representative_keywords} />
          </div>
        </div>
      </section>

      {/* 3. 4F Feature Telemetry (Temporal & Propagation Dynamics) */}
      {(topic.temporal || topic.engagement || topic.propagation) && (
        <section className="p-6 md:p-8 rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white shadow-dashboard space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-[17px] font-bold text-[#111727]">
              Temporal & Propagation Features (Milestone 4F)
            </h3>
            <p className="text-[12px] text-[#8591A5]">
              Burstiness (B), virality, and engagement velocity indicators
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            <div className="p-4 rounded-[20px] bg-[#F8FAFD] border border-slate-200/70 space-y-1">
              <div className="text-[11px] font-bold text-[#8591A5] uppercase">Burstiness Index</div>
              <div className="font-mono text-[24px] font-extrabold text-[#111727]">
                {topic.temporal?.burstiness_index !== null && topic.temporal?.burstiness_index !== undefined
                  ? formatDecimal(topic.temporal.burstiness_index, 3)
                  : '—'}
              </div>
              <p className="text-[11px] text-[#64748B]">
                Peak-to-mean temporal concentration.
              </p>
            </div>

            <div className="p-4 rounded-[20px] bg-[#F8FAFD] border border-slate-200/70 space-y-1">
              <div className="text-[11px] font-bold text-[#8591A5] uppercase">Channel Velocity</div>
              <div className="font-mono text-[24px] font-extrabold text-[#111727]">
                {topic.temporal?.channel_entry_velocity !== null && topic.temporal?.channel_entry_velocity !== undefined
                  ? formatDecimal(topic.temporal.channel_entry_velocity, 2)
                  : '—'}
              </div>
              <p className="text-[11px] text-[#64748B]">
                Distinct channels entry rate per hour.
              </p>
            </div>

            <div className="p-4 rounded-[20px] bg-[#F8FAFD] border border-slate-200/70 space-y-1">
              <div className="text-[11px] font-bold text-[#8591A5] uppercase">Observed Forwards</div>
              <div className="font-mono text-[24px] font-extrabold text-[#111727]">
                {topic.propagation?.observed_forward_count?.toLocaleString() || '0'}
              </div>
              <p className="text-[11px] text-[#64748B]">
                Forward cascade events recorded.
              </p>
            </div>

            <div className="p-4 rounded-[20px] bg-[#F8FAFD] border border-slate-200/70 space-y-1">
              <div className="text-[11px] font-bold text-[#8591A5] uppercase">Entities Extracted</div>
              <div className="font-mono text-[24px] font-extrabold text-[#111727]">
                {topic.entities?.length ?? 0}
              </div>
              <p className="text-[11px] text-[#64748B]">
                Distinct entities in cluster.
              </p>
            </div>
          </div>

          {/* Extracted Named Entities */}
          {topic.entities && topic.entities.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <div className="text-[12px] font-bold text-[#111727] mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#2F65F6]" />
                <span>Extracted Entities</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {topic.entities.slice(0, 15).map((ent, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-full bg-slate-100 text-[#334155] text-[12px] font-medium"
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
      <section className="p-6 md:p-8 rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white shadow-dashboard space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#2F65F6]" />
            <h3 className="text-[17px] font-bold text-[#111727]">
              Representative Message Captures
            </h3>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/explorer?topic_id=${topic.topic_id}`)}
          >
            Explore in Corpus Explorer
          </Button>
        </div>

        {topic.representative_message_ids && topic.representative_message_ids.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {topic.representative_message_ids.map((msgId, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-full bg-[#F8FAFD] border border-slate-200/80 font-mono text-[12px] text-[#2F65F6]"
              >
                {msgId}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-[#8591A5]">No representative message IDs recorded.</p>
        )}
      </section>
    </div>
  );
};
