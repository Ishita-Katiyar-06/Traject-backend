import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { EChartBase } from './EChartBase';
import { useTheme } from '../../../contexts/ThemeContext';

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

  const total = data
    ? (data.critical || 0) + (data.high || 0) + (data.elevated || 0) + (data.routine || 0)
    : 0;

  const option = useMemo<EChartsOption>(() => {
    const categories = ['Critical (≥0.75)', 'High (0.55–0.74)', 'Elevated (0.35–0.54)', 'Routine (<0.35)'];
    const values = data
      ? [data.critical || 0, data.high || 0, data.elevated || 0, data.routine || 0]
      : [0, 0, 0, 0];

    const colors = [
      '#E11D48', // Critical (Rose-600)
      '#D97706', // High (Amber-600)
      '#2563EB', // Elevated (Blue-600)
      '#64748B', // Routine (Slate-500)
    ];

    return {
    grid: {
      top: 10,
      bottom: 24,
      left: 120,
      right: 36,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        const count = Number(p.value || 0);
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        return `
          <div style="font-weight: 600; margin-bottom: 4px; color: ${isDark ? '#F8FAFC' : '#111727'};">${p.name}</div>
          <div style="display: flex; justify-content: space-between; gap: 16px; font-family: 'IBM Plex Mono', monospace; font-size: 12px;">
            <span style="color: #64748B;">Observed Count:</span>
            <strong>${count} msgs</strong>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 16px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; margin-top: 2px;">
            <span style="color: #64748B;">Distribution:</span>
            <strong>${pct}%</strong>
          </div>
        `;
      },
    },
    xAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: {
        lineStyle: {
          color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          type: 'dashed',
        },
      },
      axisLabel: {
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: 11,
        color: isDark ? '#94A3B8' : '#8591A5',
      },
    },
    yAxis: {
      type: 'category',
      data: categories,
      inverse: true,
      axisTick: { show: false },
      axisLine: {
        lineStyle: {
          color: isDark ? '#2D3748' : '#E2E8F0',
        },
      },
      axisLabel: {
        fontFamily: '"IBM Plex Sans", -apple-system, sans-serif',
        fontSize: 11,
        color: isDark ? '#CBD5E1' : '#475569',
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
        barWidth: 14,
        label: {
          show: true,
          position: 'right',
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 11,
          color: isDark ? '#94A3B8' : '#64748B',
          formatter: (params: any) => `${params.value}`,
        },
      },
    ],
  };
  }, [data, isDark, total]);

  return (
    <EChartBase
      option={option}
      height="140px"
      isLoading={isLoading}
      isEmpty={total === 0 && !isLoading}
      emptyMessage="No prioritized signals identified in active dataset."
      className={className}
    />
  );
};
