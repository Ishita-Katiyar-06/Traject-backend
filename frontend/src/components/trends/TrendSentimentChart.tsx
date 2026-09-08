import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Activity,
  CheckCircle2,
  TrendingUp,
  Scale,
  Zap,
} from 'lucide-react';
import { SentimentDonutChart } from '../ui/charts/SentimentDonutChart';
import { telemetryApi } from '../../services/telemetryApi';
import { TrendSentimentData } from '../../types/api';
import { Button } from '../ui/Button';

export interface TrendSentimentChartProps {
  trendId: string;
  className?: string;
}

export const TrendSentimentChart: React.FC<TrendSentimentChartProps> = ({
  trendId,
  className = '',
}) => {
  const [sentimentData, setSentimentData] = useState<TrendSentimentData | null>(null);
  const [bucketSize, setBucketSize] = useState<'1h' | '6h' | '1d'>('1d');
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchSentiment = useCallback(async () => {
    if (!trendId) return;
    setIsLoading(true);
    setIsError(false);
    setErrorMessage('');

    try {
      const res = await telemetryApi.getTrendSentiment(trendId, bucketSize);
      setSentimentData(res.data);
    } catch (err: any) {
      console.error('Failed to load trend sentiment data:', err);
      setIsError(true);
      setErrorMessage(err.message || 'Failed to retrieve sentiment series from backend.');
    } finally {
      setIsLoading(false);
    }
  }, [trendId, bucketSize]);

  useEffect(() => {
    fetchSentiment();
  }, [fetchSentiment]);

  const summary = sentimentData?.summary;
  const totalEvaluated = summary?.evaluated_messages || 0;
  const posRatio = summary?.positive_ratio !== null && summary?.positive_ratio !== undefined ? summary.positive_ratio * 100 : 0;
  const neuRatio = summary?.neutral_ratio !== null && summary?.neutral_ratio !== undefined ? summary.neutral_ratio * 100 : 0;
  const negRatio = summary?.negative_ratio !== null && summary?.negative_ratio !== undefined ? summary.negative_ratio * 100 : 0;
  const netScore = (posRatio - negRatio) / 100;

  // Compute active observation series metrics (different from graph data)
  const activeSeries = useMemo(() => {
    return (sentimentData?.time_series || []).filter(
      (b) => b.total > 0 || (b.positive + b.neutral + b.negative) > 0
    );
  }, [sentimentData]);

  // Compute Polarity Volatility (Standard Deviation of sentiment across active windows)
  const volatilityMetric = useMemo(() => {
    if (activeSeries.length === 0) return { stdDev: 0, rating: 'Low', shiftCount: 0 };
    const scores = activeSeries.map((b) => b.net_sentiment ?? 0);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    let rating = 'Low';
    if (stdDev > 0.4) rating = 'High';
    else if (stdDev > 0.2) rating = 'Moderate';

    // Count shifts away from 0
    const shiftCount = scores.filter((s) => Math.abs(s) > 0.1).length;

    return { stdDev, rating, shiftCount };
  }, [activeSeries]);

  // Compute Discourse Consensus
  const consensusMetric = useMemo(() => {
    const dominant = Math.max(neuRatio, posRatio, negRatio);
    let label = 'Strong Consensus';
    let levelColor = 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/40';

    if (dominant < 55) {
      label = 'Contested / Split';
      levelColor = 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800/40';
    } else if (dominant < 75) {
      label = 'Moderate Consensus';
      levelColor = 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-800/40';
    }

    return { dominantPct: dominant, label, levelColor };
  }, [neuRatio, posRatio, negRatio]);

  // Dynamic consensus description derived from dominant sentiment
  const consensusDescription = useMemo(() => {
    let dominantTone = 'neutral';
    if (posRatio > neuRatio && posRatio > negRatio) dominantTone = 'positive';
    else if (negRatio > neuRatio && negRatio > posRatio) dominantTone = 'negative';

    if (consensusMetric.dominantPct >= 75) {
      return `Predominantly ${dominantTone} discourse (${consensusMetric.dominantPct.toFixed(1)}%) with low ideological polarization.`;
    }
    if (consensusMetric.dominantPct >= 55) {
      return `Moderate consensus centered on ${dominantTone} tone (${consensusMetric.dominantPct.toFixed(1)}%) with minor divergent views.`;
    }
    return `Split discourse across sentiment categories (highest: ${dominantTone} at ${consensusMetric.dominantPct.toFixed(1)}%).`;
  }, [posRatio, neuRatio, negRatio, consensusMetric.dominantPct]);

  // Dynamic volatility description derived from active observation series
  const volatilityDescription = useMemo(() => {
    if (activeSeries.length === 0) {
      return 'No active chronological sentiment windows observed for this trend cluster.';
    }

    const minBucket = activeSeries.reduce(
      (min, b) => ((b.net_sentiment ?? 0) < (min.net_sentiment ?? 0) ? b : min),
      activeSeries[0]
    );
    const minScore = minBucket?.net_sentiment ?? 0;

    if (volatilityMetric.rating === 'Low') {
      if (minBucket && minScore <= -0.15) {
        const dStr = new Date(minBucket.bucket_start_utc).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        });
        return `Stable baseline with localized friction event on ${dStr} (${minScore.toFixed(2)} score).`;
      }
      return `Consistent chronological trajectory across ${activeSeries.length} observation windows.`;
    }

    if (volatilityMetric.rating === 'Moderate') {
      return `Moderate drift with ${volatilityMetric.shiftCount} polarity shift${volatilityMetric.shiftCount === 1 ? '' : 's'} across observation windows.`;
    }

    return `Elevated variance with dynamic shifts across ${activeSeries.length} active observation windows.`;
  }, [activeSeries, volatilityMetric]);

  // Dynamic polarity description derived from evaluated ratios
  const polarityDescription = useMemo(() => {
    const posPart =
      posRatio > 0
        ? `${posRatio.toFixed(1)}% positive sentiment detected.`
        : 'Zero positive sentiment detected.';
    const negPart =
      negRatio > 0
        ? `${negRatio.toFixed(1)}% negative.`
        : 'Zero negative sentiment.';
    return `Score on [-1.00 to +1.00] scale. ${posPart} ${negPart}`;
  }, [posRatio, negRatio]);

  // Dynamic coverage description derived from model and counts
  const coverageDescription = useMemo(() => {
    const model = summary?.sentiment_model_id || 'CardiffNLP RoBERTa';
    const unassigned = summary?.unassigned_messages || 0;
    if (unassigned > 0) {
      return `${model} evaluated ${totalEvaluated} messages with ${unassigned} unassigned or non-text messages.`;
    }
    return `${model} evaluated across all ${totalEvaluated} cluster messages with zero unassigned.`;
  }, [summary, totalEvaluated]);

  // Dynamic Analytical Takeaway synthesizing real telemetry
  const analyticTakeaway = useMemo(() => {
    if (totalEvaluated === 0) {
      return 'Insufficient sentiment data available to synthesize an analytical takeaway for this cluster.';
    }

    let dominantLabel = 'Neutral';
    let dominantVal = neuRatio;
    if (posRatio > neuRatio && posRatio > negRatio) {
      dominantLabel = 'Positive';
      dominantVal = posRatio;
    } else if (negRatio > neuRatio && negRatio > posRatio) {
      dominantLabel = 'Negative';
      dominantVal = negRatio;
    }

    const minBucket =
      activeSeries.length > 0
        ? activeSeries.reduce(
            (min, b) => ((b.net_sentiment ?? 0) < (min.net_sentiment ?? 0) ? b : min),
            activeSeries[0]
          )
        : null;

    const minScore = minBucket?.net_sentiment ?? 0;
    let eventText = '';
    if (minBucket && minScore <= -0.15) {
      const dStr = new Date(minBucket.bucket_start_utc).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      eventText = ` A localized contention event occurred on ${dStr} (${minScore > 0 ? '+' : ''}${minScore.toFixed(2)} score), after which the discourse normalized.`;
    } else if (volatilityMetric.rating === 'Low') {
      eventText = ' Sentiment remained stable and consistent across the recorded chronological timeline.';
    } else {
      eventText = ` Narrative displayed dynamic shifts across ${activeSeries.length} observation windows.`;
    }

    return `Cluster discourse exhibits ${consensusMetric.label.toLowerCase()} (${dominantVal.toFixed(1)}% ${dominantLabel}).${eventText}`;
  }, [totalEvaluated, neuRatio, posRatio, negRatio, activeSeries, volatilityMetric.rating, consensusMetric.label]);

  // Polarity status helper
  const getPolarityStatus = (score: number) => {
    if (score > 0.3) return { label: 'Bullish / Positive', color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900/40' };
    if (score > 0.05) return { label: 'Slightly Positive', color: 'text-emerald-600 bg-emerald-50/60 border-emerald-200/60 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900/30' };
    if (score < -0.3) return { label: 'Bearish / Negative', color: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/40 dark:border-rose-900/40' };
    if (score < -0.05) return { label: 'Slightly Negative', color: 'text-rose-600 bg-rose-50/60 border-rose-200/60 dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-900/30' };
    return { label: 'Neutral / Balanced', color: 'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700' };
  };

  const polarityStatus = getPolarityStatus(netScore);

  if (isLoading) {
    return (
      <div className={`p-6 sm:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-4 ${className}`}>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252B32] pb-4">
          <div className="h-5 w-44 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-7 w-28 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="h-[280px] rounded-[20px] bg-slate-50 dark:bg-[#12161C] border border-slate-100 dark:border-[#20262E] flex flex-col items-center justify-center space-y-3">
          <div className="w-7 h-7 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] font-mono text-slate-500 dark:text-slate-400">
            Evaluating UTC chronological RoBERTa sentiment series...
          </span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`p-6 sm:p-8 rounded-[30px] border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 shadow-xs space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <h3 className="text-[16px] font-bold text-rose-900 dark:text-rose-200">
              Trend Sentiment Series Unavailable
            </h3>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchSentiment} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Retry Sentiment
          </Button>
        </div>
        <p className="text-[13px] text-rose-700 dark:text-rose-300">
          {errorMessage || 'Sentiment series could not be loaded.'}
        </p>
      </div>
    );
  }

  return (
    <section className={`p-6 sm:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-6 transition-all font-sans ${className}`}>
      {/* 1. Header (Following Exact TrendDetailPage UI/UX Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-[#252B32] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10.5px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/40">
              SENTIMENT ANALYSIS
            </span>
            <h3 className="text-[17px] font-bold text-slate-900 dark:text-white tracking-tight">
              Trend Sentiment & Discourse Telemetry
            </h3>
          </div>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-1">
            Multi-track RoBERTa classification, discourse consensus, and volatility telemetry
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          {/* Bucket Interval Toggle (Crextio Rounded-Full Pill) */}
          <div className="flex items-center gap-1 bg-[#F5F1E5] dark:bg-[#1E2229] p-1 rounded-full border border-[#E5DFD3] dark:border-[#2D333F] shadow-2xs">
            <button
              type="button"
              onClick={() => setBucketSize('1h')}
              className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold transition-all cursor-pointer ${
                bucketSize === '1h'
                  ? 'bg-[#181D24] text-white dark:bg-white dark:text-[#181D24] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              1h
            </button>
            <button
              type="button"
              onClick={() => setBucketSize('6h')}
              className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold transition-all cursor-pointer ${
                bucketSize === '6h'
                  ? 'bg-[#181D24] text-white dark:bg-white dark:text-[#181D24] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              6h
            </button>
            <button
              type="button"
              onClick={() => setBucketSize('1d')}
              className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold transition-all cursor-pointer ${
                bucketSize === '1d'
                  ? 'bg-[#181D24] text-white dark:bg-white dark:text-[#181D24] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              1d
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Sentiment Arena: Concentric Donut Gauge on Left, 4 Informative Intelligence Cards on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-center">
        {/* Left: Authentic Concentric Donut Gauge (User Reference Design) */}
        <div className="lg:col-span-6 xl:col-span-7 flex flex-col justify-center">
          <SentimentDonutChart
            positiveRatio={summary?.positive_ratio ?? 0}
            neutralRatio={summary?.neutral_ratio ?? 0}
            negativeRatio={summary?.negative_ratio ?? 0}
            evaluatedCount={totalEvaluated}
            modelId={summary?.sentiment_model_id}
            isLoading={isLoading}
            title="SENTIMENT"
            subTitle="TREND"
            className="w-full"
          />
        </div>

        {/* Right: 4 Informative Intelligence Pods (Showing rich, actionable data different from raw graph) */}
        <div className="lg:col-span-6 xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Container 1: Discourse Consensus */}
          <div className="p-4 rounded-[22px] bg-slate-50/80 dark:bg-[#13171C] border border-slate-200/80 dark:border-[#2B323D] shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                Consensus
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${consensusMetric.levelColor}`}>
                {consensusMetric.label}
              </span>
            </div>
            <div>
              <div className="text-[24px] font-black font-mono text-slate-900 dark:text-white tracking-tight">
                {consensusMetric.dominantPct.toFixed(1)}%
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {consensusDescription}
              </p>
            </div>
          </div>

          {/* Container 2: Polarity Volatility */}
          <div className="p-4 rounded-[22px] bg-slate-50/80 dark:bg-[#13171C] border border-slate-200/80 dark:border-[#2B323D] shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-500" />
                Volatility
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800/40">
                {volatilityMetric.rating} Drift
              </span>
            </div>
            <div>
              <div className="text-[24px] font-black font-mono text-slate-900 dark:text-white tracking-tight">
                {volatilityMetric.stdDev.toFixed(2)} <span className="text-[12px] font-normal text-slate-400 font-sans">σ</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {volatilityDescription}
              </p>
            </div>
          </div>

          {/* Container 3: Mean Polarity Index */}
          <div className="p-4 rounded-[22px] bg-slate-50/80 dark:bg-[#13171C] border border-slate-200/80 dark:border-[#2B323D] shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-purple-500" />
                Mean Polarity
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${polarityStatus.color}`}>
                {polarityStatus.label}
              </span>
            </div>
            <div>
              <div className="text-[24px] font-black font-mono text-slate-900 dark:text-white tracking-tight">
                {netScore > 0 ? '+' : ''}{netScore.toFixed(3)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {polarityDescription}
              </p>
            </div>
          </div>

          {/* Container 4: Inference Coverage */}
          <div className="p-4 rounded-[22px] bg-slate-50/80 dark:bg-[#13171C] border border-slate-200/80 dark:border-[#2B323D] shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Coverage
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/40">
                100% Inferred
              </span>
            </div>
            <div>
              <div className="text-[24px] font-black font-mono text-slate-900 dark:text-white tracking-tight">
                {totalEvaluated} <span className="text-[13px] font-normal text-slate-400 font-sans">msgs</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {coverageDescription}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Information Strip: Proportional Spectrum & Analytical Synthesis */}
      <div className="pt-2 border-t border-slate-100 dark:border-[#252B32] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[12px]">
          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-amber-500" />
            <span>Categorical Distribution Spectrum</span>
          </span>
          <div className="flex items-center gap-4 text-[11.5px] font-mono">
            <span className="text-blue-600 dark:text-blue-400 font-bold">
              Neutral: {neuRatio.toFixed(1)}% ({Math.round((neuRatio / 100) * totalEvaluated)} msgs)
            </span>
            <span className="text-rose-600 dark:text-rose-400 font-bold">
              Negative: {negRatio.toFixed(1)}% ({Math.round((negRatio / 100) * totalEvaluated)} msgs)
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              Positive: {posRatio.toFixed(1)}% ({Math.round((posRatio / 100) * totalEvaluated)} msgs)
            </span>
          </div>
        </div>

        {/* Proportional Segmented Bar */}
        <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex shadow-inner">
          {neuRatio > 0 && (
            <div
              style={{ width: `${neuRatio}%` }}
              className="bg-blue-500 h-full transition-all duration-500"
              title={`Neutral: ${neuRatio.toFixed(1)}%`}
            />
          )}
          {negRatio > 0 && (
            <div
              style={{ width: `${negRatio}%` }}
              className="bg-rose-500 h-full transition-all duration-500"
              title={`Negative: ${negRatio.toFixed(1)}%`}
            />
          )}
          {posRatio > 0 && (
            <div
              style={{ width: `${posRatio}%` }}
              className="bg-emerald-500 h-full transition-all duration-500"
              title={`Positive: ${posRatio.toFixed(1)}%`}
            />
          )}
        </div>

        {/* Synthesis Callout */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-[18px] bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-[12px] text-amber-900 dark:text-amber-200">
          <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <span className="font-bold">Analytic Takeaway:</span> {analyticTakeaway}
          </p>
        </div>
      </div>
    </section>
  );
};
