import React, { useState } from 'react';
import { TopicActivityPoint } from '../../data/mock/topics';
import { useTheme } from '../../contexts/ThemeContext';

export interface TopicActivityChartProps {
  activitySeries: Record<'6h' | '24h' | '7d', TopicActivityPoint[]>;
  className?: string;
}

export const TopicActivityChart: React.FC<TopicActivityChartProps> = ({
  activitySeries,
  className = '',
}) => {
  const { isDark } = useTheme();
  const [timeframe, setTimeframe] = useState<'6h' | '24h' | '7d'>('24h');
  const [hoveredPoint, setHoveredPoint] = useState<TopicActivityPoint | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const data = activitySeries[timeframe] || activitySeries['24h'];

  // Theme-aware palette
  const gridColor = isDark ? '#2A3037' : '#E4E9F5';
  const axisTextColor = isDark ? '#858D98' : '#8591A5';
  const volumeLineColor = isDark ? '#5878C7' : '#2F65F6';
  const volumeAreaColor = isDark ? '#5878C7' : '#2F65F6';
  const baselineColor = isDark ? '#69727D' : '#94A3B8';
  const spikeColor = isDark ? '#E87868' : '#FF6D5A';
  const spikeStroke = isDark ? '#171C22' : '#FFFFFF';
  const crosshairColor = isDark ? '#858D98' : '#2F65F6';
  const dotStroke = isDark ? '#171C22' : '#FFFFFF';

  const width = 1000;
  const height = 240;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVolume = Math.max(...data.map((d) => d.volume), 500);

  const getX = (index: number) => paddingLeft + (index / (data.length - 1)) * chartWidth;
  const getY = (val: number) => paddingTop + chartHeight - (val / maxVolume) * chartHeight;

  const linePoints = data.map((d, i) => `${getX(i)},${getY(d.volume)}`);
  const pathD = `M ${linePoints.join(' L ')}`;

  const baselinePoints = data.map((d, i) => `${getX(i)},${getY(d.baseline)}`);
  const baselineD = `M ${baselinePoints.join(' L ')}`;

  const areaD = `M ${getX(0)},${getY(0)} L ${linePoints.join(' L ')} L ${getX(
    data.length - 1
  )},${getY(0)} Z`;

  // Generate 4 Y-axis ticks
  const yTicks = [
    0,
    Math.round(maxVolume * 0.33),
    Math.round(maxVolume * 0.66),
    Math.round(maxVolume),
  ];

  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-6 shadow-xs select-none ${className}`}>
      {/* Header & Timeframe selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-[17px] font-bold font-sans text-[#111727]">
            Activity Over Time
          </h3>
          <p className="text-[13px] text-[#8591A5] font-normal mt-0.5">
            Measured discussion volume compared against established baseline
          </p>
        </div>

        {/* Timeframe Buttons */}
        <div className="flex items-center gap-1 bg-[#EEF1F8] p-1 rounded-full self-start sm:self-center text-[12px]">
          {(['6h', '24h', '7d'] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => {
                setTimeframe(tf);
                setHoveredPoint(null);
                setHoverX(null);
              }}
              className={`px-3 py-1 rounded-full transition-all duration-150 font-medium ${
                timeframe === tf
                  ? 'bg-white text-[#2F65F6] shadow-xs font-semibold'
                  : 'text-[#64748B] hover:text-[#111727]'
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Viewport */}
      <div className="relative w-full aspect-[25/8] min-h-[190px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible font-sans"
          onMouseLeave={() => {
            setHoveredPoint(null);
            setHoverX(null);
          }}
        >
          {/* Y-axis grid & labels */}
          {yTicks.map((tick, i) => {
            const y = getY(tick);
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke={gridColor}
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  fill={axisTextColor}
                  className="text-[10px] font-medium"
                >
                  {tick.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaD} fill={volumeAreaColor} fillOpacity="0.08" />

          {/* Baseline curve */}
          <path
            d={baselineD}
            fill="none"
            stroke={baselineColor}
            strokeDasharray="4 4"
            strokeWidth="1.2"
          />

          {/* Volume curve */}
          <path
            d={pathD}
            fill="none"
            stroke={volumeLineColor}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Spike markers */}
          {data.map((d, i) => {
            if (d.isSpike) {
              const cx = getX(i);
              const cy = getY(d.volume);
              return (
                <g key={i}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="4.5"
                    fill={spikeColor}
                    stroke={spikeStroke}
                    strokeWidth="2"
                  />
                  <text
                    x={cx}
                    y={cy - 9}
                    textAnchor="middle"
                    fill={spikeColor}
                    className="text-[9px] font-bold font-mono"
                  >
                    PEAK
                  </text>
                </g>
              );
            }
            return null;
          })}

          {/* X-axis tick labels */}
          {data.map((d, i) => {
            const x = getX(i);
            const y = paddingTop + chartHeight;
            return (
              <g key={i}>
                <text
                  x={x}
                  y={y + 18}
                  textAnchor="middle"
                  fill={axisTextColor}
                  className="text-[10px] font-medium"
                >
                  {d.timeLabel}
                </text>
              </g>
            );
          })}

          {/* Hover indicator crosshair */}
          {hoverX !== null && hoveredPoint && (
            <g>
              <line
                x1={hoverX}
                y1={paddingTop}
                x2={hoverX}
                y2={paddingTop + chartHeight}
                stroke={crosshairColor}
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.6"
              />
              <circle
                cx={hoverX}
                cy={getY(hoveredPoint.volume)}
                r="5"
                fill={volumeLineColor}
                stroke={dotStroke}
                strokeWidth="2"
              />
            </g>
          )}

          {/* Hover capture rectangles */}
          {data.map((d, i) => {
            const colWidth = chartWidth / data.length;
            const x = getX(i) - colWidth / 2;
            return (
              <rect
                key={i}
                x={x}
                y={paddingTop}
                width={colWidth}
                height={chartHeight}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => {
                  setHoveredPoint(d);
                  setHoverX(getX(i));
                }}
              />
            );
          })}
        </svg>

        {/* Hover Tooltip Box */}
        {hoveredPoint && hoverX !== null && (
          <div
            className="absolute top-2 pointer-events-none rounded-[16px] bg-white border border-[rgba(228,233,245,0.9)] px-3.5 py-2 shadow-lg font-sans text-[12px] -translate-x-1/2 z-dropdown text-[#111727]"
            style={{ left: `${(hoverX / width) * 100}%` }}
          >
            <div className="text-[#8591A5] text-[11px]">{hoveredPoint.timeLabel}</div>
            <div className="text-[#111727] font-semibold mt-0.5">
              Volume:{' '}
              <span className={hoveredPoint.isSpike ? (isDark ? 'text-[#E87868]' : 'text-[#FF6D5A]') : (isDark ? 'text-[#5878C7]' : 'text-[#2F65F6]')}>
                {hoveredPoint.volume.toLocaleString()} msgs
              </span>
            </div>
            <div className="text-[#8591A5] text-[11px]">
              Baseline: {hoveredPoint.baseline.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Legend Footer */}
      <div className="flex items-center justify-end gap-5 pt-4 mt-2 border-t border-[rgba(228,233,245,0.85)] text-[12px] font-medium text-[#8591A5]">
        <div className="flex items-center gap-1.5">
          <span className={`w-3 h-1 rounded-full ${isDark ? 'bg-[#5878C7]' : 'bg-[#2F65F6]'}`} />
          <span>Observed Activity</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-3 h-0.5 border-b border-dashed ${isDark ? 'border-[#69727D]' : 'border-[#94A3B8]'}`} />
          <span>Normal Baseline</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${isDark ? 'bg-[#E87868]' : 'bg-[#FF6D5A]'}`} />
          <span>Noticeable Spike</span>
        </div>
      </div>
    </div>
  );
};
