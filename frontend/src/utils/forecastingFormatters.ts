/**
 * Milestone 8F: Emerging Trend Forecasting Formatters & Presentation Helpers
 *
 * Provides authoritative visual mappings conforming strictly to TRAJECT product guidelines:
 * - Scores displayed strictly as "Emerging Trend Score: X.XX" (NEVER probability or percentage)
 * - Trajectory mapped to human-readable labels and directional symbols (accessible, not color-only)
 * - Confidence mapped to clean tiers (High, Medium, Low, Insufficient data)
 * - Freshness timestamps formatted as clear UTC representations
 * - ZERO client-side score calculations
 */

import type { ForecastTier, TrajectoryPhase, ConfidenceTier } from '../types/forecasting';

/**
 * Format score as ranking signal decimal.
 * NEVER label as probability, certainty, or percentage chance.
 */
export function formatForecastScore(score: number): string {
  if (typeof score !== 'number' || isNaN(score)) return '0.00';
  return score.toFixed(2);
}

/**
 * Emergence Tier presentation configuration.
 */
export function formatForecastTier(tier: ForecastTier): {
  label: string;
  badgeClass: string;
} {
  switch (tier) {
    case 'STRONG_EMERGENCE':
      return {
        label: 'Strong Emergence',
        badgeClass:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
      };
    case 'MODERATE_EMERGENCE':
      return {
        label: 'Moderate Emergence',
        badgeClass:
          'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
      };
    case 'EARLY_SIGNAL':
      return {
        label: 'Early Signal',
        badgeClass:
          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
      };
    case 'LOW_MOMENTUM':
    default:
      return {
        label: 'Low Momentum',
        badgeClass:
          'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700/60',
      };
  }
}

/**
 * Trajectory phase presentation configuration.
 * Includes directional Unicode symbol for accessibility (never color-only).
 */
export function formatTrajectory(phase: TrajectoryPhase): {
  label: string;
  symbol: string;
  badgeClass: string;
} {
  switch (phase) {
    case 'ACCELERATING':
      return {
        label: 'Accelerating',
        symbol: '↑',
        badgeClass:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
      };
    case 'GROWING':
      return {
        label: 'Growing',
        symbol: '↗',
        badgeClass:
          'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60',
      };
    case 'PERSISTENT':
      return {
        label: 'Persistent',
        symbol: '→',
        badgeClass:
          'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60',
      };
    case 'STABLE':
      return {
        label: 'Stable',
        symbol: '↔',
        badgeClass:
          'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700/60',
      };
    case 'WEAKENING':
      return {
        label: 'Weakening',
        symbol: '↘',
        badgeClass:
          'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
      };
    case 'INSUFFICIENT_DATA':
    default:
      return {
        label: 'Insufficient data',
        symbol: '—',
        badgeClass:
          'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/50',
      };
  }
}

/**
 * Confidence tier presentation configuration.
 */
export function formatConfidence(tier: ConfidenceTier): {
  label: string;
  badgeClass: string;
} {
  switch (tier) {
    case 'HIGH':
      return {
        label: 'High',
        badgeClass:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
      };
    case 'MEDIUM':
      return {
        label: 'Medium',
        badgeClass:
          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
      };
    case 'LOW':
      return {
        label: 'Low',
        badgeClass:
          'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700/60',
      };
    case 'INSUFFICIENT_DATA':
    default:
      return {
        label: 'Insufficient data',
        badgeClass:
          'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/50',
      };
  }
}

/**
 * Normalizes and formats topic identifiers for analyst display.
 * Prioritizes proper human-readable trend names over technical IDs.
 * e.g. "causal_20260905_1200_062" with topic_name "Opwatch–Market Inflation Discourse" -> "Opwatch – Market Inflation Discourse"
 */
export function formatTopicDisplayName(
  topicId: string,
  topicName?: string | null,
  keywords?: string[]
): string {
  if (topicName && topicName.trim().length > 0) {
    return topicName
      .replace(/#/g, '')
      .replace(/[\uFFFD?]+/g, ' – ')
      .replace(/[–—]/g, ' – ')
      .replace(/\s*–\s*/g, ' – ')
      .trim();
  }

  // Fallback to synthesizing title from top representative keywords if available
  if (keywords && keywords.length > 0) {
    const valid = keywords.filter((k) => k && k.length >= 3).slice(0, 3);
    if (valid.length > 0) {
      const title = valid.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return `${title} Discourse`;
    }
  }

  if (!topicId) return 'Topic';
  const causalMatch = topicId.match(/^causal_\d+_\d+_(\d+)$/);
  if (causalMatch) {
    return `Topic #${causalMatch[1]}`;
  }
  const standardMatch = topicId.match(/^topic_(\d+)$/);
  if (standardMatch) {
    return `Topic #${standardMatch[1]}`;
  }
  return topicId;
}

/**
 * Formats ISO UTC timestamps into analyst-friendly strings.
 * e.g. "2026-09-05T12:00:00Z" -> "Sep 5, 2026 · 12:00 UTC"
 */
export function formatUtcDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      hour12: false,
    }) + ' UTC';
  } catch {
    return isoString;
  }
}

/**
 * Returns human-readable label for forecast horizon.
 */
export function formatHorizonLabel(hours: number): string {
  if (hours === 24) return '24h Horizon (Primary)';
  if (hours === 6) return '6h Horizon (Auxiliary)';
  return `${hours}h Horizon`;
}
