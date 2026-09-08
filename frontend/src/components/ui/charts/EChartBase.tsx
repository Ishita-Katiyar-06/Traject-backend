import React, { useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTheme } from '../../../contexts/ThemeContext';
import { getChartTheme } from '../../../utils/chartTokens';
import { Skeleton } from '../Skeleton';
import { AlertTriangle, BarChart2 } from 'lucide-react';
import { usePrefersReducedMotion } from '../../../utils/motion';

export interface EChartBaseProps {
  option: EChartsOption;
  height?: string | number;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  isError?: boolean;
  errorMessage?: string;
  className?: string;
  onEvents?: Record<string, (params: any) => void>;
}

export const EChartBase: React.FC<EChartBaseProps> = ({
  option,
  height = '240px',
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'No activity data available for the selected period.',
  isError = false,
  errorMessage = 'Failed to load telemetry visualization.',
  className = '',
  onEvents,
}) => {
  const { isDark } = useTheme();
  const prefersReduced = usePrefersReducedMotion();
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = getChartTheme(isDark);

  // Responsive observation: resize chart smoothly on window or card container width shifts
  useEffect(() => {
    const handleResize = () => {
      chartRef.current?.getEchartsInstance()?.resize();
    };

    window.addEventListener('resize', handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, []);

  if (isLoading) {
    return (
      <div
        style={{ height }}
        className={`w-full rounded-[20px] p-5 flex flex-col justify-between bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] transition-colors ${className}`}
        role="status"
        aria-label="Loading chart telemetry"
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32 rounded-full" />
          <Skeleton className="h-3 w-20 rounded-full" />
        </div>
        <div className="flex items-end gap-2 h-3/4 w-full pt-4">
          <Skeleton className="h-[40%] flex-1 rounded-t-[6px]" />
          <Skeleton className="h-[75%] flex-1 rounded-t-[6px]" />
          <Skeleton className="h-[55%] flex-1 rounded-t-[6px]" />
          <Skeleton className="h-[90%] flex-1 rounded-t-[6px]" />
          <Skeleton className="h-[65%] flex-1 rounded-t-[6px]" />
          <Skeleton className="h-[45%] flex-1 rounded-t-[6px]" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        style={{ height }}
        className={`w-full rounded-[20px] p-6 flex flex-col items-center justify-center text-center bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 ${className}`}
      >
        <div className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center mb-2.5">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
        </div>
        <span className="text-[13px] font-semibold text-rose-900 dark:text-rose-200">
          {errorMessage}
        </span>
        <span className="text-[11px] text-rose-700/80 dark:text-rose-400/80 mt-1 font-mono">
          Visualization telemetry uncomputed or offline
        </span>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div
        style={{ height }}
        className={`w-full rounded-[20px] p-6 flex flex-col items-center justify-center text-center bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] text-[#8591A5] dark:text-[#94A3B8] space-y-2 ${className}`}
      >
        <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center">
          <BarChart2 className="w-4 h-4 text-[#8591A5] dark:text-[#94A3B8]" />
        </div>
        <p className="text-[12px] font-medium font-sans max-w-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
          {emptyMessage}
        </p>
      </div>
    );
  }

  // Guaranteed zero-clipping body portal with Behance soft card aesthetic
  const baseTooltip = {
    appendTo: 'body',
    appendToBody: true,
    confine: false,
    backgroundColor: theme.tooltipBg,
    borderColor: theme.tooltipBorder,
    borderWidth: 1,
    textStyle: {
      color: theme.tooltipText,
      fontFamily: '"IBM Plex Sans", -apple-system, sans-serif',
      fontSize: 12,
    },
    padding: [10, 14],
    extraCssText:
      'box-shadow: 0 10px 25px -4px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04); border-radius: 12px; z-index: 10002; pointer-events: none; backdrop-filter: blur(8px);',
  };

  const incomingTooltip = (option.tooltip as Record<string, any>) || {};

  const mergedOption: EChartsOption = {
    animation: !prefersReduced,
    animationDuration: 600,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 450,
    animationEasingUpdate: 'cubicInOut',
    ...option,
    textStyle: {
      fontFamily: '"IBM Plex Sans", -apple-system, sans-serif',
      color: theme.textMuted,
      fontSize: 12,
      ...((option.textStyle as object) || {}),
    },
    tooltip: {
      ...baseTooltip,
      ...incomingTooltip,
      appendTo: 'body',
      appendToBody: true,
      confine: false,
    },
  };

  return (
    <div ref={containerRef} className={`w-full ${className}`}>
      <ReactECharts
        ref={chartRef}
        option={mergedOption}
        style={{ height, width: '100%' }}
        theme={isDark ? 'dark' : undefined}
        notMerge={true}
        lazyUpdate={true}
        onEvents={onEvents}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
};
