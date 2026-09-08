import React, { useMemo } from 'react';
import type { TrendSummaryResponse } from '../../types/api';

export interface NarrativeClusterMapProps {
  trend?: TrendSummaryResponse | null;
  isLoading?: boolean;
  className?: string;
}

interface NodeLayout {
  cardX: number;
  cardY: number;
  cardW: number;
  cardH: number;
  path: string;
  color: string;
}

// Minimalist, squarish layout with clean direct lines (zero clutter, zero extra rings)
const BASE_LAYOUTS = [
  // 0: Top-Right
  {
    baseX: 355,
    baseY: 74,
    path: 'M 315 213 C 342 180, 380 150, 410 114',
    color: '#F59E0B',
  },
  // 1: Middle-Right
  {
    baseX: 380,
    baseY: 228,
    path: 'M 330 248 L 380 248',
    color: '#10B981',
  },
  // 2: Bottom-Center
  {
    baseX: 184,
    baseY: 384,
    path: 'M 280 298 L 280 384',
    color: '#F43F5E',
  },
  // 3: Middle-Left
  {
    baseX: 30,
    baseY: 228,
    path: 'M 230 248 L 180 248',
    color: '#8B5CF6',
  },
  // 4: Top-Left
  {
    baseX: 65,
    baseY: 74,
    path: 'M 245 213 C 218 180, 180 150, 150 114',
    color: '#3B82F6',
  },
];

