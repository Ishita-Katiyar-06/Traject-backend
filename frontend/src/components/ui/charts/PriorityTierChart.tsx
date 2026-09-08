import React, { useState, useMemo, useRef } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { Activity, Compass, Layers, ShieldAlert, CheckCircle2 } from 'lucide-react';

export interface PriorityDistributionData {
  critical: number;
  high: number;
  elevated: number;
  routine: number;
}

export interface PriorityTierChartProps {
  data: PriorityDistributionData | null | undefined;
  isLoading?: boolean;
  selectedTier?: 'critical' | 'high' | 'elevated' | 'routine' | null;
  onSelectTier?: (tier: 'critical' | 'high' | 'elevated' | 'routine' | null) => void;
  className?: string;
}

type ViewMode = 'spectrum' | 'polar' | 'pipeline';

export const PriorityTierChart: React.FC<PriorityTierChartProps> = ({
  data,
  isLoading = false,
  selectedTier = null,
  onSelectTier,
  className = '',
}) => {
  const { isDark } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>('spectrum');
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  const [hoveredTier, setHoveredTier] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const critical = data?.critical ?? 0;
  const high = data?.high ?? 0;
  const elevated = data?.elevated ?? 0;
  const routine = data?.routine ?? 0;
  const total = critical + high + elevated + routine || 1;

  // Geometry tokens for the 4G Continuum Spectrum SVG canvas
  const vbWidth = 600;
  const vbHeight = 210;
  const xMin = 44;
  const xMax = 556;
  const chartWidth = xMax - xMin; // 512px
  const yBase = 168; // Baseline Y

  // X coordinate calculation from score [0.00, 1.00]
  const getX = (score: number) => xMin + score * chartWidth;

  const xGateElevated = getX(0.35); // ~223.2
  const xGateHigh = getX(0.55);     // ~325.6
  const xGateCritical = getX(0.75); // ~428.0

  // Peak coords
  const routinePeakX = getX(0.175); // ~133.6
  const routinePeakY = 64;
  const elevatedPeakX = getX(0.44); // ~269.3
  const elevatedPeakY = elevated > 0 ? 112 : yBase;

  // Smooth cubic Bézier spline for the continuous density wave
  const curvePath = useMemo(() => {
    if (routine === 0 && elevated === 0 && high === 0 && critical === 0) {
      return `M ${xMin} ${yBase} L ${xMax} ${yBase}`;
    }

    return [
      `M ${xMin} ${yBase}`,
      // Swoop into Routine peak
      `C ${xMin + 30} ${yBase}, ${routinePeakX - 35} ${routinePeakY}, ${routinePeakX} ${routinePeakY}`,
      // Swoop down towards Elevated boundary
      `C ${routinePeakX + 35} ${routinePeakY}, ${xGateElevated - 20} ${elevated > 0 ? 158 : yBase}, ${xGateElevated} ${elevated > 0 ? 152 : yBase}`,
      // Swoop into Elevated peak
      elevated > 0
        ? `C ${xGateElevated + 18} 146, ${elevatedPeakX - 18} ${elevatedPeakY}, ${elevatedPeakX} ${elevatedPeakY}`
        : `L ${xGateHigh} ${yBase}`,
      // Swoop down to baseline
      elevated > 0
        ? `C ${elevatedPeakX + 18} ${elevatedPeakY}, ${xGateHigh - 15} ${yBase}, ${xGateHigh} ${yBase}`
        : ``,
      // Flat resting baseline across High and Critical
      `L ${xMax} ${yBase}`,
    ]
      .filter(Boolean)
      .join(' ');
  }, [routine, elevated, high, critical, xMin, xMax, yBase, routinePeakX, routinePeakY, elevatedPeakX, elevatedPeakY, xGateElevated, xGateHigh]);

  const areaPath = useMemo(() => {
    return `${curvePath} L ${xMax} ${yBase} L ${xMin} ${yBase} Z`;
  }, [curvePath, xMax, xMin, yBase]);

  // Constellation telemetry particles inside the Routine cluster
  const constellationDots = useMemo(() => [
    { x: getX(0.08), y: 154, r: 1.5, opacity: 0.45 },
    { x: getX(0.11), y: 138, r: 2.0, opacity: 0.55 },
    { x: getX(0.14), y: 106, r: 2.2, opacity: 0.65 },
    { x: getX(0.175), y: 84, r: 2.5, opacity: 0.75 },
    { x: getX(0.20), y: 104, r: 2.2, opacity: 0.65 },
    { x: getX(0.23), y: 132, r: 2.0, opacity: 0.55 },
    { x: getX(0.27), y: 152, r: 1.8, opacity: 0.45 },
    { x: getX(0.13), y: 148, r: 1.6, opacity: 0.5 },
    { x: getX(0.16), y: 122, r: 1.9, opacity: 0.6 },
    { x: getX(0.19), y: 126, r: 1.9, opacity: 0.6 },
    { x: getX(0.22), y: 146, r: 1.6, opacity: 0.5 },
  ], [xMin, chartWidth]);

  // Handle interactive SVG cursor hover
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const normalized = Math.max(0, Math.min(1, (clientX - (xMin / vbWidth) * rect.width) / ((chartWidth / vbWidth) * rect.width)));
    setHoveredScore(Number(normalized.toFixed(2)));

    if (normalized >= 0.75) setHoveredTier('Critical');
    else if (normalized >= 0.55) setHoveredTier('High');
    else if (normalized >= 0.35) setHoveredTier('Elevated');
    else setHoveredTier('Routine');
  };

  const handleMouseLeave = () => {
    setHoveredScore(null);
    setHoveredTier(null);
  };

  // Proportions for continuum dock
  const routinePct = (routine / total) * 100;
  const elevatedPct = (elevated / total) * 100;
  const highPct = (high / total) * 100;
  const criticalPct = (critical / total) * 100;

  if (isLoading) {
    return (
      <div className={`w-full h-[220px] flex items-center justify-center ${className}`}>
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-800 border-t-[#2F65F6] animate-spin" />
      </div>
    );
  }

  return (
    <div className={`w-full font-sans flex flex-col justify-between ${className}`}>
      {/* =========================================================================
          1. EXECUTIVE CONTINUUM DOCK & VIEW SELECTOR
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        {/* Proportional Multi-Segment Status Ribbon */}
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-[#1E2530] p-0.5 flex gap-1 border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
            {/* Routine segment */}
            <div
              style={{ width: `${Math.max(routinePct, 6)}%` }}
              onClick={() => onSelectTier?.(selectedTier === 'routine' ? null : 'routine')}
              className={`h-full rounded-full transition-all duration-300 cursor-pointer ${selectedTier === 'routine'
                  ? 'bg-slate-700 dark:bg-slate-300 ring-2 ring-slate-400'
                  : 'bg-slate-400/80 dark:bg-slate-500/70 hover:bg-slate-600 dark:hover:bg-slate-400'
                }`}
              title={`Routine: ${routine} msgs (${routinePct.toFixed(1)}%)`}
            />
            {/* Elevated segment */}
            <div
              style={{ width: `${Math.max(elevatedPct > 0 ? elevatedPct : 0, elevated > 0 ? 5 : 0)}%` }}
              onClick={() => onSelectTier?.(selectedTier === 'elevated' ? null : 'elevated')}
              className={`h-full rounded-full transition-all duration-300 cursor-pointer ${selectedTier === 'elevated'
                  ? 'bg-[#2F65F6] ring-2 ring-blue-400'
                  : 'bg-[#2F65F6] dark:bg-[#5878C7] hover:opacity-90 shadow-xs'
                }`}
              title={`Elevated: ${elevated} msgs (${elevatedPct.toFixed(1)}%)`}
            />
            {/* High segment */}
            {high > 0 && (
              <div
                style={{ width: `${highPct}%` }}
                onClick={() => onSelectTier?.(selectedTier === 'high' ? null : 'high')}
                className="h-full rounded-full bg-amber-500 transition-all cursor-pointer"
                title={`High: ${high} msgs`}
              />
            )}
            {/* Critical segment */}
            {critical > 0 && (
              <div
                style={{ width: `${criticalPct}%` }}
                onClick={() => onSelectTier?.(selectedTier === 'critical' ? null : 'critical')}
                className="h-full rounded-full bg-rose-500 transition-all cursor-pointer"
                title={`Critical: ${critical} msgs`}
              />
            )}
          </div>
          <span className="text-[11px] font-sans font-semibold text-slate-500 dark:text-slate-400 shrink-0">
            <span className="font-bold text-slate-900 dark:text-slate-100">{total}</span> signals
          </span>
        </div>

        {/* Executive View Switcher Segmented Control */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100/90 dark:bg-[#1E2530] border border-slate-200/70 dark:border-slate-700/60 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('spectrum')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${viewMode === 'spectrum'
                ? 'bg-white dark:bg-[#283140] text-[#2F65F6] dark:text-[#5878C7] shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
          >
            <Activity className="w-3 h-3" />
            <span>Spectrum</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('polar')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${viewMode === 'polar'
                ? 'bg-white dark:bg-[#283140] text-[#2F65F6] dark:text-[#5878C7] shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
          >
            <Compass className="w-3 h-3" />
            <span>Polar Arc</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('pipeline')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${viewMode === 'pipeline'
                ? 'bg-white dark:bg-[#283140] text-[#2F65F6] dark:text-[#5878C7] shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
          >
            <Layers className="w-3 h-3" />
            <span>Triage</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. PRIMARY VISUALIZATION CANVAS
          ========================================================================= */}
      <div className="relative w-full min-h-[195px] flex items-center justify-center select-none">
        {/* VIEW 1: CONTINUOUS 4G SPECTRUM DENSITY WAVE (CUSTOM VECTOR SVG) */}
        {viewMode === 'spectrum' && (
          <div className="w-full relative">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${vbWidth} ${vbHeight}`}
              className="w-full h-auto max-h-[200px] overflow-visible cursor-crosshair"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <defs>
                {/* Multi-Stop Horizontal Spectrum Glow Gradient */}
                <linearGradient id="spectrumStrokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={isDark ? '#64748B' : '#718096'} />
                  <stop offset="34%" stopColor={isDark ? '#5878C7' : '#3182CE'} />
                  <stop offset="36%" stopColor={isDark ? '#38BDF8' : '#2F65F6'} />
                  <stop offset="54%" stopColor={isDark ? '#60A5FA' : '#2563EB'} />
                  <stop offset="56%" stopColor={isDark ? '#FBBF24' : '#E9A23B'} />
                  <stop offset="74%" stopColor={isDark ? '#F59E0B' : '#D97706'} />
                  <stop offset="76%" stopColor={isDark ? '#F87171' : '#E35D5D'} />
                  <stop offset="100%" stopColor={isDark ? '#EF4444' : '#DC2626'} />
                </linearGradient>

                {/* Ethereal Vertical Area Fill Gradient */}
                <linearGradient id="spectrumAreaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={isDark ? 'rgba(100, 116, 139, 0.22)' : 'rgba(113, 128, 150, 0.16)'} />
                  <stop offset="35%" stopColor={isDark ? 'rgba(56, 189, 248, 0.28)' : 'rgba(47, 101, 246, 0.22)'} />
                  <stop offset="55%" stopColor={isDark ? 'rgba(251, 191, 36, 0.16)' : 'rgba(233, 162, 59, 0.14)'} />
                  <stop offset="75%" stopColor={isDark ? 'rgba(248, 113, 113, 0.14)' : 'rgba(227, 93, 93, 0.12)'} />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>

                {/* Vertical Fade Mask for Ethereal Dissolve */}
                <linearGradient id="verticalMaskGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                  <stop offset="65%" stopColor="#FFFFFF" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                </linearGradient>

                <mask id="verticalMask">
                  <rect x="0" y="0" width={vbWidth} height={vbHeight} fill="url(#verticalMaskGrad)" />
                </mask>

                {/* Ambient Blur Filter */}
                <filter id="softHalo" x="-15%" y="-15%" width="130%" height="130%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                </filter>

                <filter id="beaconGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="glow" />
                </filter>
              </defs>

              {/* Seamless Zone Threshold Demarcation Hairlines (Dashed with top badges) */}
              {/* Gate 1: Elevated (0.35) */}
              <g opacity={selectedTier === 'elevated' || !selectedTier ? 1 : 0.45} className="transition-opacity">
                <line
                  x1={xGateElevated}
                  y1={28}
                  x2={xGateElevated}
                  y2={yBase}
                  stroke={isDark ? 'rgba(88, 120, 199, 0.45)' : 'rgba(47, 101, 246, 0.35)'}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <rect
                  x={xGateElevated - 36}
                  y={12}
                  width={72}
                  height={16}
                  rx={8}
                  fill={isDark ? '#1C2330' : '#EFF6FF'}
                  stroke={isDark ? '#2E3D56' : '#BFDBFE'}
                  strokeWidth="1"
                />
                <text
                  x={xGateElevated}
                  y={23.5}
                  textAnchor="middle"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontSize="8.5"
                  fontWeight="700"
                  fill={isDark ? '#93C5FD' : '#1D4ED8'}
                >
                  Elevated · 0.35
                </text>
              </g>

              {/* Gate 2: High (0.55) */}
              <g opacity={selectedTier === 'high' || !selectedTier ? 1 : 0.45} className="transition-opacity">
                <line
                  x1={xGateHigh}
                  y1={28}
                  x2={xGateHigh}
                  y2={yBase}
                  stroke={isDark ? 'rgba(251, 191, 36, 0.4)' : 'rgba(245, 158, 11, 0.3)'}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <rect
                  x={xGateHigh - 28}
                  y={12}
                  width={56}
                  height={16}
                  rx={8}
                  fill={isDark ? '#232019' : '#FEFCE8'}
                  stroke={isDark ? '#42381F' : '#FEF08A'}
                  strokeWidth="1"
                />
                <text
                  x={xGateHigh}
                  y={23.5}
                  textAnchor="middle"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontSize="8.5"
                  fontWeight="700"
                  fill={isDark ? '#FCD34D' : '#B45309'}
                >
                  High · 0.55
                </text>
              </g>

              {/* Gate 3: Critical (0.75) */}
              <g opacity={selectedTier === 'critical' || !selectedTier ? 1 : 0.45} className="transition-opacity">
                <line
                  x1={xGateCritical}
                  y1={28}
                  x2={xGateCritical}
                  y2={yBase}
                  stroke={isDark ? 'rgba(248, 113, 113, 0.4)' : 'rgba(244, 63, 94, 0.3)'}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <rect
                  x={xGateCritical - 32}
                  y={12}
                  width={64}
                  height={16}
                  rx={8}
                  fill={isDark ? '#261C1F' : '#FFF1F2'}
                  stroke={isDark ? '#4C272E' : '#FECDD3'}
                  strokeWidth="1"
                />
                <text
                  x={xGateCritical}
                  y={23.5}
                  textAnchor="middle"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontSize="8.5"
                  fontWeight="700"
                  fill={isDark ? '#FCA5A5' : '#BE123C'}
                >
                  Critical · 0.75
                </text>
              </g>

              {/* 1. Luminous Area Fill under curve with vertical dissolve */}
              <path
                d={areaPath}
                fill="url(#spectrumAreaGrad)"
                mask="url(#verticalMask)"
                className="transition-all duration-500"
              />

              {/* 2. Soft Ambient Blur Halo behind main stroke */}
              <path
                d={curvePath}
                fill="none"
                stroke="url(#spectrumStrokeGrad)"
                strokeWidth="7"
                filter="url(#softHalo)"
                opacity={isDark ? 0.45 : 0.3}
              />

              {/* 3. Crisp Vector Main Spline Stroke */}
              <path
                d={curvePath}
                fill="none"
                stroke="url(#spectrumStrokeGrad)"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* 4. Constellation Telemetry Particles (344 Routine aggregation) */}
              {routine > 0 &&
                constellationDots.map((dot, idx) => (
                  <circle
                    key={idx}
                    cx={dot.x}
                    cy={dot.y}
                    r={dot.r}
                    fill={isDark ? '#94A3B8' : '#64748B'}
                    opacity={dot.opacity}
                    className="transition-opacity"
                  />
                ))}

              {/* 5. Active Elevated Radar Beacon (Score 0.44) */}
              {elevated > 0 && (
                <g className="transition-all">
                  {/* Vertical hairline leader */}
                  <line
                    x1={elevatedPeakX}
                    y1={elevatedPeakY}
                    x2={elevatedPeakX}
                    y2={yBase}
                    stroke="#38BDF8"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    opacity="0.6"
                  />

                  {/* Concentric Radar Pulse Rings */}
                  <circle
                    cx={elevatedPeakX}
                    cy={elevatedPeakY}
                    r="12"
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="1.5"
                    opacity="0.4"
                    className="animate-ping"
                    style={{ transformOrigin: `${elevatedPeakX}px ${elevatedPeakY}px`, animationDuration: '2.5s' }}
                  />
                  <circle
                    cx={elevatedPeakX}
                    cy={elevatedPeakY}
                    r="6"
                    fill="#0284C7"
                    filter="url(#beaconGlow)"
                    opacity="0.8"
                  />
                  <circle
                    cx={elevatedPeakX}
                    cy={elevatedPeakY}
                    r="4"
                    fill="#38BDF8"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />

                  {/* Floating Glassmorphic Beacon Badge Tag */}
                  <g
                    transform={`translate(${elevatedPeakX - 56}, ${elevatedPeakY - 44})`}
                    className="filter drop-shadow-md"
                  >
                    <rect
                      width="112"
                      height="26"
                      rx="7"
                      fill={isDark ? 'rgba(24, 30, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)'}
                      stroke={isDark ? '#38BDF8' : '#2F65F6'}
                      strokeWidth="1.2"
                    />
                    {/* Glowing beacon status dot */}
                    <circle cx="12" cy="13" r="3" fill="#38BDF8" className="animate-pulse" />
                    <text
                      x="20"
                      y="16.5"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      fontSize="9.5"
                      fontWeight="700"
                      fill={isDark ? '#F1F5F9' : '#0F172A'}
                    >
                      1 Signal · 0.44 Elev
                    </text>
                  </g>
                </g>
              )}

              {/* 6. Baseline Reference Rail */}
              <line
                x1={xMin}
                y1={yBase}
                x2={xMax}
                y2={yBase}
                stroke={isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'}
                strokeWidth="1"
              />

              {/* 7. X-Axis Score Continuum Markers */}
              <g
                fontFamily="system-ui, -apple-system, sans-serif"
                fontSize="9"
                fontWeight="600"
                fill={isDark ? '#94A3B8' : '#64748B'}
              >
                {/* 0.00 Base */}
                <text x={xMin} y={yBase + 16} textAnchor="start">
                  0.00 Base
                </text>
                {/* 0.35 Gate */}
                <text x={xGateElevated} y={yBase + 16} textAnchor="middle">
                  0.35
                </text>
                {/* 0.55 Gate */}
                <text x={xGateHigh} y={yBase + 16} textAnchor="middle">
                  0.55
                </text>
                {/* 0.75 Gate */}
                <text x={xGateCritical} y={yBase + 16} textAnchor="middle">
                  0.75
                </text>
                {/* 1.00 Max */}
                <text x={xMax} y={yBase + 16} textAnchor="end">
                  1.00 Max
                </text>
              </g>

              {/* Interactive Inspection Cursor line */}
              {hoveredScore !== null && (
                <g>
                  <line
                    x1={getX(hoveredScore)}
                    y1={24}
                    x2={getX(hoveredScore)}
                    y2={yBase}
                    stroke={isDark ? '#FFFFFF' : '#2F65F6'}
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                    opacity="0.8"
                  />
                  <circle
                    cx={getX(hoveredScore)}
                    cy={yBase}
                    r="3.5"
                    fill={isDark ? '#FFFFFF' : '#2F65F6'}
                  />
                </g>
              )}
            </svg>

            {/* Hover Inspection Dynamic Telemetry Badge */}
            {hoveredScore !== null && (
              <div
                style={{
                  left: `${((getX(hoveredScore) - 10) / vbWidth) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
                className="absolute top-1 pointer-events-none z-20 px-2.5 py-1 rounded-lg bg-slate-900/95 dark:bg-[#1E2530]/95 text-white border border-slate-700/60 shadow-xl flex items-center gap-2 text-[11px] backdrop-blur-md"
              >
                <span className="font-bold text-sky-400 font-mono">Score {hoveredScore.toFixed(2)}</span>
                <span className="text-slate-400">·</span>
                <span className="font-medium text-slate-200">{hoveredTier} Zone</span>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: HIGH-FIDELITY POLAR ARC RADIAL GAUGE */}
        {viewMode === 'polar' && (
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 py-2 px-3">
            {/* Concentric Vector Rings */}
            <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                {/* Track Rails (Background) */}
                <circle cx="80" cy="80" r="66" fill="none" stroke={isDark ? '#232936' : '#F1F5F9'} strokeWidth="9" />
                <circle cx="80" cy="80" r="52" fill="none" stroke={isDark ? '#232936' : '#F1F5F9'} strokeWidth="9" />
                <circle cx="80" cy="80" r="38" fill="none" stroke={isDark ? '#232936' : '#F1F5F9'} strokeWidth="9" />

                {/* Routine Track (344 msgs - 99.7%) */}
                <circle
                  cx="80"
                  cy="80"
                  r="66"
                  fill="none"
                  stroke={isDark ? '#64748B' : '#78889E'}
                  strokeWidth="9"
                  strokeDasharray={`${(routinePct / 100) * 414.69} 414.69`}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />

                {/* Elevated Track (1 msg - 0.3% - normalized visibility) */}
                {elevated > 0 && (
                  <circle
                    cx="80"
                    cy="80"
                    r="52"
                    fill="none"
                    stroke="#2F65F6"
                    strokeWidth="9"
                    strokeDasharray="24 326.7"
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                )}
              </svg>

              {/* Center Focal Metric Hub */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[22px] font-bold text-slate-900 dark:text-slate-100 leading-none tracking-tight">
                  {total}
                </span>
                <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">
                  Signals
                </span>
              </div>
            </div>

            {/* Radial Legend Breakdown */}
            <div className="flex-1 space-y-2 max-w-sm w-full font-sans">
              <div className="flex items-center justify-between text-[11.5px] p-1.5 rounded-xl bg-slate-50/70 dark:bg-[#1E2530]/50 border border-slate-200/50 dark:border-slate-700/40">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Routine (&lt;0.35)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{routine}</span>
                  <span className="text-[10px] text-slate-400 font-medium">({routinePct.toFixed(1)}%)</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11.5px] p-1.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2F65F6] animate-pulse" />
                  <span className="font-semibold text-blue-950 dark:text-blue-200">Elevated (0.35–0.54)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-blue-900 dark:text-blue-200">{elevated}</span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.2 rounded-full">
                    Active
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11.5px] p-1.5 rounded-xl bg-slate-50/70 dark:bg-[#1E2530]/50 border border-slate-200/50 dark:border-slate-700/40 opacity-70">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="font-semibold text-slate-600 dark:text-slate-300">High (0.55–0.74)</span>
                </div>
                <span className="font-mono font-bold text-slate-500 dark:text-slate-400">{high}</span>
              </div>

              <div className="flex items-center justify-between text-[11.5px] p-1.5 rounded-xl bg-slate-50/70 dark:bg-[#1E2530]/50 border border-slate-200/50 dark:border-slate-700/40 opacity-70">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Critical (≥0.75)</span>
                </div>
                <span className="font-mono font-bold text-slate-500 dark:text-slate-400">{critical}</span>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: STEPPED TRIAGE FILTRATION PIPELINE */}
        {viewMode === 'pipeline' && (
          <div className="w-full py-2 space-y-2 font-sans">
            {/* Critical Row */}
            <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-slate-50/70 dark:bg-[#1E2530]/50 border border-slate-200/50 dark:border-slate-700/40">
              <div className="flex items-center gap-2 min-w-[130px]">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">Critical (≥0.75)</span>
              </div>
              <div className="flex-1 h-2 rounded-full bg-slate-200/70 dark:bg-slate-700 overflow-hidden">
                <div style={{ width: `${criticalPct}%` }} className="h-full bg-rose-500" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">{critical}</span>
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-100/70 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Clear
                </span>
              </div>
            </div>

            {/* High Row */}
            <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-slate-50/70 dark:bg-[#1E2530]/50 border border-slate-200/50 dark:border-slate-700/40">
              <div className="flex items-center gap-2 min-w-[130px]">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">High (0.55–0.74)</span>
              </div>
              <div className="flex-1 h-2 rounded-full bg-slate-200/70 dark:bg-slate-700 overflow-hidden">
                <div style={{ width: `${highPct}%` }} className="h-full bg-amber-500" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">{high}</span>
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-100/70 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Clear
                </span>
              </div>
            </div>

            {/* Elevated Row */}
            <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40">
              <div className="flex items-center gap-2 min-w-[130px]">
                <span className="w-2 h-2 rounded-full bg-[#2F65F6] animate-pulse shrink-0" />
                <span className="text-[11.5px] font-bold text-blue-950 dark:text-blue-200">Elevated (0.35–0.54)</span>
              </div>
              <div className="flex-1 h-2 rounded-full bg-slate-200/70 dark:bg-slate-700 overflow-hidden">
                <div style={{ width: `${Math.max(elevatedPct, 12)}%` }} className="h-full bg-[#2F65F6] shadow-sm" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono font-bold text-blue-950 dark:text-blue-200">{elevated}</span>
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 animate-pulse">
                  <ShieldAlert className="w-2.5 h-2.5" /> Triage Queue
                </span>
              </div>
            </div>

            {/* Routine Row */}
            <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-slate-50/70 dark:bg-[#1E2530]/50 border border-slate-200/50 dark:border-slate-700/40">
              <div className="flex items-center gap-2 min-w-[130px]">
                <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />
                <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">Routine (&lt;0.35)</span>
              </div>
              <div className="flex-1 h-2 rounded-full bg-slate-200/70 dark:bg-slate-700 overflow-hidden">
                <div style={{ width: `${routinePct}%` }} className="h-full bg-slate-400 dark:bg-slate-500" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">{routine}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {routinePct.toFixed(1)}% Suppressed
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PriorityTierChart;
