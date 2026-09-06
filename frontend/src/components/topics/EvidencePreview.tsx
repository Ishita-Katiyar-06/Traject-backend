import React, { useState } from 'react';
import { ShieldCheck, ArrowUpRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';

export interface EvidencePreviewProps {
  evidenceSummary: {
    publicPostsCount: number;
    clustersCount: number;
    monitoredPlatformsCount: number;
  };
  topicName: string;
  className?: string;
}

export const EvidencePreview: React.FC<EvidencePreviewProps> = ({
  evidenceSummary,
  topicName,
  className = '',
}) => {
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);

  return (
    <>
      <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-5 sm:p-6 shadow-xs space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#2F65F6]" />
            <h4 className="text-[16px] font-bold text-[#111727]">
              Supporting Evidence
            </h4>
          </div>
          <Button
            variant="secondary"
            size="sm"
            rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
            onClick={() => setIsEvidenceModalOpen(true)}
          >
            View Evidence
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 py-1 font-mono text-[12px]">
          <div className="p-3.5 rounded-[16px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)]">
            <div className="text-[10px] text-[#8591A5] uppercase tracking-wider font-semibold">PUBLIC POSTS</div>
            <div className="text-[18px] font-bold text-[#111727] mt-0.5">
              {evidenceSummary.publicPostsCount.toLocaleString()}
            </div>
          </div>

          <div className="p-3.5 rounded-[16px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)]">
            <div className="text-[10px] text-[#8591A5] uppercase tracking-wider font-semibold">CLUSTERS</div>
            <div className="text-[18px] font-bold text-[#2F65F6] mt-0.5">
              {evidenceSummary.clustersCount}
            </div>
          </div>

          <div className="p-3.5 rounded-[16px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)]">
            <div className="text-[10px] text-[#8591A5] uppercase tracking-wider font-semibold">PLATFORMS</div>
            <div className="text-[18px] font-bold text-[#111727] mt-0.5">
              {evidenceSummary.monitoredPlatformsCount}
            </div>
          </div>
        </div>

        <p className="text-[12px] text-[#8591A5] font-sans leading-relaxed">
          Evidence captures contain normalized message payloads, origin forward headers, and quote integrity markers.
        </p>
      </div>

      {/* Contextual Evidence Modal */}
      <Modal
        isOpen={isEvidenceModalOpen}
        onClose={() => setIsEvidenceModalOpen(false)}
        title="Evidence Captures"
        subtitle={`Normalized message records verifying: ${topicName}`}
        maxWidth="lg"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setIsEvidenceModalOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-3 py-1 font-sans">
          <div className="p-4 bg-[#F8FAFD] rounded-[18px] border border-[rgba(228,233,245,0.85)] space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#8591A5]">
              <span className="font-semibold text-[#111727]">RECORD #TG-94021</span>
              <span>18:42 UTC</span>
            </div>
            <p className="text-[13px] text-[#111727] leading-relaxed">
              "Feeder trip on 220kV transmission line causing power outage in Sector 14 through Sector 21. Maintenance teams deployed."
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="data" size="sm">Channel: @regional_power_watch</Badge>
              <span className="text-[11px] font-mono text-[#8591A5]">Lang: Hindi/English</span>
            </div>
          </div>

          <div className="p-4 bg-[#F8FAFD] rounded-[18px] border border-[rgba(228,233,245,0.85)] space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#8591A5]">
              <span className="font-semibold text-[#111727]">RECORD #X-88410</span>
              <span>18:31 UTC</span>
            </div>
            <p className="text-[13px] text-[#111727] leading-relaxed">
              "Multiple wards reporting continuous outage for past 90 minutes. Substation helplines engaged."
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="neutral" size="sm">Platform: X (Twitter)</Badge>
              <span className="text-[11px] font-mono text-[#8591A5]">Lang: Hindi</span>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};
