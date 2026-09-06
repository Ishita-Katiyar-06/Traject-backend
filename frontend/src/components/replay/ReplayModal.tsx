import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ReplayTimeline, ReplayEventItem } from './ReplayTimeline';
import { ReplayControls } from './ReplayControls';

export interface ReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

const DEFAULT_REPLAY_EVENTS: ReplayEventItem[] = [
  {
    id: 'rep-1',
    time: '18:00',
    title: 'Initial Outage Telemetry Tripping',
    description: 'First public inquiries appear on X from commuters reporting dark signals in Sector 14.',
    platform: 'X',
    changeRate: '+6%',
  },
  {
    id: 'rep-2',
    time: '18:25',
    title: 'Transformer Photos Forwarded into Local Groups',
    description: 'High-resolution scorch photos of 220kV feeder point uploaded into Northern District Residents Telegram channel.',
    platform: 'Telegram',
    changeRate: '+18%',
  },
  {
    id: 'rep-3',
    time: '18:48',
    title: 'Narrative Mutation: Infrastructure Failure Neglect',
    description: 'Citizens begin quoting deferred maintenance log notices. Sentiment turns sharply critical of municipal utility.',
    platform: 'X',
    changeRate: '+27%',
  },
  {
    id: 'rep-4',
    time: '19:05',
    title: 'Utility Acknowledgment Broadcasted',
    description: 'Municipal spokesperson issues preliminary bulletin attributing outage to breaker fault. Repair crews dispatched.',
    platform: 'X',
    changeRate: '+14%',
  },
  {
    id: 'rep-5',
    time: '19:25',
    title: 'Commercial Haulage Secondary Inquiry Spillovers',
    description: 'Logistics syndicate discussions on Telegram question backup generator fuel supplies for cold-chain transit.',
    platform: 'Telegram',
    changeRate: '+9%',
  },
];

export const ReplayModal: React.FC<ReplayModalProps> = ({
  isOpen,
  onClose,
  title = 'Incident Telemetry Replay',
}) => {
  const [events] = useState<ReplayEventItem[]>(DEFAULT_REPLAY_EVENTS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 5>(1);

  // Playback timer
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = Math.round(2000 / speed);
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev < events.length - 1) {
          return prev + 1;
        } else {
          setIsPlaying(false);
          return prev;
        }
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, speed, events.length]);

  if (!isOpen) return null;

  const currentEvent = events[currentIndex];

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setIsPlaying(false);
        onClose();
      }}
      title={title}
      subtitle="Stepwise chronological playback of observed event diffusion and claim mutations"
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[12px] font-medium text-[#8591A5]">
            Event {currentIndex + 1} of {events.length}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsPlaying(false);
              onClose();
            }}
          >
            Close Replay
          </Button>
        </div>
      }
    >
      <div className="space-y-5 font-sans py-1 select-none">
        {/* Scrubber Timeline */}
        <ReplayTimeline
          events={events}
          currentIndex={currentIndex}
          onSelectIndex={(idx) => {
            setCurrentIndex(idx);
            setIsPlaying(false);
          }}
        />

        {/* Current Event Card */}
        <div className="p-5 rounded-[20px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[#111727] text-[14px] font-bold">
                {currentEvent.time} UTC
              </span>
              <span className="text-slate-300">•</span>
              <Badge
                variant={currentEvent.platform === 'Telegram' ? 'data' : 'neutral'}
                size="sm"
              >
                {currentEvent.platform}
              </Badge>
            </div>

            <span className="text-[12px] text-[#FF6D5A] font-bold">
              Activity shift: {currentEvent.changeRate}
            </span>
          </div>

          <h4 className="text-[15px] font-bold text-[#111727]">
            {currentEvent.title}
          </h4>

          <p className="text-[13px] text-[#475569] leading-relaxed">
            {currentEvent.description}
          </p>
        </div>

        {/* Playback Controls */}
        <ReplayControls
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          onPrev={() => {
            setIsPlaying(false);
            if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
          }}
          onNext={() => {
            setIsPlaying(false);
            if (currentIndex < events.length - 1) setCurrentIndex(currentIndex + 1);
          }}
          hasPrev={currentIndex > 0}
          hasNext={currentIndex < events.length - 1}
          speed={speed}
          onSpeedChange={setSpeed}
        />
      </div>
    </Modal>
  );
};
