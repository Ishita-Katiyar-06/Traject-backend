import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useTheme } from '../../../contexts/ThemeContext';
import { AlertTriangle } from 'lucide-react';

export interface SentimentDonutChartProps {
  positiveRatio: number | null | undefined;
  neutralRatio: number | null | undefined;
  negativeRatio: number | null | undefined;
  evaluatedCount?: number;
  modelId?: string | null;
  isLoading?: boolean;
  className?: string;
}

export interface SentimentTrack {
  id: 'neutral' | 'negative' | 'positive';
  label: string;
  percentage: number;
  count: number;
  radius: number;
  color: string;
  colorDark: string;
  gradId: string;
  startAngle: number;
  endAngle: number;
  arcPath: string;
  bgPath: string;
  tipX: number;
  tipY: number;
  targetX: number;
  targetY: number;
  leaderPath: string;
}

// Convert polar angle (degrees, 0 = 3 o'clock, clockwise) to Cartesian (x, y)
function polarToCartesian(cx: number, cy: number, radius: number, angleDegrees: number) {
  const angleRadians = (angleDegrees * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleRadians),
    y: cy + radius * Math.sin(angleRadians),
  };
}

// Construct SVG Arc Path from startAngle to endAngle (clockwise)
function createArcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const sweep = endAngle - startAngle;
  const largeArcFlag = sweep > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export const SentimentDonutChart: React.FC<SentimentDonutChartProps> = ({
  positiveRatio,
  neutralRatio,
  negativeRatio,
  evaluatedCount = 0,
  isLoading = false,
  className = '',
}) => {
  const { isDark } = useTheme();
  const [hoveredTrack, setHoveredTrack] = useState<'neutral' | 'negative' | 'positive' | null>(null);

  const isAvailable =
    evaluatedCount > 0 &&
    typeof positiveRatio === 'number' &&
    typeof neutralRatio === 'number' &&
    typeof negativeRatio === 'number';

  // Scaled Canvas Dimensions to perfectly fill the Corpus Sentiment card
  const viewBoxWidth = 640;
  const viewBoxHeight = 310;
  const cx = 175;
  const cy = 150;
  const rCore = 56;
  const strokeW = 15;

  // Geometry configuration: Arcs start at bottom-right (80°), sweep clockwise around circle
  const startAngle = 80;
  const maxSweep = 250; // 250 degrees total gauge capacity

  // Concentric Radial Tracks calculation
  const tracks = useMemo<SentimentTrack[]>(() => {
    if (!isAvailable) return [];

    const rawPos = Math.max(0, positiveRatio ?? 0);
    const rawNeu = Math.max(0, neutralRatio ?? 0);
    const rawNeg = Math.max(0, negativeRatio ?? 0);
    const total = rawPos + rawNeu + rawNeg || 1;

    const posPct = Math.round((rawPos / total) * 1000) / 10;
    const neuPct = Math.round((rawNeu / total) * 1000) / 10;
    const negPct = Math.round((rawNeg / total) * 1000) / 10;

    // Three distinct concentric radii (Outer, Middle, Inner) scaled up to fill container
    const trackDefs = [
      {
        id: 'neutral' as const,
        label: 'Neutral',
        percentage: neuPct,
        count: Math.round(evaluatedCount * (rawNeu / total)),
        radius: 142,
        color: '#3B82F6',
        colorDark: '#60A5FA',
        gradId: 'radial-grad-neutral',
        targetX: 385,
        targetY: 50,
      },
      {
        id: 'negative' as const,
        label: 'Negative',
        percentage: negPct,
        count: Math.round(evaluatedCount * (rawNeg / total)),
        radius: 113,
        color: '#EF4444',
        colorDark: '#F87171',
        gradId: 'radial-grad-negative',
        targetX: 385,
        targetY: 150,
      },
      {
        id: 'positive' as const,
        label: 'Positive',
        percentage: posPct,
        count: Math.round(evaluatedCount * (rawPos / total)),
        radius: 84,
        color: '#10B981',
        colorDark: '#34D399',
        gradId: 'radial-grad-positive',
        targetX: 385,
        targetY: 250,
      },
    ];

    return trackDefs.map((def) => {
      // Calibrated minimum of 18° so small slices (e.g. 3.6%) have a crisp visible rounded arc
      const calibratedSweep = Math.max(18, (def.percentage / 100) * maxSweep);
      const endAngle = startAngle + calibratedSweep;

      const arcPath = createArcPath(cx, cy, def.radius, startAngle, endAngle);
      const bgPath = createArcPath(cx, cy, def.radius, startAngle, startAngle + maxSweep);

      const tipPoint = polarToCartesian(cx, cy, def.radius, endAngle);

      // Smooth S-Curve Leader Line connecting arc tip to horizontal shelf
      const cp1X = tipPoint.x + Math.max(30, (def.targetX - tipPoint.x) * 0.45);
      const cp1Y = tipPoint.y;
      const cp2X = def.targetX - Math.max(30, (def.targetX - tipPoint.x) * 0.45);
      const cp2Y = def.targetY;
      const leaderPath = `M ${tipPoint.x.toFixed(2)} ${tipPoint.y.toFixed(2)} C ${cp1X.toFixed(2)} ${cp1Y.toFixed(2)}, ${cp2X.toFixed(2)} ${cp2Y.toFixed(2)}, ${def.targetX} ${def.targetY} L ${def.targetX + 190} ${def.targetY}`;

      return {
        ...def,
        startAngle,
        endAngle,
        arcPath,
        bgPath,
        tipX: tipPoint.x,
        tipY: tipPoint.y,
        leaderPath,
      };
    });
  }, [positiveRatio, neutralRatio, negativeRatio, evaluatedCount, isAvailable]);

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 space-y-4 ${className}`}>
        <div className="w-24 h-24 rounded-full border-3 border-slate-200 dark:border-slate-800 border-t-[#2F65F6] animate-spin" />
        <span className="text-[12px] font-mono text-[#8591A5] dark:text-slate-400">Loading sentiment distribution...</span>
      </div>
    );
  }

  if (!isAvailable) {
    return (
      <div className={`p-6 rounded-[20px] bg-[#F8FAFD] dark:bg-[#12161C] border border-slate-200/60 dark:border-[#2B323A] text-center space-y-2.5 ${className}`}>
        <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
        <h4 className="text-[14px] font-bold text-[#111727] dark:text-slate-200">
          Sentiment Inference Unavailable
        </h4>
        <p className="text-[12px] text-[#64748B] dark:text-slate-400 max-w-sm mx-auto">
          Corpus sentiment classification has not been evaluated or has insufficient data coverage.
        </p>
      </div>
    );
  }

  const activeTrack = tracks.find((t) => t.id === hoveredTrack);
  const formattedCount =
    evaluatedCount >= 1000
      ? `${(evaluatedCount / 1000).toFixed(1)}K`
      : evaluatedCount.toLocaleString();

  return (
    <div className={`font-sans ${className}`}>
      {/* Spacious, Clean SVG Canvas without overflow clipping */}
      <div className="relative w-full flex justify-center">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-auto max-w-[680px] select-none"
          role="img"
          aria-label="Concentric sentiment radial gauge"
        >
          <defs>
            {/* Multi-Layered Soft Elevation Shadows without harsh dark bands */}
            <filter id="clean-gauge-shadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0F172A" floodOpacity={isDark ? 0.35 : 0.08} />
            </filter>

            <filter id="clean-sphere-shadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="#000000" floodOpacity={isDark ? 0.5 : 0.12} />
            </filter>

            {/* Saturated Gradients for Tracks */}
            <linearGradient id="radial-grad-neutral" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>

            <linearGradient id="radial-grad-negative" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="100%" stopColor="#DC2626" />
            </linearGradient>

            <linearGradient id="radial-grad-positive" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* 3D Sphere Orb Gradient */}
            <radialGradient id="clean-sphere-grad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor={isDark ? '#2D3748' : '#FFFFFF'} />
              <stop offset="70%" stopColor={isDark ? '#1A202C' : '#F1F5F9'} />
              <stop offset="100%" stopColor={isDark ? '#0F131A' : '#E2E8F0'} />
            </radialGradient>
          </defs>

          {/* 1. Background Capacity Guide Tracks */}
          <g className="pointer-events-none opacity-40 dark:opacity-20">
            {tracks.map((t) => (
              <path
                key={`bg-${t.id}`}
                d={t.bgPath}
                fill="none"
                stroke={isDark ? '#334155' : '#CBD5E1'}
                strokeWidth={strokeW}
                strokeLinecap="round"
              />
            ))}
          </g>

          {/* 2. Active Concentric Sentiment Arcs */}
          <g filter="url(#clean-gauge-shadow)">
            {tracks.map((t) => {
              const isHovered = hoveredTrack === t.id;
              const isDimmed = hoveredTrack !== null && !isHovered;
              const trackColor = isDark ? t.colorDark : t.color;

              return (
                <g key={t.id} className="cursor-pointer">
                  {/* Outer active path */}
                  <motion.path
                    d={t.arcPath}
                    fill="none"
                    stroke={`url(#${t.gradId})`}
                    strokeWidth={isHovered ? strokeW + 2 : strokeW}
                    strokeLinecap="round"
                    className="transition-all duration-200"
                    style={{
                      opacity: isDimmed ? 0.35 : 1,
                    }}
                    onMouseEnter={() => setHoveredTrack(t.id)}
                    onMouseLeave={() => setHoveredTrack(null)}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  />

                  {/* Rounded Tip Accent Dot */}
                  <circle
                    cx={t.tipX}
                    cy={t.tipY}
                    r={isHovered ? 4.5 : 3.5}
                    fill="#FFFFFF"
                    stroke={trackColor}
                    strokeWidth={2}
                    className="pointer-events-none transition-transform duration-150"
                  />
                </g>
              );
            })}
          </g>

          {/* 3. Central 3D Sphere Disc */}
          <g className="pointer-events-none select-none">
            <circle
              cx={cx}
              cy={cy}
              r={rCore}
              fill="url(#clean-sphere-grad)"
              stroke={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.85)'}
              strokeWidth={1.5}
              filter="url(#clean-sphere-shadow)"
            />

            {/* Central Dynamic Content */}
            {activeTrack ? (
              <>
                <text
                  x={cx}
                  y={cy - 12}
                  textAnchor="middle"
                  fill={isDark ? activeTrack.colorDark : activeTrack.color}
                  className="text-[11px] font-extrabold font-sans uppercase tracking-widest"
                >
                  {activeTrack.label}
                </text>
                <text
                  x={cx}
                  y={cy + 13}
                  textAnchor="middle"
                  fill={isDark ? '#F1F5F9' : '#0F172A'}
                  className="text-[22px] font-mono font-extrabold tracking-tight"
                >
                  {activeTrack.percentage}%
                </text>
                <text
                  x={cx}
                  y={cy + 29}
                  textAnchor="middle"
                  fill="#94A3B8"
                  className="text-[10px] font-mono font-medium"
                >
                  {activeTrack.count.toLocaleString()} msgs
                </text>
              </>
            ) : (
              <>
                <text
                  x={cx}
                  y={cy - 13}
                  textAnchor="middle"
                  fill={isDark ? '#94A3B8' : '#64748B'}
                  className="text-[10px] font-extrabold font-sans uppercase tracking-[0.2em]"
                >
                  CORPUS
                </text>
                <text
                  x={cx}
                  y={cy + 7}
                  textAnchor="middle"
                  fill={isDark ? '#F8FAFC' : '#0F172A'}
                  className="text-[13px] font-bold font-sans uppercase tracking-wider"
                >
                  SENTIMENT
                </text>
                <text
                  x={cx}
                  y={cy + 26}
                  textAnchor="middle"
                  fill="#94A3B8"
                  className="text-[10.5px] font-mono font-bold"
                >
                  {formattedCount}
                </text>
              </>
            )}
          </g>

          {/* 4. Smooth Bezier S-Curve Leader Lines & Clean Callouts */}
          {tracks.map((t) => {
            const isHovered = hoveredTrack === t.id;
            const isDimmed = hoveredTrack !== null && !isHovered;
            const strokeColor = isDark ? t.colorDark : t.color;

            return (
              <g
                key={`callout-${t.id}`}
                className="cursor-pointer transition-all duration-200"
                style={{ opacity: isDimmed ? 0.35 : 1 }}
                onMouseEnter={() => setHoveredTrack(t.id)}
                onMouseLeave={() => setHoveredTrack(null)}
              >
                {/* Clean S-Curve Leader Line extending to horizontal shelf */}
                <motion.path
                  d={t.leaderPath}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isHovered ? 2.4 : 1.8}
                  strokeLinecap="round"
                  className="pointer-events-none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                />

                {/* Big Clean Monospace Metric */}
                <text
                  x={t.targetX + 10}
                  y={t.targetY - 8}
                  fill={strokeColor}
                  className="text-[28px] sm:text-[30px] font-extrabold font-mono tracking-tight"
                >
                  {t.percentage}%
                </text>

                {/* Clean Category Label */}
                <text
                  x={t.targetX + 10}
                  y={t.targetY + 18}
                  fill={isDark ? '#E2E8F0' : '#475569'}
                  className="text-[14px] font-bold font-sans tracking-tight"
                >
                  {t.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
