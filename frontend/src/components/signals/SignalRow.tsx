import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Signal } from '../../data/mock/signals';
import { SignalStatus } from './SignalStatus';
import { SignalStrength } from './SignalStrength';
import { Badge } from '../ui/Badge';
import { ArrowUpRight } from 'lucide-react';

export interface SignalRowProps {
  signal: Signal;
  showDetails?: boolean;
}

export const SignalRow: React.FC<SignalRowProps> = ({ signal, showDetails = true }) => {
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate(`/signals/${signal.id}`);
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
      {/* Left Area: Title, Description, Metadata */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="font-mono text-[11px] font-bold text-[#8591A5] bg-[#F1F4F9] px-2 py-0.5 rounded-full">
            {signal.id.toUpperCase()}
          </span>
          <span className="text-slate-300 text-[11px]">•</span>
          <span className="text-[12px] font-semibold text-[#475569]">
            {signal.type}
          </span>
          <span className="text-slate-300 text-[11px]">•</span>
          <span className="text-[12px] font-medium text-[#8591A5]">
            {signal.detectedAt}
          </span>
        </div>

        <h3 className="text-[15px] font-bold text-[#111727] font-sans leading-snug group-hover:text-[#2F65F6] transition-colors duration-150">
          {signal.title}
        </h3>

        {showDetails && signal.description && (
          <p className="text-[13px] text-[#475569] line-clamp-1 mt-1 font-normal leading-normal">
            {signal.description}
          </p>
        )}

        {/* Source and Language Metadata tags */}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          {signal.sources.map((src) => (
            <Badge key={src} variant={src === 'Telegram' ? 'data' : 'neutral'} size="sm">
              {src}
            </Badge>
          ))}
          {signal.languages.map((lang) => (
            <span
              key={lang}
              className="text-[11px] font-medium text-[#8591A5] bg-[#F6F8FC] px-2 py-0.5 rounded-full border border-slate-200/60"
            >
              {lang}
            </span>
          ))}
        </div>
      </div>

      {/* Right Area: Metric change, Strength, Status, Action */}
      <div className="flex items-center justify-between sm:justify-end gap-5 sm:gap-6 shrink-0 pt-2 sm:pt-0 border-t border-[rgba(228,233,245,0.85)] sm:border-t-0">
        <div className="text-left sm:text-right">
          <div className="text-[11px] font-semibold text-[#8591A5] uppercase tracking-wider">
            Change
          </div>
          <div
            className={`text-[17px] font-bold font-sans tracking-tight ${
              signal.changePercent > 0 ? 'text-[#FF6D5A]' : 'text-[#475569]'
            }`}
          >
            {signal.changePercent > 0 ? `+${signal.changePercent}%` : `${signal.changePercent}%`}
          </div>
        </div>

        <div className="text-left sm:text-right hidden md:block">
          <div className="text-[11px] font-semibold text-[#8591A5] uppercase tracking-wider mb-0.5">
            Priority
          </div>
          <SignalStrength strength={signal.strength} />
        </div>

        <div className="flex items-center gap-3">
          <SignalStatus status={signal.status} />
          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[#8591A5] group-hover:bg-[#2F65F6] group-hover:text-white transition-colors duration-150">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};
