import React from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  ExternalLink,
  Clock,
  MessageSquare,
  Globe,
} from 'lucide-react';
import type { AlertItem, AlertStatus } from '../../types/alerts';
import { Button } from '../ui/Button';

interface AlertRowProps {
  alert: AlertItem;
  onStatusChange: (alertId: string, status: AlertStatus) => void;
}

export const AlertRow: React.FC<AlertRowProps> = ({ alert, onStatusChange }) => {
  const getSeverityBadge = () => {
    switch (alert.severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
            CRITICAL
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            HIGH
          </span>
        );
      case 'elevated':
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            ELEVATED
          </span>
        );
      case 'routine':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            ROUTINE
          </span>
        );
    }
  };

  const getCategoryLabel = () => {
    switch (alert.category) {
      case 'priority_breach':
        return 'Priority Breach';
      case 'coordination_anomaly':
        return 'Coordination Signal';
      case 'cross_domain_spillover':
        return 'Cross-Domain Spillover';
      case 'high_velocity':
        return 'High Velocity';
      default:
        return 'Anomaly';
    }
  };

  const getStatusBadge = () => {
    switch (alert.status) {
      case 'open':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            OPEN
          </span>
        );
      case 'acknowledged':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
            ACKNOWLEDGED
          </span>
        );
      case 'dismissed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            DISMISSED
          </span>
        );
    }
  };

  return (
    <div className="p-5 rounded-[20px] bg-white dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-xs transition-all hover:border-[#2F65F6]/40 space-y-4">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {getSeverityBadge()}
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {getCategoryLabel()}
          </span>
          {getStatusBadge()}
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="font-mono text-[11px] font-bold text-[#2F65F6]">
            {alert.narrative_id}
          </span>
          {alert.topic_id && (
            <span className="font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              (Trend #{alert.topic_id.replace(/^topic_|^trend_/, '')})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-[#8591A5] dark:text-[#94A3B8]">
          <Clock className="w-3.5 h-3.5" />
          <span>{new Date(alert.detected_at).toLocaleString()}</span>
        </div>
      </div>

      {/* Narrative Headline Claim */}
      <div>
        <h3 className="text-[15px] font-bold text-[#111727] dark:text-[#F8FAFC] leading-snug">
          {alert.narrative_name || alert.claim}
        </h3>
        {alert.narrative_name && alert.claim && alert.claim !== alert.narrative_name && (
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5 line-clamp-1">
            {alert.claim}
          </p>
        )}
      </div>

      {/* Telemetry Indicator Tags */}
      <div className="flex flex-wrap gap-2">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F8FAFD] dark:bg-[#1A2027] border border-slate-200/70 dark:border-slate-800 text-[11px] font-mono text-[#111727] dark:text-[#F8FAFC]">
          <span className="text-[#8591A5]">Signal Score:</span>
          <strong>{alert.priority_score.toFixed(3)}</strong>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F8FAFD] dark:bg-[#1A2027] border border-slate-200/70 dark:border-slate-800 text-[11px] font-mono text-[#111727] dark:text-[#F8FAFC]">
          <MessageSquare className="w-3 h-3 text-[#2F65F6]" />
          <span>{alert.message_count} messages</span>
        </div>

        {alert.domains.length > 0 && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F8FAFD] dark:bg-[#1A2027] border border-slate-200/70 dark:border-slate-800 text-[11px] font-mono text-[#111727] dark:text-[#F8FAFC]">
            <Globe className="w-3 h-3 text-emerald-600" />
            <span>{alert.domains.join(', ')}</span>
          </div>
        )}

        {alert.indicators.map((ind, idx) => (
          <span
            key={idx}
            className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 text-[11px] text-[#64748B] dark:text-[#94A3B8]"
          >
            {ind}
          </span>
        ))}
      </div>

      {/* Bottom Action Footer */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Analyst Triage State Buttons */}
        <div className="flex items-center gap-2">
          {alert.status === 'open' && (
            <>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                onClick={() => onStatusChange(alert.id, 'acknowledged')}
              >
                Acknowledge
              </Button>
              <Button
                variant="subtle"
                size="sm"
                leftIcon={<XCircle className="w-3.5 h-3.5 text-slate-500" />}
                onClick={() => onStatusChange(alert.id, 'dismissed')}
              >
                Dismiss
              </Button>
            </>
          )}

          {alert.status === 'acknowledged' && (
            <>
              <Button
                variant="subtle"
                size="sm"
                leftIcon={<RotateCcw className="w-3.5 h-3.5 text-blue-600" />}
                onClick={() => onStatusChange(alert.id, 'open')}
              >
                Reopen
              </Button>
              <Button
                variant="subtle"
                size="sm"
                leftIcon={<XCircle className="w-3.5 h-3.5 text-slate-500" />}
                onClick={() => onStatusChange(alert.id, 'dismissed')}
              >
                Dismiss
              </Button>
            </>
          )}

          {alert.status === 'dismissed' && (
            <Button
              variant="subtle"
              size="sm"
              leftIcon={<RotateCcw className="w-3.5 h-3.5 text-blue-600" />}
              onClick={() => onStatusChange(alert.id, 'open')}
            >
              Reopen
            </Button>
          )}
        </div>

        {/* Deep Dive Exploration Links */}
        <div className="flex items-center gap-2">
          <Link to={`/narratives/${alert.narrative_id}`}>
            <Button
              variant="secondary"
              size="sm"
              rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
            >
              View Dossier
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
