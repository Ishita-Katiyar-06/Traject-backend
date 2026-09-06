import React from 'react';
import { Badge } from '../ui/Badge';

export interface TopicMoment {
  timestamp: string;
  title: string;
  platform?: string;
}

export interface TopicMomentsProps {
  moments: TopicMoment[];
  className?: string;
}

export const TopicMoments: React.FC<TopicMomentsProps> = ({ moments, className = '' }) => {
  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-5 sm:p-6 shadow-xs space-y-4 ${className}`}>
      <div>
        <h4 className="text-[16px] font-bold text-[#111727]">
          Topic Moments
        </h4>
        <p className="text-[#8591A5] text-[12px] font-mono mt-0.5">
          Chronological sequence of pivotal volume shifts and source relay events
        </p>
      </div>

      <div className="relative border-l border-[rgba(228,233,245,0.85)] pl-4 ml-2 space-y-4 py-1">
        {moments.map((m, i) => (
          <div key={i} className="relative group">
            {/* Dot Indicator */}
            <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#2F65F6] ring-4 ring-white" />

            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] text-[#8591A5]">
                  {m.timestamp}
                </span>
                {m.platform && (
                  <Badge variant={m.platform === 'Telegram' ? 'data' : 'neutral'} size="sm">
                    {m.platform}
                  </Badge>
                )}
              </div>
            </div>

            <p className="text-[13px] font-medium text-[#111727] mt-1 leading-snug">
              {m.title}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