export const NarrativeClusterMap: React.FC<NarrativeClusterMapProps> = ({
  trend,
  isLoading = false,
  className = '',
}) => {
  // Dynamically extract data directly from backend trend response
  const processedData = useMemo(() => {
    const clusterLabel = trend?.cluster_label !== undefined ? String(trend.cluster_label) : '';

    // Extract authentic keywords from API
    let rawKeywords: Array<{ keyword: string; score: number }> = [];
    if (trend?.representative_keywords && trend.representative_keywords.length > 0) {
      rawKeywords = trend.representative_keywords.map((k) => ({
        keyword: k.keyword,
        score: Number(k.score) || 0.4,
      }));
    } else if (trend?.label) {
      rawKeywords = trend.label
        .split(',')
        .map((k, i) => ({
          keyword: k.trim(),
          score: Math.max(0.3, +(1.0 - i * 0.15).toFixed(2)),
        }))
        .filter((k) => k.keyword.length > 0);
    }

    // Sort descending by score
    const sortedKeywords = [...rawKeywords].sort((a, b) => b.score - a.score).slice(0, 5);

    const nodes: Array<NodeLayout & { keyword: string; formattedScore: string; index: number }> = sortedKeywords.map(
      (item, idx) => {
        const layout = BASE_LAYOUTS[idx] || BASE_LAYOUTS[0];
        
        // Precise character width estimation for 12px font-bold
        let textW = 8; // for '#' symbol
        for (let i = 0; i < item.keyword.length; i++) {
          const ch = item.keyword[i].toLowerCase();
          if (ch === 'm' || ch === 'w') textW += 9.5;
          else if (ch === 'i' || ch === 'l' || ch === 'j' || ch === 't') textW += 4.2;
          else if (ch === 'r' || ch === 'f') textW += 5.2;
          else textW += 7.3;
        }

        // Balanced, compact spacing: text starts at 27px, crisp 12px gap to badge, 28px badge, 9px right margin
        const cardW = Math.max(118, Math.round(27 + textW + 12 + 28 + 9));
        const cardH = 40;

        // Align cards cleanly with calculated width
        let cardX = layout.baseX;
        if (idx === 2) {
          // Bottom-Center: perfectly centered at cx = 280
          cardX = Math.round(280 - cardW / 2);
        } else if (idx === 3) {
          // Middle-Left: right-aligned to connector end x = 180
          cardX = 180 - cardW;
        }

        return {
          cardX,
          cardY: layout.baseY,
          cardW,
          cardH,
          path: layout.path,
          color: layout.color,
          keyword: item.keyword,
          formattedScore: item.score.toFixed(1),
          index: idx,
        };
      }
    );

    return {
      clusterLabel,
      nodes,
    };
  }, [trend]);

  const cx = 280;
  const cy = 248;

  return (
    <div
      className={`w-full max-w-[520px] mx-auto flex items-center justify-center select-none pointer-events-none font-sans ${className}`}
    >
      <svg
        viewBox="0 0 560 480"
        className="w-full h-auto overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Subtle Card Elevation */}
          <filter id="simCardShadow" x="-20%" y="-30%" width="140%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0F172A" floodOpacity="0.04" />
          </filter>

          {/* Clean Hub Elevation */}
          <filter id="simHubShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#0F172A" floodOpacity="0.06" />
          </filter>

          {/* Subtle Hub Radial Fill */}
          <radialGradient id="cleanHubBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#FFFDF7" />
          </radialGradient>
        </defs>

        {/* =========================================================================
            1. PURE CONNECTION LINES (NO EXTRA RINGS, NO DOTS, NO BLUR)
            ========================================================================= */}
        {processedData.nodes.map((node) => (
          <path
            key={`line-${node.index}`}
            d={node.path}
            fill="none"
            stroke={node.color}
            strokeWidth="1.8"
            opacity="0.85"
            strokeLinecap="round"
          />
        ))}

        {/* =========================================================================
            2. SINGLE CLEAN NUCLEUS HUB (AMBER THEMED & HARMONIZED)
            ========================================================================= */}
        <g>
          {/* Single Solid Hub Disc */}
          <circle
            cx={cx}
            cy={cy}
            r="50"
            fill="url(#cleanHubBg)"
            stroke="#F59E0B"
            strokeWidth="1.8"
            filter="url(#simHubShadow)"
            className="dark:fill-[#171B24] dark:stroke-[#F59E0B]"
          />

          {/* Hub Title */}
          <text
            x={cx}
            y={cy - 11}
            textAnchor="middle"
            className="font-mono text-[8.5px] font-bold tracking-[0.24em] fill-amber-700/80 dark:fill-amber-400 uppercase"
          >
            {isLoading ? 'SYNCING' : 'CLUSTER'}
          </text>

          {/* Prominent Cluster ID */}
          <text
            x={cx}
            y={cy + 17}
            textAnchor="middle"
            className="font-sans text-[28px] font-black tracking-tight fill-slate-900 dark:fill-white"
          >
            {isLoading ? '...' : `#${processedData.clusterLabel || '—'}`}
          </text>
        </g>

        {/* =========================================================================
            3. DYNAMIC TOPIC PILLS (SPACIOUS #trend AND DECIMAL SCORE)
            ========================================================================= */}
        {processedData.nodes.map((node) => {
          const { cardX, cardY, cardW, cardH } = node;

          return (
            <g key={`pill-${node.index}`}>
              {/* Clean White Card Body */}
              <rect
                x={cardX}
                y={cardY}
                width={cardW}
                height={cardH}
                rx="16"
                fill="#FFFFFF"
                stroke="#E2E8F0"
                strokeWidth="1"
                filter="url(#simCardShadow)"
                className="dark:fill-[#171C26] dark:stroke-[#2B3547]"
              />

              {/* Colored Indicator Dot */}
              <circle
                cx={cardX + 16}
                cy={cardY + 20}
                r="4.5"
                fill={node.color}
              />

              {/* Dynamic #keyword Tag */}
              <text
                x={cardX + 27}
                y={cardY + 24.5}
                textAnchor="start"
                className="font-sans font-bold text-[12px] tracking-tight fill-slate-900 dark:fill-white"
              >
                #{node.keyword}
              </text>

              {/* Decimal Score Badge (Clean Pill) */}
              <rect
                x={cardX + cardW - 37}
                y={cardY + 11}
                width="28"
                height="18"
                rx="9"
                fill="#F8FAFC"
                stroke="#E2E8F0"
                strokeWidth="0.8"
                className="dark:fill-[#222B3A] dark:stroke-[#334155]"
              />
              <text
                x={cardX + cardW - 23}
                y={cardY + 23.5}
                textAnchor="middle"
                className="font-mono font-bold text-[9.5px] fill-slate-700 dark:fill-slate-200"
              >
                {node.formattedScore}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
