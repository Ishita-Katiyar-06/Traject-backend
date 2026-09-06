import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../../data/mock/alerts';
import { AlertStatus } from './AlertStatus';
import { AlertPriority } from './AlertPriority';
import { Button } from '../ui/Button';
import { ArrowUpRight, Check, Play, CheckCheck } from 'lucide-react';

export interface AlertRowProps {
  alert: Alert;
  onAcknowledge: (id: string, e: React.MouseEvent) => void;
  onReview: (id: string, e: React.MouseEvent) => void;
  onResolve: (id: string, e: React.MouseEvent) => void;
}

export const AlertRow: React.FC<AlertRowProps> = ({
  alert,
  onAcknowledge,
  onReview,
  onResolve,
}) => {
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate(`/investigation/${alert.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNavigate();
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      className="group relative flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-[20px] border border-[rgba(228,233,245,0.85)] bg-white hover:bg-[#F8FAFD] hover:border-slate-300/80 shadow-xs transition-all duration-150 cursor-pointer gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/40 select-none"
    >
      {/* Left Column: Title, Topic, Platform, Detected Time */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="font-mono text-[11px] font-bold text-[#8591A5] bg-[#F1F4F9] px-2 py-0.5 rounded-full">
            {alert.id.toUpperCase()}
          </span>
          <span className="text-slate-300 text-[11px]">•</span>
          <AlertPriority priority={alert.priority} />
          <span className="text-slate-300 text-[11px]">•</span>
          <span className="text-[12px] font-medium text-[#8591A5]">
            Detected {alert.detectedAt}
          </span>
        </div>

        <h3 className="text-[15px] font-bold text-[#111727] font-sans leading-snug group-hover:text-[#2F65F6] transition-colors duration-150">
          {alert.title}
        </h3>

        <div className="flex items-center gap-2 mt-2.5 flex-wrap text-[11px]">
          <span className="text-[#8591A5] font-medium">Topic:</span>
          <span className="text-[#2F65F6] bg-[#EFF4FE] font-medium px-2 py-0.5 rounded-full border border-[#D6E3FD]">
            {alert.topicName}
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-[#8591A5] font-medium">Platform:</span>
          <span className="text-[#111727] font-semibold">{alert.platform}</span>
        </div>
      </div>

      {/* Right Column: Status & Inline Action Buttons */}
      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t border-[rgba(228,233,245,0.85)] sm:border-t-0">
        <AlertStatus status={alert.status} />

        {/* Action button corresponding to state machine */}
        <div className="flex items-center gap-2">
          {alert.status === 'New' && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Check className="w-3.5 h-3.5 text-[#2F65F6]" />}
              onClick={(e) => {
                e.stopPropagation();
                onAcknowledge(alert.id, e);
              }}
              title="Acknowledge alert"
            >
              Acknowledge
            </Button>
          )}

          {alert.status === 'Acknowledged' && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Play className="w-3.5 h-3.5 text-[#FF6D5A]" />}
              onClick={(e) => {
                e.stopPropagation();
                onReview(alert.id, e);
              }}
              title="Start review"
            >
              Start Review
            </Button>
          )}

          {alert.status === 'Under review' && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<CheckCheck className="w-3.5 h-3.5 text-[#10B981]" />}
              onClick={(e) => {
                e.stopPropagation();
                onResolve(alert.id, e);
              }}
              title="Resolve alert"
            >
              Resolve
            </Button>
          )}

          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[#8591A5] group-hover:bg-[#2F65F6] group-hover:text-white transition-colors duration-150">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};
