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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80">
            OPEN
          </span>
        );
      case 'acknowledged':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/80">
            ACKNOWLEDGED
          </span>
        );
      case 'dismissed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            DISMISSED
          </span>
        );
    }
  };

  return (
    <div className="p-5 sm:p-6 rounded-[24px] sm:rounded-[26px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs hover:border-amber-400/80 dark:hover:border-amber-500/50 hover:shadow-xs transition-all duration-200 space-y-4 font-sans">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {getSeverityBadge()}
          <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-[#FAFBFD] dark:bg-[#12161C] text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-[#282F3A]">
            {getCategoryLabel()}
          </span>
          {getStatusBadge()}
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="font-mono text-[11px] font-bold text-[#2F65F6] dark:text-[#93C5FD]">
            {alert.narrative_id}
          </span>
          {alert.topic_id && (
            <span className="font-mono text-[11px] text-[#64748B] dark:text-slate-400">
              (Trend #{alert.topic_id.replace(/^topic_|^trend_/, '')})
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#8591A5] dark:text-slate-400">
          <Clock className="w-3.5 h-3.5 text-[#8591A5]" />
          <span>{new Date(alert.detected_at).toLocaleString()}</span>
        </div>
      </div>

      {/* Narrative Headline Claim */}
      <div>
        <h3 className="text-[16px] font-bold text-[#111727] dark:text-slate-100 tracking-tight leading-snug">
          {alert.narrative_name || alert.claim}
        </h3>
        {alert.narrative_name && alert.claim && alert.claim !== alert.narrative_name && (
          <p className="text-[13px] text-[#64748B] dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            {alert.claim}
          </p>
        )}
      </div>

      {/* Telemetry Indicator Tags */}
      <div className="flex flex-wrap gap-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] text-[11px] font-mono text-[#111727] dark:text-slate-200 shadow-2xs">
          <span className="text-[#8591A5] dark:text-slate-400">Signal:</span>
          <strong>{alert.priority_score.toFixed(3)}</strong>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] text-[11px] font-mono text-[#111727] dark:text-slate-200 shadow-2xs">
          <MessageSquare className="w-3 h-3 text-[#2F65F6] dark:text-[#93C5FD]" />
          <span>{alert.message_count} messages</span>
        </div>

        {alert.domains.length > 0 && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] text-[11px] font-mono text-[#111727] dark:text-slate-200 shadow-2xs">
            <Globe className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>{alert.domains.join(', ')}</span>
          </div>
        )}

        {alert.indicators.map((ind, idx) => (
          <span
            key={idx}
            className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] text-[11px] font-mono text-[#64748B] dark:text-slate-400 shadow-2xs"
          >
            {ind}
          </span>
        ))}
      </div>

      {/* Bottom Action Footer */}
      <div className="pt-3 border-t border-slate-100 dark:border-[#252B32] flex flex-wrap items-center justify-between gap-3">
        {/* Analyst Triage State Buttons */}
        <div className="flex items-center gap-2">
          {alert.status === 'open' && (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full px-4 hover:border-emerald-400/80 dark:hover:border-emerald-500/50"
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                onClick={() => onStatusChange(alert.id, 'acknowledged')}
              >
                Acknowledge
              </Button>
              <Button
                variant="subtle"
                size="sm"
                className="rounded-full px-4"
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
                className="rounded-full px-4"
                leftIcon={<RotateCcw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                onClick={() => onStatusChange(alert.id, 'open')}
              >
                Reopen
              </Button>
              <Button
                variant="subtle"
                size="sm"
                className="rounded-full px-4"
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
              className="rounded-full px-4"
              leftIcon={<RotateCcw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
              onClick={() => onStatusChange(alert.id, 'open')}
            >
              Reopen
            </Button>
          )}
        </div>

        {/* Deep Dive Exploration Links */}
        <div className="flex items-center gap-2">
          <Link to={`/narratives/${encodeURIComponent(alert.narrative_id)}`}>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full px-4 hover:border-amber-400/80 dark:hover:border-amber-500/50 group/dossier"
              rightIcon={<ExternalLink className="w-3.5 h-3.5 text-[#8591A5] group-hover/dossier:text-amber-500 transition-colors" />}
            >
              View Dossier
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
