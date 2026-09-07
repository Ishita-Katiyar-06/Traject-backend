import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { EChartBase } from './EChartBase';
import { useTheme } from '../../../contexts/ThemeContext';
import { REACH_WORDING } from '../../../utils/telemetryFormatters';

export interface NarrativeSubScoresData {
  spread_score: number;
  coordination_score: number;
  reach_score: number;
  friction_score: number;
}

export interface NarrativeSubScoresRadarProps {
  subScores: NarrativeSubScoresData | null | undefined;
  priorityScore?: number;
  isLoading?: boolean;
  className?: string;
}

export const NarrativeSubScoresRadar: React.FC<NarrativeSubScoresRadarProps> = ({
  subScores,
  priorityScore,
  isLoading = false,
  className = '',
}) => {
  const { isDark } = useTheme();

  const option = useMemo<EChartsOption>(() => {
    const spread = subScores?.spread_score ?? 0;
    const coord = subScores?.coordination_score ?? 0;
    const reach = subScores?.reach_score ?? 0;
    const friction = subScores?.friction_score ?? 0;

    const indicatorData = [
      { name: 'Spread (30%)', max: 1.0 },
      { name: `Coordination (30%)`, max: 1.0 },
      { name: `${REACH_WORDING.primary} (20%)`, max: 1.0 },
      { name: 'Friction (20%)', max: 1.0 },
    ];

    return {
    tooltip: {
      trigger: 'item',
      formatter: () => `
        <div style="font-weight: 600; margin-bottom: 6px; color: ${isDark ? '#F8FAFC' : '#111727'};">
          Priority Signal Sub-Scores Profile
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px; font-family: 'IBM Plex Mono', monospace; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; gap: 16px;">
            <span style="color: #64748B;">Spread Score:</span>
            <strong>${spread.toFixed(4)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 16px;">
            <span style="color: #64748B;">Coordination Signal:</span>
            <strong>${coord.toFixed(4)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 16px;">
            <span style="color: #64748B;">Observed Reach:</span>
            <strong>${reach.toFixed(4)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 16px;">
            <span style="color: #64748B;">Friction Counter:</span>
            <strong>${friction.toFixed(4)}</strong>
          </div>
          ${typeof priorityScore === 'number' ? `
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}; display: flex; justify-content: space-between; gap: 16px;">
            <span style="color: #2F65F6; font-weight: 600;">Composite Score:</span>
            <strong style="color: #2F65F6;">${priorityScore.toFixed(4)}</strong>
          </div>
          ` : ''}
        </div>
      `,
    },
    radar: {
      shape: 'polygon',
      indicator: indicatorData,
      radius: '62%',
      center: ['50%', '52%'],
      splitNumber: 4,
      axisName: {
        fontFamily: '"IBM Plex Sans", -apple-system, sans-serif',
        fontSize: 11,
        color: isDark ? '#94A3B8' : '#475569',
      },
      splitLine: {
        lineStyle: {
          color: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
        },
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: isDark
            ? ['rgba(255, 255, 255, 0.01)', 'rgba(255, 255, 255, 0.03)']
            : ['rgba(0, 0, 0, 0.01)', 'rgba(0, 0, 0, 0.02)'],
        },
      },
      axisLine: {
        lineStyle: {
          color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
    series: [
      {
        name: '4G Sub-Scores',
        type: 'radar',
        data: [
          {
            value: [spread, coord, reach, friction],
            name: 'Observed Telemetry',
            symbol: 'circle',
            symbolSize: 5,
            itemStyle: {
              color: '#2F65F6',
            },
            lineStyle: {
              width: 2,
              color: '#2F65F6',
            },
            areaStyle: {
              color: 'rgba(47, 101, 246, 0.22)',
            },
          },
        ],
      },
    ],
  };
  }, [subScores, isDark]);

  return (
    <EChartBase
      option={option}
      height="200px"
      isLoading={isLoading}
      isEmpty={!subScores && !isLoading}
      emptyMessage="No sub-score dimensions recorded for this narrative candidate."
      className={className}
    />
  );
};
