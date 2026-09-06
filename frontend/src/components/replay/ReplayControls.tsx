import React from 'react';
import { Button } from '../ui/Button';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

export interface ReplayControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  speed: 1 | 2 | 5;
  onSpeedChange: (speed: 1 | 2 | 5) => void;
}

export const ReplayControls: React.FC<ReplayControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  speed,
  onSpeedChange,
}) => {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-[18px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] font-sans text-[12px] select-none shadow-2xs">
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onPrev}
          disabled={!hasPrev}
          title="Previous event"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={onTogglePlay}
          title={isPlaying ? 'Pause replay' : 'Play progression'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={onNext}
          disabled={!hasNext}
          title="Next event"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[#8591A5] text-[11px] font-bold mr-1 tracking-wider uppercase">Speed:</span>
        {([1, 2, 5] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSpeedChange(s)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
              speed === s
                ? 'bg-[#2F65F6] text-white shadow-xs'
                : 'bg-white text-[#475569] border border-[rgba(228,233,245,0.85)] hover:bg-[#F1F4F9] hover:text-[#111727]'
            }`}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
};
