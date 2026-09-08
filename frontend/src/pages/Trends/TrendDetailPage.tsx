import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  Check,
  Layers,
  Clock,
  Tag,
  AlertTriangle,
  GitBranch,
  Sparkles,
  Zap,
  ArrowUpRight,
  ChevronRight,
  TrendingUp,
  Compass,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { telemetryApi } from '../../services/telemetryApi';
import { trendService, getCleanTrendId } from '../../services/trendService';
import { TopicDetailData, NarrativeSummaryResponse } from '../../types/api';
import { formatPercent } from '../../utils/telemetryFormatters';
import { KeywordScoresBarChart } from '../../components/ui/charts';
import { TrendNodeGraph } from '../../components/trends/TrendNodeGraph';
import { TrendSentimentChart } from '../../components/trends/TrendSentimentChart';
import { NarrativeTreeNode } from '../../components/trends/TrendNarrativeTree';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { scrollToTop } from '../../utils/scroll';

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

    const loadData = async () => {
      try {
        // 1. Fetch trend record and full catalog of all 345 narratives in parallel
        const [trendRes, allNarratives] = await Promise.all([
          telemetryApi.getTrendById(id),
          trendService.getAllNarratives(),
        ]);

        const t = trendRes.data;
        setTrend(t);

        const cleanId = getCleanTrendId(t.topic_id || (t as any).trend_id || id || '');
        const rawTopicId = t.topic_id?.trim() || '';
        const rawTrendId = ((t as any).trend_id || '').trim();
        const associatedIds = new Set(t.associated_narrative_ids || []);

        // 2. Comprehensive matching across associated IDs, clean ID, raw topic ID, and numeric normalization
        const matched: NarrativeSummaryResponse[] = allNarratives.filter((n) => {
          // A. Direct narrative ID in trend's associated_narrative_ids
          if (associatedIds.has(n.narrative_id)) return true;

          // B. Match by promoted_from_topic_id
          const nTopicClean = getCleanTrendId(n.promoted_from_topic_id);
          if (nTopicClean && nTopicClean === cleanId) return true;
          if (n.promoted_from_topic_id === rawTopicId || n.promoted_from_topic_id === rawTrendId) return true;

          // C. Numeric ID normalization (e.g. "89" === "089")
          const cleanInt = parseInt(cleanId, 10);
          const nTopicInt = parseInt(nTopicClean, 10);
          if (!isNaN(cleanInt) && !isNaN(nTopicInt) && cleanInt === nTopicInt) return true;

          return false;
        });

        // 3. Fallback: If trend has associated_narrative_ids not captured in allNarratives, fetch directly
        const missingIds = (t.associated_narrative_ids || []).filter(
          (nid) => !matched.some((m) => m.narrative_id === nid)
        );
        if (missingIds.length > 0) {
          const directResults = await Promise.allSettled(
            missingIds.map((nid) => telemetryApi.getNarrativeById(nid))
          );
          for (const res of directResults) {
            if (res.status === 'fulfilled' && res.value?.data) {
              matched.push(res.value.data as any);
            }
          }
        }

        // 4. Deterministic sort by priority_signal_score descending
        matched.sort((a, b) => b.priority_signal_score - a.priority_signal_score);
        setAssociatedNarratives(matched);
      } catch (err: any) {
        console.error('Failed to load trend detail:', err);
        setIsError(true);
        setErrorMessage(err.message || 'Trend could not be retrieved from /api/v1/trends/{id}.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="py-32 text-center font-sans space-y-4">
        <div className="w-9 h-9 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[14px] text-slate-600 dark:text-slate-400 font-medium">
          Retrieving trend cluster #{id}...
        </p>
      </div>
    );
  }

  if (isError || !trend) {
    return (
      <div className="space-y-6 font-sans">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-[#2B323D]">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => navigate('/trends')}
            >
              Return to Trends
            </Button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Trend Not Found</h1>
          </div>
        </div>
        <div className="p-8 rounded-[28px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-center space-y-3">
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
    <div className="space-y-7 sm:space-y-8 font-sans pb-16 relative">
      {/* =========================================================================
          ZONE 1: HIGH-IMPACT PROMINENT NAVIGATION & IDENTITY DOCK
          Authoritative, big Trend ID presence with breadcrumb context
          ========================================================================= */}
      <section className="space-y-4 pt-1">
        {/* Navigation Ribbon Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/70 dark:border-[#262C36]">
          {/* Left: Clean, Authentic Breadcrumbs */}
          <nav aria-label="Breadcrumb context" className="flex items-center gap-2 text-[12.5px] font-sans">
            <Link
              to="/overview"
              onClick={() => scrollToTop(true)}
              className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              Traject
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
            <Link
              to="/trends"
              onClick={() => scrollToTop(true)}
              className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              Trends
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
            <span className="font-mono text-[12px] font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700/60">
              #{cleanTrendId}
            </span>
          </nav>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => navigate('/trends')}
            >
              Back to Trends
            </Button>
            <Button
              variant={isWatching ? 'primary' : 'secondary'}
              size="sm"
              leftIcon={isWatching ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Eye className="w-3.5 h-3.5 text-amber-500" />}
              onClick={() => setIsWatching(!isWatching)}
            >
              {isWatching ? 'Tracking Signal' : 'Track Trend'}
            </Button>
          </div>
        </div>

        {/* Executive Hero Title & 3 Crextio Executive KPIs */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pt-1">
          {/* Title & Metadata Left */}
          <div className="space-y-3 max-w-3xl">
            {/* Pill Cluster */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-2 font-mono text-[13px] font-bold text-white bg-[#181D24] dark:bg-[#222833] dark:border dark:border-[#333C4A] px-3.5 py-1 rounded-full shadow-xs">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>TREND #{cleanTrendId}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/90 dark:bg-indigo-950/50 px-3.5 py-1 rounded-full border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Discovered Cluster</span>
              </span>

              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/90 dark:bg-emerald-950/50 px-3.5 py-1 rounded-full border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>HDBSCAN Core</span>
              </span>

              <span className="inline-flex items-center gap-1.5 text-[12px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#1E232B] px-3 py-1 rounded-full border border-slate-200 dark:border-[#2C333E] shadow-2xs">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                <span>{formatPercent(trend.percentage_of_dataset)} Share</span>
              </span>
            </div>

            {/* Big Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight font-sans">
              {trend.trend_name || `Trend #${cleanTrendId}`}
            </h1>

            {/* Description Subtitle */}
            <p className="text-[14px] sm:text-[15px] text-slate-500 dark:text-slate-400 font-normal leading-relaxed">
              Algorithmic trend cluster #{cleanTrendId} discovered across {trend.message_count.toLocaleString()} messages via multilingual sentence embeddings and HDBSCAN density clustering.
            </p>
          </div>

          {/* Crextio 3 Big Executive KPIs on Right */}
          <div className="flex items-center gap-7 sm:gap-9 shrink-0 pt-2 lg:pt-0">
            {/* KPI 1: Message Count */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/90 dark:bg-[#181C22]/90 border border-slate-200/80 dark:border-[#333C48] flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-3xl sm:text-[34px] font-light font-sans text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                  <AnimatedNumber value={trend.message_count} />
                </div>
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">
                  Messages
                </div>
              </div>
            </div>

            {/* KPI 2: Dominance Share */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100/80 dark:bg-amber-950/50 border border-amber-300/60 dark:border-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-2xs">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="text-3xl sm:text-[34px] font-light font-sans text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                  {formatPercent(trend.percentage_of_dataset)}
                </div>
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">
                  Dominance
                </div>
              </div>
            </div>

            {/* KPI 3: Narratives */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/90 dark:bg-[#181C22]/90 border border-slate-200/80 dark:border-[#333C48] flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs">
                <GitBranch className="w-5 h-5" />
              </div>
              <div>
                <div className="text-3xl sm:text-[34px] font-light font-sans text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                  <AnimatedNumber value={associatedNarratives.length} />
                </div>
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">
                  Narratives
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          ZONE 2: CREXTIO SEGMENTED HORIZON CAPSULE RIBBON
          Continuous segmented capsules reflecting dataset share and telemetry
          ========================================================================= */}
      <section className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-3.5 rounded-[26px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs text-[13px] font-sans">
        {/* Left: Continuous Segmented Status Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-2 bg-[#181D24] dark:bg-[#222832] text-white px-3.5 py-1.5 rounded-full text-[12px] font-bold font-mono shadow-xs">
            <span>SHARE</span>
            <span className="text-amber-400">{formatPercent(trend.percentage_of_dataset)}</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-400 dark:bg-amber-400 text-slate-950 font-bold text-[12px] shadow-xs">
            <Layers className="w-3.5 h-3.5 text-slate-950" />
            <span>{trend.message_count.toLocaleString()} Messages</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-[#13171C] border border-slate-200/80 dark:border-[#2B323D] text-[12px] font-medium text-slate-700 dark:text-slate-300">
            <GitBranch className="w-3.5 h-3.5 text-slate-400" />
            <span>{associatedNarratives.length} Associated Narratives</span>
          </div>
        </div>

        {/* Right: Active Date Span & Explorer Link */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {trend.temporal?.first_published_at && (
            <div className="inline-flex items-center gap-1.5 text-[11.5px] font-mono text-slate-500 dark:text-slate-400 px-3.5 py-1.5 rounded-full bg-slate-50 dark:bg-[#13171C] border border-slate-200/60 dark:border-[#2B323D]">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {new Date(trend.temporal.first_published_at).toLocaleDateString()} — {trend.temporal.last_published_at ? new Date(trend.temporal.last_published_at).toLocaleDateString() : 'Active'}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate(`/explorer?topic_id=${trend.topic_id}`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-bold text-[#2F65F6] dark:text-[#5878C7] hover:underline transition-colors cursor-pointer"
          >
            <span>Corpus Explorer</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* =========================================================================
          ZONE 3: HERO BENTO CARD - "What this Trend represents"
          Crextio editorial warmth, subtle ambient golden aura, clean typography
          ========================================================================= */}
      <section className="p-7 sm:p-8 rounded-[30px] border border-[#E6DFC9] dark:border-[#2D333F] bg-gradient-to-br from-[#FFFDF9] via-white to-[#F8F5ED]/90 dark:from-[#1E2229] dark:to-[#171A21] backdrop-blur-md shadow-[0_6px_28px_rgba(245,158,11,0.03)] space-y-4 relative overflow-hidden transition-all">
        {/* Ambient warm golden glow auras */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-amber-400/12 dark:bg-amber-400/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-amber-500/8 dark:bg-amber-500/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between border-b border-slate-200/70 dark:border-[#272D37] pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-900 dark:text-amber-300 border border-amber-400/40">
              DOMINANT DISCOURSE
            </span>
            <h2 className="text-[18px] sm:text-[20px] font-bold text-slate-900 dark:text-white tracking-tight">
              What this Trend represents
            </h2>
          </div>

          <div className="flex items-center gap-1.5 text-[11.5px] font-mono text-slate-400">
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            <span>Dense Cluster Centroid</span>
          </div>
        </div>

        <p className="relative z-10 text-[15.5px] sm:text-[17px] text-slate-700 dark:text-slate-200 leading-relaxed font-sans font-normal">
          {trend.trend_summary ||
            `Semantic trend cluster #${cleanTrendId} (${trend.trend_name || 'Unlabeled'}) synthesized from ${trend.message_count.toLocaleString()} observed messages across representative c-TF-IDF term frequencies.`}
        </p>

        <div className="relative z-10 pt-2 border-t border-slate-200/50 dark:border-[#252B35] flex items-center justify-between text-[11.5px] text-slate-500 dark:text-slate-400">
          <span>Synthesized via multilingual sentence embeddings and HDBSCAN density clustering</span>
          <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">c-TF-IDF Centroid Verified</span>
        </div>
      </section>

      {/* =========================================================================
          ZONE 4: REPRESENTATIVE LEXICAL FEATURES (c-TF-IDF MATRIX)
          ========================================================================= */}
      <section className="p-6 sm:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-6 transition-all">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252B32] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[10.5px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/40">
                TF-IDF MATRIX
              </span>
              <h3 className="text-[17px] font-bold text-slate-900 dark:text-white tracking-tight">
                Representative Lexical Features
              </h3>
            </div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-1">
              Top keywords identified by class-based TF-IDF across clustered messages
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Keyword Chips */}
          <div className="flex flex-wrap gap-2">
            {trend.representative_keywords.map((kw, idx) => (
              <span
                key={idx}
                className="px-3.5 py-1.5 rounded-full bg-slate-100/90 dark:bg-[#13171C] text-[13px] font-semibold text-slate-900 dark:text-white border border-slate-200/80 dark:border-[#2B323D] flex items-center gap-1.5 shadow-2xs hover:border-amber-400/50 transition-colors"
              >
                <span className="text-amber-500 font-bold">#</span>
                <span>{kw.keyword}</span>
                <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">({kw.score.toFixed(3)})</span>
              </span>
            ))}
          </div>

          <div className="pt-2">
            <div className="text-[12px] font-bold text-slate-900 dark:text-white mb-2 font-sans">
              Class-Based Term Weighting (c-TF-IDF)
            </div>
            <KeywordScoresBarChart keywords={trend.representative_keywords} />
          </div>
        </div>
      </section>

      {/* =========================================================================
          ZONE 5: TREND RELATIONSHIP TOPOLOGY (COMPLETELY UNTOUCHED AS REQUESTED)
          ========================================================================= */}
      <TrendNodeGraph trendId={trend.topic_id} />

      {/* =========================================================================
          ZONE 6: TREND SENTIMENT TRAJECTORY
          ========================================================================= */}
      <TrendSentimentChart trendId={trend.topic_id} />

      {/* =========================================================================
          ZONE 7: ASSOCIATED NARRATIVES HIERARCHY TREE
          ========================================================================= */}
      <section className="p-6 sm:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-4 transition-all">
        <div className="border-b border-slate-100 dark:border-[#252B32] pb-4 flex items-center justify-between">
          <div>
            <h3 className="text-[17px] font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-rose-500" />
              <span>Associated Narratives ({associatedNarratives.length})</span>
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Hierarchical narrative candidates synthesized from Trend #{cleanTrendId}
            </p>
          </div>
        </div>

        {associatedNarratives.length > 0 ? (
          <div className="relative pl-6 ml-3 border-l-2 border-slate-200 dark:border-[#2B323D] space-y-2.5 pt-2">
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
          <div className="py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
            No narratives are currently associated with this Trend.
          </div>
        )}
      </section>

      {/* =========================================================================
          ZONE 8: EXTRACTED ENTITIES
          ========================================================================= */}
      {trend.entities && trend.entities.length > 0 && (
        <section className="p-6 sm:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-4 transition-all">
          <div className="border-b border-slate-100 dark:border-[#252B32] pb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-center">
                <Tag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-slate-900 dark:text-white tracking-tight">
                  Extracted Entities
                </h3>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Named entities and domain sources detected across this Trend ({trend.entities.length})
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            {trend.entities.map((ent, idx) => (
              <span
                key={idx}
                className="px-3.5 py-1.5 rounded-full bg-slate-50/90 dark:bg-[#13171C] text-slate-800 dark:text-slate-200 text-[12.5px] font-medium border border-slate-200/80 dark:border-[#2B323D] shadow-2xs hover:border-amber-400/50 transition-colors"
              >
                {ent.text} <span className="text-slate-400 dark:text-slate-500 text-[11px] font-mono">({ent.category})</span>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

