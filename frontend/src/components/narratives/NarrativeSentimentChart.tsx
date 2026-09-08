import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  Smile,
  Meh,
  Frown,
  RefreshCw,
  AlertTriangle,
  Info,
} from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { EChartBase } from '../ui/charts/EChartBase';
import { telemetryApi } from '../../services/telemetryApi';
import { NarrativeSentimentData, SentimentBucket } from '../../types/api';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';

export interface NarrativeSentimentChartProps {
  narrativeId: string;
  className?: string;
}

export const NarrativeSentimentChart: React.FC<NarrativeSentimentChartProps> = ({
  narrativeId,
  className = '',
}) => {
  const { isDark } = useTheme();

  const [sentimentData, setSentimentData] = useState<NarrativeSentimentData | null>(null);
  const [bucketSize, setBucketSize] = useState<'1h' | '6h' | '1d'>('1d');
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchSentiment = useCallback(async () => {
    if (!narrativeId) return;
    setIsLoading(true);
    setIsError(false);
    setErrorMessage('');

    try {
      const res = await telemetryApi.getNarrativeSentiment(narrativeId, bucketSize);
      setSentimentData(res.data);
    } catch (err: any) {
      console.error('Failed to load narrative sentiment series:', err);
      setIsError(true);
      setErrorMessage(err.message || 'Failed to retrieve narrative sentiment series from backend.');
    } finally {
      setIsLoading(false);
    }
  }, [narrativeId, bucketSize]);

  useEffect(() => {
    fetchSentiment();
  }, [fetchSentiment]);

  // ECharts dual-axis option: stacked volume bars + mean polarity score curve
  const chartOption = useMemo<EChartsOption>(() => {
    if (!sentimentData || !sentimentData.time_series || sentimentData.time_series.length === 0) {
      return {};
    }

    const series = sentimentData.time_series;

    const xCategories = series.map((b: SentimentBucket) => {
      try {
        const d = new Date(b.bucket_start_utc);
        if (bucketSize === '1h' || bucketSize === '6h') {
          return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      } catch {
        return b.bucket_start_utc;
      }
    });

    const positiveCounts = series.map((b: SentimentBucket) => b.positive);
    const neutralCounts = series.map((b: SentimentBucket) => b.neutral);
    const negativeCounts = series.map((b: SentimentBucket) => b.negative);
    const polarityScores = series.map((b: SentimentBucket) => (b.net_sentiment !== null ? Number(b.net_sentiment.toFixed(3)) : 0));

    const textColor = isDark ? '#94A3B8' : '#64748B';
    const gridBorderColor = isDark ? '#252B32' : '#E2E8F0';

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
          shadowStyle: {
            color: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
          },
        },
        backgroundColor: isDark ? '#1C232B' : '#FFFFFF',
        borderColor: isDark ? '#2E3844' : '#E2E8F0',
        textStyle: {
          color: isDark ? '#F8FAFC' : '#111727',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: 12,
        },
        padding: [10, 14],
        extraCssText: 'border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);',
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const b = series[idx];
          if (!b) return '';

          const total = b.positive + b.neutral + b.negative;
          const posPct = total > 0 ? ((b.positive / total) * 100).toFixed(1) : '0.0';
          const neuPct = total > 0 ? ((b.neutral / total) * 100).toFixed(1) : '0.0';
          const negPct = total > 0 ? ((b.negative / total) * 100).toFixed(1) : '0.0';
          const score = b.net_sentiment !== null ? b.net_sentiment : 0.0;

          return `
            <div style="font-weight: 700; margin-bottom: 6px; font-size: 13px;">${params[0].axisValue}</div>
            <div style="font-size: 11px; color: ${textColor}; margin-bottom: 8px;">
              UTC Window: ${new Date(b.bucket_start_utc).toUTCString().slice(5, 22)}
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 3px;">
              <span style="color: #10B981; font-weight: 600;">● Positive:</span>
              <span style="font-family: monospace;"><b>${b.positive}</b> (${posPct}%)</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 3px;">
              <span style="color: #64748B; font-weight: 600;">● Neutral:</span>
              <span style="font-family: monospace;"><b>${b.neutral}</b> (${neuPct}%)</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 6px;">
              <span style="color: #F43F5E; font-weight: 600;">● Negative:</span>
              <span style="font-family: monospace;"><b>${b.negative}</b> (${negPct}%)</span>
            </div>
            <div style="border-top: 1px solid ${gridBorderColor}; padding-top: 5px; display: flex; justify-content: space-between;">
              <span style="font-weight: 600;">Mean Polarity:</span>
              <span style="font-family: monospace; font-weight: 700; color: ${score > 0 ? '#10B981' : score < 0 ? '#F43F5E' : textColor}">
                ${score > 0 ? '+' : ''}${score.toFixed(3)}
              </span>
            </div>
          `;
        },
      },
      legend: {
        top: 0,
        right: 0,
        textStyle: {
          color: textColor,
          fontSize: 11,
          fontFamily: 'monospace',
        },
        icon: 'roundRect',
        itemWidth: 12,
        itemHeight: 12,
        data: ['Positive', 'Neutral', 'Negative', 'Polarity Score'],
      },
      grid: {
        left: '2%',
        right: '4%',
        bottom: '8%',
        top: '16%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xCategories,
        axisLine: { lineStyle: { color: gridBorderColor } },
        axisLabel: {
          color: textColor,
          fontSize: 11,
          fontFamily: 'monospace',
          rotate: xCategories.length > 8 ? 30 : 0,
        },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Messages',
          nameTextStyle: {
            color: textColor,
            fontSize: 11,
            fontFamily: 'monospace',
            padding: [0, 0, 0, -10],
          },
          axisLine: { show: false },
          splitLine: { lineStyle: { color: gridBorderColor, type: 'dashed' } },
          axisLabel: { color: textColor, fontSize: 11, fontFamily: 'monospace' },
        },
        {
          type: 'value',
          name: 'Polarity',
          min: -1.0,
          max: 1.0,
          interval: 0.5,
          nameTextStyle: {
            color: textColor,
            fontSize: 11,
            fontFamily: 'monospace',
            padding: [0, 0, 0, 10],
          },
          axisLine: { show: false },
          splitLine: { show: false },
          axisLabel: {
            color: textColor,
            fontSize: 11,
            fontFamily: 'monospace',
            formatter: (v: number) => (v > 0 ? `+${v.toFixed(1)}` : `${v.toFixed(1)}`),
          },
        },
      ],
      series: [
        {
          name: 'Positive',
          type: 'bar',
          stack: 'volume',
          data: positiveCounts,
          itemStyle: {
            color: '#10B981',
            borderRadius: [0, 0, 0, 0],
          },
          barMaxWidth: 32,
        },
        {
          name: 'Neutral',
          type: 'bar',
          stack: 'volume',
          data: neutralCounts,
          itemStyle: {
            color: isDark ? '#4B5563' : '#94A3B8',
            borderRadius: [0, 0, 0, 0],
          },
          barMaxWidth: 32,
        },
        {
          name: 'Negative',
          type: 'bar',
          stack: 'volume',
          data: negativeCounts,
          itemStyle: {
            color: '#F43F5E',
            borderRadius: [3, 3, 0, 0],
          },
          barMaxWidth: 32,
        },
        {
          name: 'Polarity Score',
          type: 'line',
          yAxisIndex: 1,
          data: polarityScores,
          smooth: true,
          showSymbol: series.length < 25,
          symbolSize: 6,
          itemStyle: { color: '#3B82F6' },
          lineStyle: { width: 2.5, color: '#3B82F6' },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              {
                yAxis: 0,
                lineStyle: { color: isDark ? '#374151' : '#CBD5E1', type: 'dashed', width: 1.5 },
                label: { show: false },
              },
            ],
          },
        },
      ],
    };
  }, [sentimentData, bucketSize, isDark]);

  const summary = sentimentData?.summary;
  const totalEvaluated = summary?.evaluated_messages || 0;
  const posRatio = summary?.positive_ratio !== null && summary?.positive_ratio !== undefined ? summary.positive_ratio * 100 : 0;
  const neuRatio = summary?.neutral_ratio !== null && summary?.neutral_ratio !== undefined ? summary.neutral_ratio * 100 : 0;
  const negRatio = summary?.negative_ratio !== null && summary?.negative_ratio !== undefined ? summary.negative_ratio * 100 : 0;
  const netScore = (posRatio - negRatio) / 100;

  if (isLoading) {
    return (
      <div className={`p-6 md:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-4 ${className}`}>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252B32] pb-4">
          <div className="h-5 w-44 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
          <div className="h-7 w-28 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
        </div>
        <div className="h-[280px] rounded-[24px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-100 dark:border-[#20262E] flex flex-col items-center justify-center space-y-3">
          <div className="w-7 h-7 border-3 border-[#2F65F6] border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] font-mono text-[#8591A5] dark:text-slate-400">
            Evaluating narrative constituent sentiment series...
          </span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`p-6 md:p-8 rounded-[30px] border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 shadow-xs space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <h3 className="text-[16px] font-bold text-rose-900 dark:text-rose-200">
              Narrative Sentiment Series Unavailable
            </h3>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchSentiment} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Retry Sentiment
          </Button>
        </div>
        <p className="text-[13px] text-rose-700 dark:text-rose-300">
          {errorMessage || 'Narrative sentiment series could not be loaded.'}
        </p>
      </div>
    );
  }

  const hasBuckets = sentimentData && sentimentData.time_series && sentimentData.time_series.length > 0 && totalEvaluated > 0;

  return (
    <section className={`p-6 md:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-6 transition-all ${className}`}>
      {/* 1. Header & Bucket Interval Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-[#252B32] pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <TrendingUp className="w-5 h-5 text-[#2F65F6]" />
            <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100 tracking-tight">
              Narrative Evidence Sentiment Over Time
            </h3>
            <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-900/40">
              Constituent Cluster Evidence
            </span>
          </div>
          <p className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-0.5">
            Chronological RoBERTa sentiment aggregation derived strictly from narrative-associated messages
          </p>
        </div>

        {/* Bucket Interval Toggle - Crextio Pill Capsule Dock */}
        <div className="flex items-center gap-1 bg-[#F5F1E5] dark:bg-[#1E2229] p-1 rounded-full border border-[#E5DFD3] dark:border-[#2D333F] self-start sm:self-center shadow-xs">
          <button
            type="button"
            onClick={() => setBucketSize('1h')}
            className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold transition-all cursor-pointer ${
              bucketSize === '1h'
                ? 'bg-white dark:bg-[#252B35] text-[#111727] dark:text-white shadow-xs'
                : 'text-[#8591A5] hover:text-[#111727] dark:hover:text-slate-200'
            }`}
          >
            1h
          </button>
          <button
            type="button"
            onClick={() => setBucketSize('6h')}
            className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold transition-all cursor-pointer ${
              bucketSize === '6h'
                ? 'bg-white dark:bg-[#252B35] text-[#111727] dark:text-white shadow-xs'
                : 'text-[#8591A5] hover:text-[#111727] dark:hover:text-slate-200'
            }`}
          >
            6h
          </button>
          <button
            type="button"
            onClick={() => setBucketSize('1d')}
            className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold transition-all cursor-pointer ${
              bucketSize === '1d'
                ? 'bg-white dark:bg-[#252B35] text-[#111727] dark:text-white shadow-xs'
                : 'text-[#8591A5] hover:text-[#111727] dark:hover:text-slate-200'
            }`}
          >
            1d
          </button>
        </div>
      </div>

      {/* 2. Sentiment Metrics Breakdown */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-4 rounded-[20px] bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200/60 dark:border-emerald-900/40 transition-all hover:scale-[1.01]">
            <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
              <Smile className="w-3.5 h-3.5" /> Positive
            </div>
            <div className="text-[20px] font-extrabold text-emerald-900 dark:text-emerald-200 font-mono mt-1">
              {posRatio.toFixed(1)}%
            </div>
            <div className="text-[11px] font-mono text-emerald-700/80 dark:text-emerald-400">
              {Math.round((posRatio / 100) * totalEvaluated).toLocaleString()} msgs
            </div>
          </div>

          <div className="p-4 rounded-[20px] bg-[#FAFBFD] dark:bg-[#151921] border border-slate-200/80 dark:border-[#282F3A] transition-all hover:scale-[1.01]">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider">
              <Meh className="w-3.5 h-3.5" /> Neutral
            </div>
            <div className="text-[20px] font-extrabold text-slate-800 dark:text-slate-200 font-mono mt-1">
              {neuRatio.toFixed(1)}%
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {Math.round((neuRatio / 100) * totalEvaluated).toLocaleString()} msgs
            </div>
          </div>

          <div className="p-4 rounded-[20px] bg-rose-50/60 dark:bg-rose-950/25 border border-rose-200/60 dark:border-rose-900/40 transition-all hover:scale-[1.01]">
            <div className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300 text-[11px] font-bold uppercase tracking-wider">
              <Frown className="w-3.5 h-3.5" /> Negative
            </div>
            <div className="text-[20px] font-extrabold text-rose-900 dark:text-rose-200 font-mono mt-1">
              {negRatio.toFixed(1)}%
            </div>
            <div className="text-[11px] font-mono text-rose-700/80 dark:text-rose-400">
              {Math.round((negRatio / 100) * totalEvaluated).toLocaleString()} msgs
            </div>
          </div>

          <div className="p-4 rounded-[20px] bg-blue-50/60 dark:bg-blue-950/25 border border-blue-200/60 dark:border-blue-900/40 transition-all hover:scale-[1.01]">
            <div className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
              Mean Polarity
            </div>
            <div className="text-[20px] font-extrabold text-blue-900 dark:text-blue-200 font-mono mt-1">
              {netScore > 0 ? '+' : ''}
              {netScore.toFixed(3)}
            </div>
            <div className="text-[11px] font-mono text-blue-700/80 dark:text-blue-400">
              [-1.0 to +1.0] scale
            </div>
          </div>

          <div className="p-4 rounded-[20px] bg-[#FAFBFD] dark:bg-[#151921] border border-slate-200/80 dark:border-[#282F3A] col-span-2 sm:col-span-1 transition-all hover:scale-[1.01]">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Evaluated Coverage
            </div>
            <div className="text-[20px] font-extrabold text-[#111727] dark:text-slate-200 font-mono mt-1">
              {totalEvaluated.toLocaleString()}
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              {summary.unassigned_messages > 0 ? `${summary.unassigned_messages} media unassigned` : '100% text evaluated'}
            </div>
          </div>
        </div>
      )}

      {/* 3. Time Series Chart or Truthful Empty State */}
      {hasBuckets ? (
        <div className="pt-2">
          <EChartBase option={chartOption} height={280} />
        </div>
      ) : (
        <div className="h-[200px] rounded-[24px] bg-[#FAFBFD] dark:bg-[#12161C] border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-6 text-center space-y-2">
          <Info className="w-7 h-7 text-[#8591A5]" />
          <h4 className="text-[14px] font-bold text-[#111727] dark:text-slate-200">
            No Sentiment Observations Recorded
          </h4>
          <p className="text-[12px] text-[#8591A5] dark:text-slate-400 max-w-sm">
            Messages associated with this narrative have not been evaluated or consist of non-text media items.
          </p>
        </div>
      )}
    </section>
  );
};
