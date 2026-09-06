/**
 * TRAJECT Milestone 5B - Semantic Guardrails & Telemetry Presentation Formatters
 *
 * Implements strict analytical policy guardrails:
 * 1. Priority Signal Score: backend-provided composite in [0.0, 1.0]. Never call threat/risk/maliciousness.
 * 2. Coordination signals: potential synchronization anomalies flagging items for analyst attention.
 *    Never assert coordinated inauthentic operations or malicious attribution.
 * 3. Observed Reach: log-scaled views and forward ratios. Never claim total population reach.
 * 4. Evidence Density: sample density heuristic (HIGH, MODERATE, SPARSE). Never call confidence/certainty.
 * 5. Sentiment: explicit unavailable state when uncomputed; NEVER synthesize or assume 100% neutral.
 */

import type { EvidenceDensityTier, PriorityTier } from '../types/api.ts';

/**
 * Coordination semantic definitions
 */
export const COORDINATION_WORDING = {
  primary: 'Potential Coordination Signal',
  plural: 'Potential Coordination Signals',
  indicators: 'Observed Coordination Indicators',
  disclaimer:
    'Signals flag anomalous publication bursts and syndication heuristics for analyst review. They do not constitute proof of coordinated inauthentic behavior (CIB) or malicious attribution.',
  tooltip:
    'Potential synchronization signals derived from uncredited syndication and arrival temporal burstiness. Indicates anomalous publication patterns, never proof of coordinated inauthentic behavior.',
};

/**
 * Reach semantic definitions
 */
export const REACH_WORDING = {
  primary: 'Observed Reach',
  secondary: 'Observed Exposure',
  tooltip:
    'Observed Exposure reflects log-scaled channel views and forward-to-view ratios across monitored feeds. It does not measure unique audience or population penetration.',
};

/**
 * Evidence density definitions
 */
export const EVIDENCE_DENSITY_WORDING = {
  primary: 'Observational Data Coverage',
  tooltip:
    'Represents sample density and observation depth across monitored channels and messages. It does NOT represent statistical confidence or certainty.',
};

/**
 * Priority Tier badge styles and labels.
 */
export const PRIORITY_TIER_CONFIG: Record<
  PriorityTier,
  { label: string; bgClass: string; textClass: string; borderClass: string; dotClass: string }
> = {
  critical: {
    label: 'CRITICAL',
    bgClass: 'bg-red-50 text-red-700 border-red-200',
    textClass: 'text-red-700',
    borderClass: 'border-red-200',
    dotClass: 'bg-red-500',
  },
  high: {
    label: 'HIGH',
    bgClass: 'bg-amber-50 text-amber-800 border-amber-200',
    textClass: 'text-amber-800',
    borderClass: 'border-amber-200',
    dotClass: 'bg-amber-500',
  },
  elevated: {
    label: 'ELEVATED',
    bgClass: 'bg-blue-50 text-blue-800 border-blue-200',
    textClass: 'text-blue-800',
    borderClass: 'border-blue-200',
    dotClass: 'bg-blue-500',
  },
  routine: {
    label: 'ROUTINE',
    bgClass: 'bg-slate-50 text-slate-700 border-slate-200',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-200',
    dotClass: 'bg-slate-400',
  },
};

export function formatPriorityTierBadge(tier: PriorityTier | string | null | undefined) {
  const t = (tier?.toLowerCase() || 'routine') as PriorityTier;
  const cfg = PRIORITY_TIER_CONFIG[t] || PRIORITY_TIER_CONFIG.routine;
  return {
    label: cfg.label,
    bg: cfg.bgClass.split(' ')[0],
    text: cfg.textClass,
    border: cfg.borderClass,
    dot: cfg.dotClass,
  };
}

/**
 * Evidence Density configuration.
 */
export const EVIDENCE_DENSITY_CONFIG: Record<
  EvidenceDensityTier,
  { label: string; textClass: string; bgClass: string; borderClass: string }
> = {
  high: {
    label: 'High',
    textClass: 'text-emerald-800',
    bgClass: 'bg-emerald-50 border border-emerald-200',
    borderClass: 'border-emerald-200',
  },
  moderate: {
    label: 'Moderate',
    textClass: 'text-sky-800',
    bgClass: 'bg-sky-50 border border-sky-200',
    borderClass: 'border-sky-200',
  },
  sparse: {
    label: 'Sparse',
    textClass: 'text-amber-800',
    bgClass: 'bg-amber-50 border border-amber-200',
    borderClass: 'border-amber-200',
  },
};

export function formatEvidenceDensityBadge(density: EvidenceDensityTier | string | null | undefined) {
  const d = (density?.toLowerCase() || 'sparse') as EvidenceDensityTier;
  const cfg = EVIDENCE_DENSITY_CONFIG[d] || EVIDENCE_DENSITY_CONFIG.sparse;
  return {
    label: cfg.label,
    text: cfg.textClass,
    bg: cfg.bgClass,
    border: cfg.borderClass,
  };
}

/**
 * Decimal and percent formatters
 */
export function formatDecimal(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return val.toFixed(decimals);
}

export function formatPercent(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  // If val is in [0, 1], convert to [0, 100]
  const pct = val <= 1.0 ? val * 100 : val;
  return `${pct.toFixed(decimals)}%`;
}

export function formatPriorityScore(score: number | null | undefined): string {
  if (score === null || score === undefined || isNaN(score)) return '—';
  return score.toFixed(4);
}

export function formatSubScore(score: number | null | undefined): string {
  if (score === null || score === undefined || isNaN(score)) return '—';
  return score.toFixed(2);
}

export function formatCount(count: number | null | undefined): string {
  if (count === null || count === undefined || isNaN(count)) return '—';
  return count.toLocaleString();
}

export function formatUtcDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  } catch {
    return isoString;
  }
}
