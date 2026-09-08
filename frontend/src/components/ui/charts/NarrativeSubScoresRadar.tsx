import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { EChartBase } from './EChartBase';
import { useTheme } from '../../../contexts/ThemeContext';
import { getChartTheme, renderSaaSTooltip } from '../../../utils/chartTokens';
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
  const theme = getChartTheme(isDark);

  const option = useMemo<EChartsOption>(() => {
    const spread = subScores?.spread_score ?? 0;
    const coord = subScores?.coordination_score ?? 0;
    const reach = subScores?.reach_score ?? 0;
    const friction = subScores?.friction_score ?? 0;

    const indicatorData = [
      { name: 'Spread (30%)', max: 1.0 },
      { name: 'Coordination (30%)', max: 1.0 },
      { name: `${REACH_WORDING.primary} (20%)`, max: 1.0 },
      { name: 'Friction (20%)', max: 1.0 },
    ];

    const tooltipItems = [
      { label: 'Spread Score', value: spread.toFixed(4), color: theme.primary, isMono: true },
      { label: 'Coordination Signal', value: coord.toFixed(4), color: theme.warning, isMono: true },
      { label: 'Observed Reach', value: reach.toFixed(4), color: theme.tertiary, isMono: true },
      { label: 'Friction Counter', value: friction.toFixed(4), color: theme.neutral, isMono: true },
    ];

    if (typeof priorityScore === 'number') {
      tooltipItems.push({
        label: 'Composite Score',
        value: priorityScore.toFixed(4),
        color: theme.primary,
        isMono: true,
      });
    }

    return {
      tooltip: {
        trigger: 'item',
        formatter: () =>
          renderSaaSTooltip(
            'Priority Signal Sub-Scores Profile',
            tooltipItems,
            '4G multidimensional narrative vector',
            isDark
          ),
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
          fontWeight: 500,
          color: theme.textSecondary,
        },
        splitLine: {
          lineStyle: {
            color: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          },
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: isDark
              ? ['rgba(255, 255, 255, 0.01)', 'rgba(255, 255, 255, 0.025)']
              : ['rgba(0, 0, 0, 0.01)', 'rgba(0, 0, 0, 0.02)'],
          },
        },
        axisLine: {
          lineStyle: {
            color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          },
        },
      },
      series: [
        {
          name: '4G Sub-Scores',
          type: 'radar',
          animationDuration: 750,
          animationEasing: 'cubicOut',
          data: [
            {
              value: [spread, coord, reach, friction],
              name: 'Observed Telemetry',
              symbol: 'circle',
              symbolSize: 5,
              itemStyle: {
                color: theme.primary,
              },
              lineStyle: {
                width: 2,
                color: theme.primary,
              },
              areaStyle: {
                color: isDark ? 'rgba(88, 120, 199, 0.20)' : 'rgba(47, 101, 246, 0.16)',
              },
            },
          ],
        },
      ],
    };
  }, [subScores, priorityScore, isDark, theme]);

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
