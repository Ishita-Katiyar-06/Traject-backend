import React, { useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTheme } from '../../../contexts/ThemeContext';
import { Skeleton } from '../Skeleton';
import { AlertTriangle, BarChart2 } from 'lucide-react';

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
  const chartRef = useRef<ReactECharts>(null);

  // Resize chart whenever window or parent dimensions change
  useEffect(() => {
    const handleResize = () => {
      chartRef.current?.getEchartsInstance()?.resize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isLoading) {
    return (
      <div
        style={{ height }}
        className={`w-full rounded-[20px] p-4 flex flex-col justify-center space-y-3 bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] ${className}`}
        role="status"
        aria-label="Loading chart data"
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-full w-full rounded-[14px]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        style={{ height }}
        className={`w-full rounded-[20px] p-6 flex flex-col items-center justify-center text-center bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 ${className}`}
      >
        <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400 mb-2" />
        <span className="text-[13px] font-semibold text-rose-900 dark:text-rose-300">
          {errorMessage}
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
        <BarChart2 className="w-6 h-6 opacity-40" />
        <p className="text-[12px] font-medium font-sans max-w-xs">
          {emptyMessage}
        </p>
      </div>
    );
  }

  // Inject theme-aware typography and styling defaults into the option object
  const mergedOption: EChartsOption = {
    ...option,
    textStyle: {
      fontFamily: '"IBM Plex Sans", -apple-system, sans-serif',
      color: isDark ? '#94A3B8' : '#64748B',
      fontSize: 12,
      ...((option.textStyle as object) || {}),
    },
    tooltip: {
      backgroundColor: isDark ? '#1C232B' : '#FFFFFF',
      borderColor: isDark ? '#2D3748' : '#E2E8F0',
      borderWidth: 1,
      textStyle: {
        color: isDark ? '#F8FAFC' : '#0F172A',
        fontFamily: '"IBM Plex Sans", -apple-system, sans-serif',
        fontSize: 12,
      },
      padding: [8, 12],
      extraCssText: 'box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.1); border-radius: 12px;',
      ...((option.tooltip as object) || {}),
    },
  };

  return (
    <div className={`w-full overflow-hidden ${className}`}>
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
