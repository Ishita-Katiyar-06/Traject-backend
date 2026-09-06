import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PropagationEvent } from '../../data/mock/propagation';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ArrowRight, ArrowUpRight, Clock, ShieldCheck } from 'lucide-react';

export interface PropagationDetailModalProps {
  event: PropagationEvent | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PropagationDetailModal: React.FC<PropagationDetailModalProps> = ({
  event,
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  if (!event) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Propagation Event: ${event.id.toUpperCase()}`}
      subtitle="Contextual transmission analysis and supporting post counts"
      maxWidth="lg"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4 py-1 font-sans text-body-ui">
        {/* Source to Destination Banner */}
        <div className="p-3.5 rounded-sm bg-bg border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="neutral" size="sm">From: {event.sourcePlatform}</Badge>
            <ArrowRight className="w-3.5 h-3.5 text-signal" />
            <Badge variant="data" size="sm">To: {event.destinationPlatform}</Badge>
            {typeof event.hopLatencyMinutes === 'number' && (
              <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-[#2F65F6]/10 text-[#2F65F6] font-semibold border border-[#2F65F6]/20">
                Hop Latency: ~{event.hopLatencyMinutes}m
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-text-primary">{event.timestamp}</span>
            <span className="text-border">•</span>
            <span className="text-signal uppercase font-semibold">{event.strength}</span>
          </div>
        </div>

        {/* Communities Involved */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(event.sourceCommunity.toLowerCase().includes('commuter') ? '/communities/com-301' : '/communities/com-301');
            }}
            className="p-3.5 rounded-[16px] bg-white border border-[rgba(228,233,245,0.85)] hover:border-[#2F65F6]/40 hover:bg-[#F8FAFD] transition-all text-left group cursor-pointer shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-[#8591A5] uppercase tracking-wider block font-bold">
                Origin Community
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#8591A5] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-[13px] font-bold text-[#111727] group-hover:text-[#2F65F6] mt-1 transition-colors">
              {event.sourceCommunity}
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(event.destinationCommunity.toLowerCase().includes('resident') ? '/communities/com-301' : '/communities/com-302');
            }}
            className="p-3.5 rounded-[16px] bg-white border border-[rgba(228,233,245,0.85)] hover:border-[#2F65F6]/40 hover:bg-[#F8FAFD] transition-all text-left group cursor-pointer shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-[#8591A5] uppercase tracking-wider block font-bold">
                Destination Community
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#8591A5] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-[13px] font-bold text-[#111727] group-hover:text-[#2F65F6] mt-1 transition-colors">
              {event.destinationCommunity}
            </div>
          </button>
        </div>

        {/* Associated Topic & Narrative */}
        <div className="space-y-2.5 p-4 rounded-[18px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] text-[13px] font-sans">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <span className="font-mono text-[10px] font-bold text-[#8591A5] uppercase tracking-wider mr-2">Associated Topic:</span>
              <span className="font-bold text-[#111727]">{event.topicName}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(`/topics/${event.topicId}`);
              }}
              className="text-[12px] font-semibold text-[#2F65F6] hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <span>View topic</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-2 border-t border-[rgba(228,233,245,0.8)]">
            <div>
              <span className="font-mono text-[10px] font-bold text-[#8591A5] uppercase tracking-wider mr-2">Associated Narrative:</span>
              <span className="font-semibold text-[#111727]">{event.narrativeTitle}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(`/narratives/${event.narrativeId}`);
              }}
              className="text-[12px] font-semibold text-[#2F65F6] hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <span>View narrative</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Analytical Observation */}
        <div className="space-y-1">
          <span className="text-[11px] font-mono text-text-muted uppercase tracking-wider block">
            Analyst Observation Note:
          </span>
          <p className="text-[13px] text-text-primary bg-surface p-3 rounded-sm border border-border leading-relaxed">
            "{event.observation}"
          </p>
        </div>

        {/* Supporting Evidence Counts */}
        <div className="p-3.5 rounded-sm bg-surface-elevated/40 border border-border space-y-2">
          <div className="flex items-center gap-1.5 text-confirmed text-[12px] font-mono">
            <ShieldCheck className="w-4 h-4" />
            <span className="font-semibold">Supporting Telemetry Corroboration</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 font-mono text-[12px]">
            <div className="p-2.5 rounded-sm bg-bg border border-border/60">
              <div className="text-[10px] text-text-muted uppercase">X POST VOLUME</div>
              <div className="text-[15px] font-semibold text-text-primary mt-0.5">
                {event.evidence.xPosts.toLocaleString()} mentions
              </div>
            </div>

            <div className="p-2.5 rounded-sm bg-bg border border-border/60">
              <div className="text-[10px] text-text-muted uppercase">TELEGRAM POST VOLUME</div>
              <div className="text-[15px] font-semibold text-data mt-0.5">
                {event.evidence.telegramPosts.toLocaleString()} mentions
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
