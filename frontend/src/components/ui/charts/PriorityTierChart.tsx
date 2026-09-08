import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { EChartBase } from './EChartBase';
import { useTheme } from '../../../contexts/ThemeContext';
import { getChartTheme, renderSaaSTooltip } from '../../../utils/chartTokens';

export interface PriorityDistributionData {
  critical: number;
  high: number;
  elevated: number;
  routine: number;
}

export interface PriorityTierChartProps {
  data: PriorityDistributionData | null | undefined;
  isLoading?: boolean;
  className?: string;
}

export const PriorityTierChart: React.FC<PriorityTierChartProps> = ({
  data,
  isLoading = false,
  className = '',
}) => {
  const { isDark } = useTheme();
  const theme = getChartTheme(isDark);

  const total = data
    ? (data.critical || 0) + (data.high || 0) + (data.elevated || 0) + (data.routine || 0)
    : 0;

  const option = useMemo<EChartsOption>(() => {
    const categories = ['Critical (≥0.75)', 'High (0.55–0.74)', 'Elevated (0.35–0.54)', 'Routine (<0.35)'];
    const values = data
      ? [data.critical || 0, data.high || 0, data.elevated || 0, data.routine || 0]
      : [0, 0, 0, 0];

    const colors = [
      theme.critical,
      theme.warning,
      theme.primary,
      theme.neutral,
    ];

    return {
      grid: {
        top: 8,
        bottom: 24,
        left: 130,
        right: 44,
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
          const count = Number(p.value || 0);
          const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';

          return renderSaaSTooltip(
            p.name,
            [
              { label: 'Observed Count', value: `${count.toLocaleString()} msgs`, isMono: true },
              { label: 'Corpus Share', value: `${pct}%`, isMono: true },
            ],
            'Backend 4G composite scoring tier',
            isDark
          );
        },
      },
      xAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: {
          lineStyle: {
            color: theme.gridLineColor,
            type: 'dashed',
          },
        },
        axisLabel: {
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 11,
          color: theme.neutral,
        },
      },
      yAxis: {
        type: 'category',
        data: categories,
        inverse: true,
        axisTick: { show: false },
        axisLine: {
          lineStyle: {
            color: theme.axisLineColor,
          },
        },
        axisLabel: {
          fontFamily: '"IBM Plex Sans", -apple-system, sans-serif',
          fontSize: 11,
          fontWeight: 500,
          color: theme.textSecondary,
        },
      },
      series: [
        {
          name: 'Priority Count',
          type: 'bar',
          data: values.map((val, idx) => ({
            value: val,
            itemStyle: {
              color: colors[idx],
              borderRadius: [0, 6, 6, 0],
            },
          })),
          barWidth: 12,
          animationDuration: 600,
          animationEasing: 'cubicOut',
          animationDelay: (idx: number) => idx * 50,
          emphasis: {
            itemStyle: {
              opacity: 0.9,
            },
          },
          label: {
            show: true,
            position: 'right',
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 11,
            fontWeight: 600,
            color: theme.textMuted,
            formatter: (params: any) => `${params.value}`,
          },
        },
      ],
    };
  }, [data, isDark, total, theme]);

  return (
    <EChartBase
      option={option}
      height="148px"
      isLoading={isLoading}
      isEmpty={total === 0 && !isLoading}
      emptyMessage="No prioritized signals identified in active dataset."
      className={className}
    />
  );
};
