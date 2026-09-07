/**
 * TESSERA Alerts & Analyst Triage Type Definitions
 *
 * Defines strongly-typed contracts for alerts synthesized from live telemetry:
 * Priority Signal Scores, potential coordination signals, cross-domain spillovers,
 * and high velocity/diffusion anomalies.
 */

export type AlertSeverity = 'critical' | 'high' | 'medium';

export type AlertCategory =
  | 'priority_breach'
  | 'coordination_anomaly'
  | 'cross_domain_spillover'
  | 'high_velocity';

export type AlertStatus = 'open' | 'acknowledged' | 'dismissed';

export interface AlertItem {
  id: string;
  narrative_id: string;
  topic_id: string;
  title: string;
  claim: string;
  severity: AlertSeverity;
  category: AlertCategory;
  status: AlertStatus;
  priority_score: number;
  message_count: number;
  indicators: string[];
  domains: string[];
  detected_at: string;
  acknowledged_at?: string;
  dismissed_at?: string;
}

export interface AlertStats {
  total: number;
  open: number;
  critical: number;
  high: number;
  acknowledged: number;
  dismissed: number;
}

export interface AlertFilterState {
  status: 'all' | AlertStatus;
  severity: 'all' | AlertSeverity;
  category: 'all' | AlertCategory;
  search: string;
}
