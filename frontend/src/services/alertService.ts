/**
 * TESSERA Alert Service
 *
 * Synthesizes analyst triage alerts from live backend telemetry:
 * - Priority Signal Scores >= 0.55 (Critical / High breaches)
 * - Potential coordination signals (syndication spikes, temporal bursts)
 * - Cross-domain narrative diffusion
 * - Spread velocity anomalies
 *
 * Persists analyst triage state (Open / Acknowledged / Dismissed) in localStorage
 * and emits custom DOM events for instantaneous multi-component synchronization.
 */

import { useState, useEffect } from 'react';
import { telemetryApi } from './telemetryApi';
import type { AlertItem, AlertStats, AlertStatus, AlertSeverity, AlertCategory } from '../types/alerts';
import type { NarrativeSummaryResponse } from '../types/api';

const STORAGE_KEY = 'tessera_alert_status_v1';
export const ALERTS_CHANGED_EVENT = 'tessera:alerts-updated';

interface PersistedStatus {
  status: AlertStatus;
  timestamp: string;
}

function getPersistedStatuses(): Record<string, PersistedStatus> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn('Failed to parse persisted alert statuses:', err);
    return {};
  }
}

function savePersistedStatus(alertId: string, status: AlertStatus): void {
  if (typeof window === 'undefined') return;
  try {
    const map = getPersistedStatuses();
    map[alertId] = {
      status,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(ALERTS_CHANGED_EVENT, { detail: { alertId, status } }));
  } catch (err) {
    console.error('Failed to persist alert status:', err);
  }
}

