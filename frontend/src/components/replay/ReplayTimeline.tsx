import React from 'react';

export interface ReplayEventItem {
  id: string;
  time: string; // "18:00", "18:20"
  title: string;
  description: string;
  platform: 'X' | 'Telegram';
  changeRate: string;
}

export interface ReplayTimelineProps {
  events: ReplayEventItem[];
  currentIndex: number;
  onSelectIndex: (idx: number) => void;
}

export const ReplayTimeline: React.FC<ReplayTimelineProps> = ({
  events,
  currentIndex,
  onSelectIndex,
}) => {
  return (
    <div className="space-y-2 select-none font-sans">
      <div className="relative py-4">
        {/* Horizontal Line */}
        <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 h-0.5 bg-[rgba(228,233,245,0.85)]" />

        {/* Event Dots */}
        <div className="relative flex items-center justify-between px-4">
          {events.map((evt, idx) => {
            const isSelected = idx === currentIndex;
            const isPast = idx < currentIndex;

            return (
              <button
                key={evt.id}
                type="button"
                onClick={() => onSelectIndex(idx)}
                className="group flex flex-col items-center focus:outline-none cursor-pointer"
                title={`${evt.time}: ${evt.title}`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                    isSelected
                      ? 'bg-[#2F65F6] border-[#2F65F6] ring-4 ring-[#2F65F6]/20 scale-125 shadow-xs'
                      : isPast
                      ? 'bg-[#2F65F6] border-[#2F65F6]'
                      : 'bg-white border-slate-300 group-hover:border-[#2F65F6]'
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? 'bg-white' : 'bg-transparent'
                    }`}
                  />
                </div>

                <span
                  className={`mt-2 text-[11px] font-sans transition-colors ${
                    isSelected
                      ? 'text-[#2F65F6] font-bold'
                      : 'text-[#8591A5] group-hover:text-[#111727] font-medium'
                  }`}
                >
                  {evt.time}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
