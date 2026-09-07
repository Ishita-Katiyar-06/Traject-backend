import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { EChartBase } from './EChartBase';
import { useTheme } from '../../../contexts/ThemeContext';

export interface SentimentDonutChartProps {
  positiveRatio: number | null | undefined;
  neutralRatio: number | null | undefined;
  negativeRatio: number | null | undefined;
  evaluatedCount?: number;
  modelId?: string | null;
  isLoading?: boolean;
  className?: string;
}

export const SentimentDonutChart: React.FC<SentimentDonutChartProps> = ({
  positiveRatio,
  neutralRatio,
  negativeRatio,
  evaluatedCount = 0,
  modelId,
  isLoading = false,
  className = '',
}) => {
  const { isDark } = useTheme();

  const isAvailable =
    evaluatedCount > 0 &&
    typeof positiveRatio === 'number' &&
    typeof neutralRatio === 'number' &&
    typeof negativeRatio === 'number';

  const option = useMemo<EChartsOption>(() => {
    const chartData = [
      {
        name: 'Positive',
        value: Math.round((positiveRatio ?? 0) * 1000) / 10,
        itemStyle: { color: '#10B981' }, // Emerald-500
      },
      {
        name: 'Neutral',
        value: Math.round((neutralRatio ?? 0) * 1000) / 10,
        itemStyle: { color: isDark ? '#64748B' : '#94A3B8' }, // Slate-400
      },
      {
        name: 'Negative',
        value: Math.round((negativeRatio ?? 0) * 1000) / 10,
        itemStyle: { color: '#FF6D5A' }, // Rose/Coral-500
      },
    ];

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => `
          <div style="font-weight: 600; margin-bottom: 4px; color: ${isDark ? '#F8FAFC' : '#111727'};">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${params.color}; margin-right: 6px;"></span>
            ${params.name} Sentiment
          </div>
          <div style="display: flex; justify-content: space-between; gap: 16px; font-family: 'IBM Plex Mono', monospace; font-size: 12px;">
            <span style="color: #64748B;">Corpus Share:</span>
            <strong>${params.value}%</strong>
          </div>
        `,
      },
      legend: {
        orient: 'horizontal',
        bottom: 0,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: {
          fontFamily: '"IBM Plex Sans", sans-serif',
          fontSize: 12,
          color: isDark ? '#CBD5E1' : '#475569',
        },
      },
      series: [
        {
          name: 'Sentiment Share',
          type: 'pie',
          radius: ['52%', '76%'],
          center: ['50%', '42%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderColor: isDark ? '#171C22' : '#FFFFFF',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            scale: true,
            scaleSize: 4,
          },
          data: chartData,
        },
      ],
    };
  }, [positiveRatio, neutralRatio, negativeRatio, isDark]);

  return (
    <div className={`space-y-3 ${className}`}>
      <EChartBase
        option={option}
        height="160px"
        isLoading={isLoading}
        isEmpty={!isAvailable && !isLoading}
        emptyMessage="Sentiment inference is unavailable for this corpus. Values are preserved as uncomputed rather than fabricated."
      />
      {isAvailable && modelId && (
        <div className="text-center font-mono text-[11px] text-[#8591A5] dark:text-[#7A8699]">
          Model: <span className="text-[#475569] dark:text-[#94A3B8] font-medium">{modelId}</span> • {evaluatedCount} msgs
        </div>
      )}
    </div>
  );
};
