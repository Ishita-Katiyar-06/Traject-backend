import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Clock } from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { SignalStatus } from '../../components/signals/SignalStatus';
import { SignalStrength } from '../../components/signals/SignalStrength';
import { signalService } from '../../services/signalService';
import { Signal } from '../../data/mock/signals';

export const SignalDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [signal, setSignal] = useState<Signal | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      signalService.getSignalById(id).then((res) => {
        setSignal(res || null);
        setIsLoading(false);
      });
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="py-12 text-center text-text-muted font-mono text-small">
        Loading signal telemetry...
      </div>
    );
  }

  if (!signal) {
    return (
      <div className="space-y-6 font-sans">
        <PageHeader
          title="Signal Not Found"
          description="The requested signal record does not exist or has decayed."
          actions={
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => navigate('/signals')}
            >
              Return to Signals
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <PageHeader
        title={`Signal: ${signal.id.toUpperCase()}`}
        description="Detailed telemetry record and operational context for this detected change."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => navigate('/signals')}
            >
              Back to Signals
            </Button>
            <Button
              variant="primary"
              size="sm"
              rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
              onClick={() => navigate(`/investigation/${signal.id}`)}
            >
              Investigate
            </Button>
          </div>
        }
      />

      {/* Signal Primary Card */}
      <div className="p-6 sm:p-7 rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white shadow-xs space-y-5 font-sans">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(228,233,245,0.85)] pb-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-bold text-[#111727] bg-[#EEF1F8] px-2.5 py-0.5 rounded-full">{signal.id.toUpperCase()}</span>
            <span className="text-slate-300">•</span>
            <span className="text-[13px] font-semibold text-[#475569]">{signal.type}</span>
          </div>

          <div className="flex items-center gap-3">
            <SignalStrength strength={signal.strength} />
            <SignalStatus status={signal.status} />
          </div>
        </div>

        <div>
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111727] leading-snug">
            {signal.title}
          </h2>
          <p className="text-[#475569] text-[14px] mt-2 leading-relaxed">
            {signal.description}
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-2 border-t border-[rgba(228,233,245,0.85)] font-sans">
          <div className="p-4 bg-[#F8FAFD] rounded-[18px] border border-[rgba(228,233,245,0.85)]">
            <div className="text-[10px] font-bold text-[#8591A5] uppercase tracking-wider">
              Change Rate
            </div>
            <div className="font-sans text-[22px] font-bold text-[#FF6D5A] mt-1 tracking-tight">
              {signal.changePercent > 0 ? `+${signal.changePercent}%` : `${signal.changePercent}%`}
            </div>
          </div>

          <div className="p-4 bg-[#F8FAFD] rounded-[18px] border border-[rgba(228,233,245,0.85)]">
            <div className="text-[10px] font-bold text-[#8591A5] uppercase tracking-wider">
              Activity Volume
            </div>
            <div className="font-sans text-[22px] font-bold text-[#2F65F6] mt-1 tracking-tight">
              {signal.activityVolume.toLocaleString()}
              <span className="text-[12px] font-normal text-[#8591A5] ml-1">msgs</span>
            </div>
          </div>

          <div className="p-4 bg-[#F8FAFD] rounded-[18px] border border-[rgba(228,233,245,0.85)]">
            <div className="text-[10px] font-bold text-[#8591A5] uppercase tracking-wider">
              Detected At
            </div>
            <div className="font-mono text-[13px] font-semibold text-[#111727] mt-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#2F65F6]" />
              <span>{signal.detectedAt}</span>
            </div>
          </div>

          <div className="p-4 bg-[#F8FAFD] rounded-[18px] border border-[rgba(228,233,245,0.85)]">
            <div className="text-[10px] font-bold text-[#8591A5] uppercase tracking-wider">
              Sources & Languages
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {signal.sources.map((s) => (
                <Badge key={s} variant={s === 'Telegram' ? 'data' : 'neutral'} size="sm">
                  {s}
                </Badge>
              ))}
              {signal.languages.map((l) => (
                <span key={l} className="text-[11px] font-mono text-[#8591A5]">
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Affected Topics */}
        {signal.affectedTopics.length > 0 && (
          <div className="pt-2">
            <span className="text-[11px] font-bold text-[#8591A5] uppercase tracking-wider block mb-2">
              Associated Topics:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {signal.affectedTopics.map((top) => {
                const topicRoute = top.toLowerCase().includes('power') || top.toLowerCase().includes('transformer')
                  ? '/topics/top-101'
                  : top.toLowerCase().includes('fuel')
                  ? '/topics/top-104'
                  : top.toLowerCase().includes('metro')
                  ? '/topics/top-102'
                  : top.toLowerCase().includes('rain') || top.toLowerCase().includes('flood')
                  ? '/topics/top-105'
                  : '/topics/top-101';

                return (
                  <button
                    key={top}
                    type="button"
                    onClick={() => navigate(topicRoute)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F1F4F9] hover:bg-[#2F65F6]/10 hover:border-[#2F65F6]/40 hover:text-[#2F65F6] border border-[rgba(228,233,245,0.85)] text-[12px] text-[#475569] font-medium transition-all cursor-pointer shadow-2xs group"
                  >
                    <span>#{top}</span>
                    <ArrowUpRight className="w-3 h-3 text-[#8591A5] group-hover:text-[#2F65F6] transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Boundary Note */}
      <div className="p-5 rounded-[22px] border border-[rgba(228,233,245,0.85)] bg-white shadow-xs text-[13px] text-[#475569] space-y-1 font-sans">
        <span className="font-bold text-[#111727] block">
          Investigation Boundary Notice
        </span>
        <p>
          Full evidence inspection, quote forensics, cross-platform timeline correlation, and entity graph analysis will be introduced in subsequent phases.
        </p>
      </div>
    </div>
  );
};
