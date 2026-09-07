import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { EChartBase } from './EChartBase';
import { useTheme } from '../../../contexts/ThemeContext';
import { TopicKeywordResponse } from '../../../types/api';

export interface KeywordScoresBarChartProps {
  keywords: TopicKeywordResponse[];
  isLoading?: boolean;
  maxDisplay?: number;
  className?: string;
}

export const KeywordScoresBarChart: React.FC<KeywordScoresBarChartProps> = ({
  keywords,
  isLoading = false,
  maxDisplay = 8,
  className = '',
}) => {
  const { isDark } = useTheme();

  // Take top N keywords, reversed for horizontal bar chart display (highest on top)
  const sliced = useMemo(() => keywords.slice(0, maxDisplay).reverse(), [keywords, maxDisplay]);

  const option = useMemo<EChartsOption>(() => {
    const names = sliced.map((k) => `#${k.keyword}`);
    const scores = sliced.map((k) => k.score);

    return {
      grid: {
        top: 10,
        bottom: 24,
        left: 110,
        right: 48,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const score = Number(p.value || 0);
          return `
            <div style="font-weight: 600; margin-bottom: 4px; color: ${isDark ? '#F8FAFC' : '#111727'};">${p.name}</div>
            <div style="display: flex; justify-content: space-between; gap: 16px; font-family: 'IBM Plex Mono', monospace; font-size: 12px;">
              <span style="color: #64748B;">c-TF-IDF Score:</span>
              <strong>${score.toFixed(4)}</strong>
            </div>
            <div style="font-size: 11px; color: #8591A5; margin-top: 4px;">
              Lexical cluster importance weighting
            </div>
          `;
        },
      },
      xAxis: {
        type: 'value',
        max: 1.0,
        min: 0,
        splitLine: {
          lineStyle: {
            color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            type: 'dashed',
          },
        },
        axisLabel: {
          color: isDark ? '#94A3B8' : '#8591A5',
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 10,
        },
      },
      yAxis: {
        type: 'category',
        data: names,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: isDark ? '#CBD5E1' : '#475569',
          fontFamily: '"IBM Plex Mono", monospace',
          fontWeight: 500,
          fontSize: 11,
        },
      },
      series: [
        {
          name: 'c-TF-IDF Keyword Score',
          type: 'bar',
          data: scores.map((val) => ({
            value: val,
            itemStyle: {
              color: '#2F65F6',
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barWidth: 12,
          label: {
            show: true,
            position: 'right',
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 11,
            color: isDark ? '#94A3B8' : '#64748B',
            formatter: (params: any) => Number(params.value).toFixed(2),
          },
        },
      ],
    };
  }, [sliced, isDark]);

  return (
    <EChartBase
      option={option}
      height={`${Math.max(160, sliced.length * 28 + 40)}px`}
      isLoading={isLoading}
      isEmpty={sliced.length === 0 && !isLoading}
      emptyMessage="No c-TF-IDF representative keywords extracted for this cluster."
      className={className}
    />
  );
};