function savePersistedStatusesBatch(updates: Record<string, AlertStatus>): void {
  if (typeof window === 'undefined') return;
  try {
    const map = getPersistedStatuses();
    const now = new Date().toISOString();
    Object.entries(updates).forEach(([id, st]) => {
      map[id] = { status: st, timestamp: now };
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(ALERTS_CHANGED_EVENT, { detail: { batch: true } }));
  } catch (err) {
    console.error('Failed to batch persist alert statuses:', err);
  }
}

/**
 * Evaluates a narrative candidate and returns a synthesized AlertItem if trigger conditions are met.
 */
function evaluateNarrativeAlert(
  narrative: NarrativeSummaryResponse,
  persistedMap: Record<string, PersistedStatus>
): AlertItem | null {
  const score = narrative.priority_signal_score;
  const sub = narrative.sub_scores;
  const hasCoordination = narrative.has_coordination_signals || (sub && sub.coordination_score >= 0.50);
  const isCrossDomain = narrative.is_cross_domain || (narrative.distinct_domains_count && narrative.distinct_domains_count >= 2);
  const hasHighVelocity = sub && sub.spread_score >= 0.65;

  // If score is below 0.45 and no anomalous signals are present, skip
  if (score < 0.45 && !hasCoordination && !isCrossDomain && !hasHighVelocity) {
    return null;
  }

  // Determine Severity and Category
  let severity: AlertSeverity = 'medium';
  let category: AlertCategory = 'priority_breach';
  let title = `Priority Alert: ${narrative.narrative_id}`;
  const indicators: string[] = [];

  if (score >= 0.70) {
    severity = 'critical';
    category = 'priority_breach';
    title = `Critical Priority Breach: ${narrative.narrative_id}`;
    indicators.push(`Critical Priority Signal Score: ${score.toFixed(3)}`);
  } else if (score >= 0.55) {
    severity = 'high';
    category = 'priority_breach';
    title = `High Priority Signal Threshold: ${narrative.narrative_id}`;
    indicators.push(`High Priority Signal Score: ${score.toFixed(3)}`);
  }

  if (hasCoordination) {
    if (severity !== 'critical') severity = 'high';
    category = 'coordination_anomaly';
    title = `Coordination Anomaly: ${narrative.narrative_id}`;
    indicators.push(`Potential syndication or temporal burst pattern (Coordination: ${(sub?.coordination_score ?? 0).toFixed(2)})`);
  }

  if (isCrossDomain) {
    if (severity !== 'critical') severity = 'high';
    category = 'cross_domain_spillover';
    title = `Cross-Domain Spillover: ${narrative.narrative_id}`;
    const domains = narrative.domains_represented || [];
    indicators.push(`Observed across ${domains.length || narrative.distinct_domains_count || 2} distinct domains${domains.length > 0 ? ` (${domains.join(', ')})` : ''}`);
  }

  if (hasHighVelocity && indicators.length === 0) {
    category = 'high_velocity';
    title = `Elevated Diffusion Velocity: ${narrative.narrative_id}`;
    indicators.push(`Observed high spread velocity: ${(sub?.spread_score ?? 0).toFixed(2)}`);
  }

  indicators.push(`${narrative.message_count} constituent messages analyzed`);

  const alertId = `alt-${narrative.narrative_id}`;
  const persisted = persistedMap[alertId];

  return {
    id: alertId,
    narrative_id: narrative.narrative_id,
    topic_id: narrative.promoted_from_topic_id,
    title,
    claim: narrative.headline_claim,
    severity,
    category,
    status: persisted ? persisted.status : 'open',
    priority_score: score,
    message_count: narrative.message_count,
    indicators,
    domains: narrative.domains_represented || [],
    detected_at: narrative.last_observed_at || narrative.first_observed_at || new Date().toISOString(),
    acknowledged_at: persisted?.status === 'acknowledged' ? persisted.timestamp : undefined,
    dismissed_at: persisted?.status === 'dismissed' ? persisted.timestamp : undefined,
  };
}

const _liveAlertsMap = new Map<string, AlertItem>();

export const alertService = {
  /**
   * Register an in-flight live alert received via WebSocket stream.
   */
  addLiveAlert(alert: AlertItem): void {
    _liveAlertsMap.set(alert.id, alert);
  },

  /**
   * Fetches live telemetry and returns prioritized alerts.
   */
  async getAlerts(): Promise<AlertItem[]> {
    const res = await telemetryApi.getNarratives({
      page: 1,
      page_size: 50,
      sort_by: 'priority_signal_score',
      order: 'desc',
    });

    const persistedMap = getPersistedStatuses();
    const alerts: AlertItem[] = [];

    // 1. Incorporate live stream in-flight alerts
    _liveAlertsMap.forEach((liveAlert) => {
      const persisted = persistedMap[liveAlert.id];
      alerts.push({
        ...liveAlert,
        status: persisted ? persisted.status : liveAlert.status,
      });
    });

    // 2. Evaluate narrative alerts
    for (const narrative of res.data) {
      const alert = evaluateNarrativeAlert(narrative, persistedMap);
      if (alert && !alerts.some((a) => a.id === alert.id)) {
        alerts.push(alert);
      }
    }

    // Sort: open first, then critical -> high -> medium, then score descending
    return alerts.sort((a, b) => {
      if (a.status === 'open' && b.status !== 'open') return -1;
      if (a.status !== 'open' && b.status === 'open') return 1;

      const severityRank: Record<AlertSeverity, number> = { critical: 3, high: 2, medium: 1 };
      const rankDiff = severityRank[b.severity] - severityRank[a.severity];
      if (rankDiff !== 0) return rankDiff;

      return b.priority_score - a.priority_score;
    });
  },

  /**
   * Updates an alert's status with local client persistence.
   */
  setAlertStatus(alertId: string, status: AlertStatus): void {
    savePersistedStatus(alertId, status);
  },

  /**
   * Batch acknowledge alerts.
   */
  acknowledgeAll(alertIds: string[]): void {
    const updates: Record<string, AlertStatus> = {};
    alertIds.forEach((id) => {
      updates[id] = 'acknowledged';
    });
    savePersistedStatusesBatch(updates);
  },

  /**
   * Computes aggregate summary statistics for alerts.
   */
  computeStats(alerts: AlertItem[]): AlertStats {
    const stats: AlertStats = {
      total: alerts.length,
      open: 0,
      critical: 0,
      high: 0,
      acknowledged: 0,
      dismissed: 0,
    };

    alerts.forEach((alt) => {
      if (alt.status === 'open') stats.open += 1;
      if (alt.status === 'acknowledged') stats.acknowledged += 1;
      if (alt.status === 'dismissed') stats.dismissed += 1;
      if (alt.severity === 'critical') stats.critical += 1;
      if (alt.severity === 'high') stats.high += 1;
    });

    return stats;
  },
};

/**
 * React hook to subscribe to real-time open alerts count across navigation items.
 */
export function useAlertsCount(): { count: number; isLoading: boolean } {
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshCount = async () => {
    try {
      const alerts = await alertService.getAlerts();
      const openCount = alerts.filter((a) => a.status === 'open').length;
      setCount(openCount);
    } catch (e) {
      console.warn('Failed to refresh alert count:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshCount();

    const handleUpdate = () => {
      refreshCount();
    };

    window.addEventListener(ALERTS_CHANGED_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(ALERTS_CHANGED_EVENT, handleUpdate);
    };
  }, []);

  return { count, isLoading };
}
