import React from 'react';
import { ArrowDown, Radio } from 'lucide-react';
import { Badge } from '../ui/Badge';

export interface NarrativePlatformMovementProps {
  xShare: number;
  telegramShare: number;
  movementNote: string;
  className?: string;
}

export const NarrativePlatformMovement: React.FC<NarrativePlatformMovementProps> = ({
  xShare,
  telegramShare,
  movementNote,
  className = '',
}) => {
  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-6 shadow-xs space-y-5 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-[#2F65F6]" />
          <h4 className="text-[17px] font-bold font-sans text-[#111727]">
            Cross-Platform Movement Profile
          </h4>
        </div>
        <span className="font-sans text-[12px] text-[#8591A5]">
          Platform Dispersion
        </span>
      </div>

      {/* Two Column Platform Progression */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* X Platform Column */}
        <div className="p-4 rounded-[20px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="neutral" size="sm">X (Twitter) • {xShare}%</Badge>
            <span className="font-sans text-[11px] font-semibold text-[#8591A5]">Origin Node</span>
          </div>

          <div className="space-y-2 text-[12px] font-sans">
            <div className="p-3 rounded-[14px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
              <span className="text-[10px] font-bold text-[#8591A5] uppercase tracking-wider block">STAGE 1</span>
              <span className="text-[#111727] font-medium">Initial rapid discussion surfacing</span>
            </div>
            <div className="text-center text-slate-300">
              <ArrowDown className="w-3.5 h-3.5 mx-auto" />
            </div>
            <div className="p-3 rounded-[14px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
              <span className="text-[10px] font-bold text-[#8591A5] uppercase tracking-wider block">STAGE 2</span>
              <span className="text-[#111727] font-medium">High volume spike & quote amplification</span>
            </div>
            <div className="text-center text-slate-300">
              <ArrowDown className="w-3.5 h-3.5 mx-auto" />
            </div>
            <div className="p-3 rounded-[14px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
              <span className="text-[10px] font-bold text-[#8591A5] uppercase tracking-wider block">STAGE 3</span>
              <span className="text-[#111727] font-medium">Framing mutates toward governance criticism</span>
            </div>
          </div>
        </div>

        {/* Telegram Column */}
        <div className="p-4 rounded-[20px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="data" size="sm">Telegram • {telegramShare}%</Badge>
            <span className="font-sans text-[11px] font-semibold text-[#2F65F6]">Subsequent Relay</span>
          </div>

          <div className="space-y-2 text-[12px] font-sans">
            <div className="p-3 rounded-[14px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
              <span className="text-[10px] font-bold text-[#8591A5] uppercase tracking-wider block">STAGE 1</span>
              <span className="text-[#111727] font-medium">Discussions forwarded into local channels</span>
            </div>
            <div className="text-center text-slate-300">
              <ArrowDown className="w-3.5 h-3.5 mx-auto" />
            </div>
            <div className="p-3 rounded-[14px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
              <span className="text-[10px] font-bold text-[#8591A5] uppercase tracking-wider block">STAGE 2</span>
              <span className="text-[#111727] font-medium">Ground-level evidence & photos exchanged</span>
            </div>
            <div className="text-center text-slate-300">
              <ArrowDown className="w-3.5 h-3.5 mx-auto" />
            </div>
            <div className="p-3 rounded-[14px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
              <span className="text-[10px] font-bold text-[#8591A5] uppercase tracking-wider block">STAGE 3</span>
              <span className="text-[#111727] font-medium">Elevated narrative persistence & coordination</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[13px] text-[#64748B] font-sans leading-relaxed pt-3 border-t border-[rgba(228,233,245,0.85)]">
        {movementNote}
      </p>
    </div>
  );
};
