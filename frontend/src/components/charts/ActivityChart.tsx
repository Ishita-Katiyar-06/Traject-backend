import React, { useState } from 'react';
import { ActivityDataPoint } from '../../data/mock/activity';
import { useTheme } from '../../contexts/ThemeContext';

export interface ActivityChartProps {
  data: ActivityDataPoint[];
  className?: string;
}

export const ActivityChart: React.FC<ActivityChartProps> = ({ data, className = '' }) => {
  const { isDark } = useTheme();
  const [hoveredPoint, setHoveredPoint] = useState<ActivityDataPoint | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  // Theme-aware palette (strictly identical in light mode)
  const gridColor = isDark ? '#2A3037' : '#E2E8F0';
  const axisTextColor = isDark ? '#858D98' : '#8591A5';
  const volumeLineColor = isDark ? '#5878C7' : '#2F65F6';
  const volumeAreaColor = isDark ? '#5878C7' : '#2F65F6';
  const baselineColor = isDark ? '#69727D' : '#94A3B8';
  const spikeColor = isDark ? '#E87868' : '#FF6D5A';
  const spikeStroke = isDark ? '#171C22' : '#FFFFFF';
  const crosshairColor = isDark ? '#858D98' : '#94A3B8';
  const dotStroke = isDark ? '#171C22' : '#FFFFFF';

  // SVG Chart Geometry
  const width = 1000;
  const height = 240;
  const paddingLeft = 50;
  const paddingRight = 24;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVolume = Math.max(...data.map((d) => d.volume), 1500);

  const getX = (index: number) => paddingLeft + (index / (data.length - 1)) * chartWidth;
  const getY = (val: number) => paddingTop + chartHeight - (val / maxVolume) * chartHeight;

  // Build SVG Path for Actual Volume Line
  const linePoints = data.map((d, i) => `${getX(i)},${getY(d.volume)}`);
  const pathD = `M ${linePoints.join(' L ')}`;

  // Area under the line with subtle opacity
  const areaD = `M ${getX(0)},${getY(0)} L ${linePoints.join(' L ')} L ${getX(
    data.length - 1
  )},${getY(0)} Z`;

  // Build Baseline dashed line path
  const baselinePoints = data.map((d, i) => `${getX(i)},${getY(d.baseline)}`);
  const baselineD = `M ${baselinePoints.join(' L ')}`;

  // Y-axis ticks
  const yTicks = [0, 500, 1000, 1500];

  // X-axis major ticks
  const majorTickIndices = [0, 4, 8, 12, 16, 20, 23];

  return (
    <div
      className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-6 md:p-8 shadow-dashboard select-none ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-[20px] font-bold text-[#111727] font-sans tracking-tight">
            Discussion Activity Volume
          </h3>
          <p className="text-[#8591A5] text-[13px] font-sans mt-0.5 font-normal">
            Hourly message volume across monitored channels • Last 24 Hours
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[12px] font-sans font-medium text-[#8591A5] self-start sm:self-center">
          <div className="flex items-center gap-1.5">
            <span className={`w-3 h-1 rounded-full ${isDark ? 'bg-[#5878C7]' : 'bg-[#2F65F6]'}`} />
            <span className="text-[#475569]">Volume</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-3 h-0.5 border-b-2 border-dashed ${isDark ? 'border-[#69727D]' : 'border-[#8591A5]'}`} />
            <span className="text-[#475569]">Expected Baseline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isDark ? 'bg-[#E87868]' : 'bg-[#FF6D5A]'}`} />
            <span className="text-[#475569]">Anomaly Spike</span>
          </div>
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
          {/* Horizontal Grid lines & Y-axis labels */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke={gridColor}
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill={axisTextColor}
                  className="text-[11px] font-medium"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Area under volume curve */}
          <path d={areaD} fill={volumeAreaColor} fillOpacity="0.08" />

          {/* Baseline reference line (dashed muted) */}
          <path
            d={baselineD}
            fill="none"
            stroke={baselineColor}
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />

          {/* Actual Volume Series Line */}
          <path
            d={pathD}
            fill="none"
            stroke={volumeLineColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Data Points & Spikes */}
          {data.map((d, i) => {
            const cx = getX(i);
            const cy = getY(d.volume);

            if (d.isSpike) {
              return (
                <g key={i}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="5"
                    fill={spikeColor}
                    stroke={spikeStroke}
                    strokeWidth="2.5"
                    className="shadow-sm"
                  />
                  <text
                    x={cx}
                    y={cy - 10}
                    textAnchor="middle"
                    fill={spikeColor}
                    className="text-[10px] font-bold"
                  >
                    SPIKE
                  </text>
                </g>
              );
            }
            return null;
          })}

          {/* X-axis major hour ticks */}
          {majorTickIndices.map((idx) => {
            if (!data[idx]) return null;
            const x = getX(idx);
            const y = paddingTop + chartHeight + 20;
            return (
              <text
                key={idx}
                x={x}
                y={y}
                textAnchor="middle"
                fill={axisTextColor}
                className="text-[11px] font-medium"
              >
                {data[idx].hourLabel}
              </text>
            );
          })}

          {/* Hover Crosshair & Anchor */}
          {hoverX !== null && hoveredPoint && (
            <g>
              <line
                x1={hoverX}
                y1={paddingTop}
                x2={hoverX}
                y2={paddingTop + chartHeight}
                stroke={crosshairColor}
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={hoverX}
                cy={getY(hoveredPoint.volume)}
                r="5"
                fill={volumeLineColor}
                stroke={dotStroke}
                strokeWidth="2.5"
              />
            </g>
          )}

          {/* Hover hit targets */}
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

        {/* Hover readout tooltip */}
        {hoveredPoint && hoverX !== null && (
          <div
            className="absolute top-2 pointer-events-none rounded-[16px] bg-white border border-[rgba(228,233,245,0.9)] px-3.5 py-2 text-left shadow-modal font-sans text-[12px] -translate-x-1/2 z-dropdown text-[#111727]"
            style={{ left: `${(hoverX / width) * 100}%` }}
          >
            <div className="text-[#8591A5] text-[11px] font-semibold">{hoveredPoint.hourLabel} UTC</div>
            <div className="text-[#111727] font-bold mt-0.5">
              Volume:{' '}
              <span className={hoveredPoint.isSpike ? (isDark ? 'text-[#E87868]' : 'text-[#FF6D5A]') : (isDark ? 'text-[#5878C7]' : 'text-[#2F65F6]')}>
                {hoveredPoint.volume.toLocaleString()} msgs/h
              </span>
            </div>
            <div className="text-[#8591A5] text-[11px] mt-0.5">
              Baseline: {hoveredPoint.baseline.toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
