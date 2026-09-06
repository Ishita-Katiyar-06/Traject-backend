import React from 'react';
import { CommunityMovementRecord } from '../../data/mock/propagation';
import { Users, ArrowRight } from 'lucide-react';

export interface CommunityMovementCardProps {
  movements: CommunityMovementRecord[];
  className?: string;
}

export const CommunityMovementCard: React.FC<CommunityMovementCardProps> = ({
  movements,
  className = '',
}) => {
  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-5 sm:p-6 shadow-xs space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#2F65F6]" />
          <h4 className="text-[16px] font-bold text-[#111727]">
            Cross-Community Diffusion Relays
          </h4>
        </div>
        <span className="font-mono text-[11px] text-[#8591A5]">
          Cluster Hops
        </span>
      </div>

      <div className="divide-y divide-[rgba(228,233,245,0.8)]">
        {movements.map((mov) => (
          <div key={mov.id} className="py-3 space-y-1.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[13px] font-sans">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[#475569] font-medium">{mov.sourceCommunity}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#2F65F6] shrink-0" />
                <span className="text-[#111727] font-bold">{mov.destinationCommunity}</span>
              </div>
              <span className="font-mono text-[11px] text-[#8591A5] mt-1 sm:mt-0">
                {mov.observedTime} (~{mov.latencyMinutes}m latency)
              </span>
            </div>

            <div className="text-[11px] font-mono text-[#8591A5]">
              Topic: <span className="text-[#111727] font-medium">{mov.sharedTopic}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
