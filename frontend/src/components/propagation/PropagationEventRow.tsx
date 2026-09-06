import React from 'react';
import { PropagationEvent } from '../../data/mock/propagation';
import { Badge } from '../ui/Badge';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

export interface PropagationEventRowProps {
  event: PropagationEvent;
  onSelect: (event: PropagationEvent) => void;
}

export const PropagationEventRow: React.FC<PropagationEventRowProps> = ({ event, onSelect }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(event);
    }
  };

  const strengthBadgeVariant =
    event.strength === 'Observed'
      ? 'data'
      : event.strength === 'Likely'
      ? 'signal'
      : 'neutral';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(event)}
      onKeyDown={handleKeyDown}
      className="group p-4 sm:p-5 rounded-[18px] border border-[rgba(228,233,245,0.85)] bg-white hover:border-[#2F65F6]/40 hover:shadow-xs transition-all duration-150 cursor-pointer space-y-3 focus-visible:outline-2 focus-visible:outline-[#2F65F6] select-none"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-[#8591A5]">{event.timestamp}</span>
          <span className="text-[#8591A5] text-[11px]">•</span>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <Badge variant="neutral" size="sm">{event.sourcePlatform}</Badge>
            <ArrowRight className="w-3.5 h-3.5 text-[#8591A5]" />
            <Badge variant="data" size="sm">{event.destinationPlatform}</Badge>
          </div>
          {typeof event.hopLatencyMinutes === 'number' && (
            <>
              <span className="text-[#8591A5] text-[11px]">•</span>
              <span className="font-mono text-[11px] text-[#2F65F6] font-semibold">
                ~{event.hopLatencyMinutes}m hop
              </span>
            </>
          )}
          <span className="text-[#8591A5] text-[11px]">•</span>
          <Badge variant={strengthBadgeVariant} size="sm">
            {event.strength}
          </Badge>
        </div>

        <div className="flex items-center gap-1 text-[12px] font-semibold text-[#8591A5] group-hover:text-[#2F65F6] transition-colors self-end sm:self-auto">
          <span>Inspect event</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 text-[14px] font-sans">
        <span className="font-bold text-[#111727]">
          {event.sourceCommunity} <span className="text-[#8591A5] font-normal">→</span> {event.destinationCommunity}
        </span>
        <span className="text-[12px] text-[#8591A5] font-mono truncate">
          Topic: {event.topicName}
        </span>
      </div>

      <p className="text-[13px] text-[#475569] font-sans line-clamp-2 leading-relaxed">
        "{event.observation}"
      </p>
    </div>
  );
};
