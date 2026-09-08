import React, { useState, useRef, useEffect } from 'react';
import { Radio, Pause, Play, ChevronDown, Clock } from 'lucide-react';
import { useLiveStream } from '../../contexts/LiveStreamContext';

export const LiveStreamBadge: React.FC = () => {
  const {
    connectionStatus,
    latencyMs,
    liveMessages,
    isPaused,
    togglePause,
    totalCorpusCount,
    channelsJoined,
    channelsMonitored,
  } = useLiveStream();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
              LIVE
            </span>
            {latencyMs > 0 && (
              <span className="text-[10px] font-mono text-[#8591A5] dark:text-[#94A3B8]">
                {latencyMs}ms
              </span>
            )}
          </div>
        );
      case 'reconnecting':
      case 'connecting':
        return (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex rounded-full h-2 w-2 bg-amber-500 animate-pulse" />
            <span className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-400">
              CONNECTING
            </span>
          </div>
        );
      case 'disconnected':
      default:
        return (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex rounded-full h-2 w-2 bg-slate-400" />
            <span className="text-[11px] font-mono font-bold text-slate-500">
              OFFLINE
            </span>
          </div>
        );
    }
  };

  return (
    <div className="relative font-sans" ref={popoverRef}>
      {/* Clickable Header Pill */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 h-10 px-3 rounded-full bg-white/90 dark:bg-[#181C22]/90 border border-slate-300/80 dark:border-[#333C48] shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:border-slate-400 dark:hover:border-slate-600 transition-all cursor-pointer shrink-0"
        aria-label="Toggle live stream monitor"
      >
        <Radio className="w-3.5 h-3.5 text-[#2F65F6]" />
        {getStatusBadge()}
        <ChevronDown className={`w-3 h-3 text-[#8591A5] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Live Stream Popover Drawer */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-[20px] bg-white dark:bg-[#13171C] border border-[rgba(228,233,245,0.9)] dark:border-[#252B32] shadow-2xl z-50 p-4 space-y-3 font-sans">
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-[#111727] dark:text-[#F8FAFC]">
                Real-Time Telegram Stream
              </span>
              {totalCorpusCount !== null && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-50 dark:bg-blue-950/40 text-[#2F65F6] border border-blue-200 dark:border-blue-900">
                  {totalCorpusCount.toLocaleString()} msgs
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={togglePause}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#64748B] hover:text-[#111727] transition-colors"
              title={isPaused ? 'Resume live feed' : 'Pause live feed'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-600" /> : <Pause className="w-3.5 h-3.5 text-amber-600" />}
            </button>
          </div>

          {channelsMonitored > 0 && (
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-[12px] bg-slate-50 dark:bg-[#1D232A] text-[11px] font-mono text-[#64748B] dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>MTProto Push Active</span>
              </span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                {channelsJoined}/{channelsMonitored} channels
              </span>
            </div>
          )}

          {/* Messages Feed */}
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-slate-800/60">
            {liveMessages.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-[#8591A5]">
                <Radio className="w-5 h-5 text-[#2F65F6] mx-auto mb-1.5 animate-pulse" />
                <span>Awaiting live Telegram broadcasts...</span>
              </div>
            ) : (
              liveMessages.slice(0, 15).map((msg) => (
                <div key={msg.message_id} className="pt-2 first:pt-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-[#2F65F6] truncate max-w-[180px]">
                      {msg.channel_username ? `@${msg.channel_username}` : msg.channel_title}
                    </span>
                    <span className="text-[10px] font-mono text-[#8591A5] flex items-center gap-1 shrink-0">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#334155] dark:text-[#CBD5E1] line-clamp-2 leading-relaxed">
                    {msg.text_preview}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-[#8591A5]">
                    <span>{msg.views.toLocaleString()} views</span>
                    {msg.forwards > 0 && <span>• {msg.forwards} forwards</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
