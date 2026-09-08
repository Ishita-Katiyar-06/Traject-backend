import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { EChartBase } from './EChartBase';
import { useTheme } from '../../../contexts/ThemeContext';
import { getChartTheme, renderSaaSTooltip } from '../../../utils/chartTokens';
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
  const theme = getChartTheme(isDark);

  // Take top N keywords, reversed for horizontal bar chart display (highest on top)
  const sliced = useMemo(() => keywords.slice(0, maxDisplay).reverse(), [keywords, maxDisplay]);

  const option = useMemo<EChartsOption>(() => {
    const names = sliced.map((k) => `#${k.keyword}`);
    const scores = sliced.map((k) => k.score);

    return {
      grid: {
        top: 8,
        bottom: 24,
        left: 110,
        right: 48,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
          shadowStyle: {
            color: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(47, 101, 246, 0.04)',
          },
        },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const score = Number(p.value || 0);
          return renderSaaSTooltip(
            p.name,
            [
              {
                label: 'c-TF-IDF Score',
                value: score.toFixed(4),
                color: theme.primary,
                isMono: true,
              },
            ],
            'Lexical cluster importance weighting',
            isDark
          );
        },
      },
      xAxis: {
        type: 'value',
        max: 1.0,
        min: 0,
        splitLine: {
          lineStyle: {
            color: theme.gridLineColor,
            type: 'dashed',
          },
        },
        axisLabel: {
          color: theme.neutral,
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
          color: theme.textSecondary,
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
              color: theme.primary,
              borderRadius: [0, 6, 6, 0],
            },
          })),
          barWidth: 12,
          animationDuration: 600,
          animationEasing: 'cubicOut',
          animationDelay: (idx: number) => idx * 40,
          emphasis: {
            itemStyle: {
              color: isDark ? '#6E8ED4' : '#2152DE',
            },
          },
          label: {
            show: true,
            position: 'right',
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 11,
            color: theme.textMuted,
            formatter: (params: any) => Number(params.value).toFixed(2),
          },
        },
      ],
    };
  }, [sliced, isDark, theme]);

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
