import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EvidenceItem } from '../../data/mock/evidence';
import { EvidenceStatus } from './EvidenceStatus';
import { Badge } from '../ui/Badge';
import {
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Send,
  CheckCircle2,
  Eye,
  Share2,
  Repeat,
  Heart,
  MessageCircle,
  ArrowUpRight,
} from 'lucide-react';

export interface EvidenceRowProps {
  evidence: EvidenceItem;
}

export const EvidenceRow: React.FC<EvidenceRowProps> = ({ evidence }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  const isTelegram = evidence.platform === 'Telegram';

  return (
    <div className="rounded-[20px] border border-[rgba(228,233,245,0.85)] bg-white overflow-hidden transition-all shadow-xs">
      {/* Summary Header Bar */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between text-left hover:bg-[#F8FAFD] transition-colors gap-2 cursor-pointer select-none"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-mono text-[11px] font-bold text-[#8591A5] bg-[#EEF1F8] px-2.5 py-0.5 rounded-full">
            {evidence.timestamp}
          </span>
          <span className="text-slate-300 text-[11px]">•</span>
          <Badge variant={isTelegram ? 'data' : 'neutral'} size="sm">
            {evidence.platform}
          </Badge>
          <span className="text-slate-300 text-[11px]">•</span>
          <span className="text-[12px] font-medium text-[#64748B]">{evidence.language}</span>
          <span className="text-slate-300 text-[11px]">•</span>
          <EvidenceStatus status={evidence.status} />
        </div>

        <div className="flex items-center gap-1.5 text-[12px] text-[#2F65F6] font-sans font-semibold self-end sm:self-auto">
          <span>{isExpanded ? 'Collapse capture' : 'Inspect raw capture'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Observation Snippet */}
      <div className="px-4 pb-3.5">
        <p className="text-[13px] text-[#475569] font-sans leading-relaxed">
          {evidence.observation}
        </p>
      </div>

      {/* Expanded Details Body: Authentic Social Media Card */}
      {isExpanded && (
        <div className="p-4 sm:p-5 bg-[#F8FAFD] border-t border-[rgba(228,233,245,0.85)] space-y-4 font-sans">
          {isTelegram ? (
            /* 1. Realistic Telegram Message Post Card */
            <div className="rounded-[18px] border border-[#2F65F6]/20 bg-[#F4F7FE] p-4 sm:p-5 space-y-3 shadow-2xs">
              {/* Telegram Channel Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#2F65F6] flex items-center justify-center text-white shadow-xs">
                    <Send className="w-4 h-4 ml-0.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-bold text-[#111727]">
                        Northern Power Dispatch Watch
                      </span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#2F65F6]" />
                    </div>
                    <span className="text-[11px] font-mono text-[#8591A5]">
                      {evidence.source} • {evidence.timestamp}
                    </span>
                  </div>
                </div>

                <Badge variant="data" size="sm">
                  Telegram Channel
                </Badge>
              </div>

              {/* Forwarded Header (If applicable) */}
              <div className="text-[11px] text-[#2F65F6] font-medium flex items-center gap-1 pl-1">
                <Share2 className="w-3 h-3" />
                <span>Forwarded message from Regional Substation Technical Desk</span>
              </div>

              {/* Telegram Speech Bubble */}
              <div className="p-4 rounded-[16px] bg-white border border-[#2F65F6]/15 shadow-xs space-y-2.5">
                <p className="text-[13px] text-[#111727] leading-relaxed whitespace-pre-wrap font-sans">
                  {evidence.rawExcerpt}
                </p>

                {/* Bottom Stats Inside Bubble */}
                <div className="flex items-center justify-between text-[11px] text-[#8591A5] font-mono pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" /> 4,820 views
                    </span>
                    <span className="flex items-center gap-1">
                      <Share2 className="w-3 h-3" /> 384 forwards
                    </span>
                  </div>
                  <span>{evidence.timestamp}</span>
                </div>
              </div>
            </div>
          ) : (
            /* 2. Realistic X / Twitter Post Card */
            <div className="rounded-[18px] border border-slate-200 bg-white p-4 sm:p-5 space-y-3 shadow-2xs">
              {/* X Post Author Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#111727] flex items-center justify-center text-white font-bold text-[12px] shadow-xs">
                    TR
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-bold text-[#111727]">
                        Transit Rider NW
                      </span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#2F65F6]" />
                    </div>
                    <span className="text-[11px] font-mono text-[#8591A5]">
                      {evidence.source} • {evidence.timestamp}
                    </span>
                  </div>
                </div>

                <Badge variant="neutral" size="sm">
                  X Microblog
                </Badge>
              </div>

              {/* X Post Body */}
              <div className="pl-1">
                <p className="text-[13.5px] text-[#111727] leading-relaxed whitespace-pre-wrap font-sans">
                  {evidence.rawExcerpt}
                </p>
              </div>

              {/* X Engagement Metrics Bar */}
              <div className="flex items-center gap-6 pt-3 border-t border-slate-100 text-[12px] text-[#8591A5] font-mono">
                <span className="flex items-center gap-1.5 hover:text-[#2F65F6] transition-colors cursor-pointer">
                  <MessageCircle className="w-3.5 h-3.5" /> 142
                </span>
                <span className="flex items-center gap-1.5 hover:text-emerald-600 transition-colors cursor-pointer">
                  <Repeat className="w-3.5 h-3.5" /> 820
                </span>
                <span className="flex items-center gap-1.5 hover:text-rose-500 transition-colors cursor-pointer">
                  <Heart className="w-3.5 h-3.5" /> 1.4K
                </span>
                <span className="flex items-center gap-1.5 ml-auto">
                  <Eye className="w-3.5 h-3.5" /> 18.2K
                </span>
              </div>
            </div>
          )}

          {/* Cryptographic Provenance & Forensic Attribution Footer */}
          <div className="p-3.5 rounded-[16px] bg-white border border-[rgba(228,233,245,0.85)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] font-mono shadow-2xs">
            <div className="flex items-center gap-2 text-[#475569]">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                SHA-256 Provenance Verified • Ingested via Telethon MTProto Normalizer (Canonical ID: <code className="text-[#2F65F6] font-bold">{evidence.id}</code>)
              </span>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/communities/${evidence.communityId}`)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F1F4F9] hover:bg-[#2F65F6] text-[#475569] hover:text-white font-semibold transition-all cursor-pointer self-start sm:self-auto shrink-0"
            >
              <span>Cluster: {evidence.communityId.toUpperCase()}</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
