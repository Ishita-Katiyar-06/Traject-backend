import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Share2 } from 'lucide-react';
import { Button } from '../ui/Button';

export interface ContextualPropagationSummaryProps {
  topicId?: string;
  className?: string;
}

export const ContextualPropagationSummary: React.FC<ContextualPropagationSummaryProps> = ({
  topicId: _topicId,
  className = '',
}) => {
  const navigate = useNavigate();

  const stages = [
    { label: 'Initial Activity', node: 'X (Twitter)', time: '18:12 UTC' },
    { label: 'Community Forward', node: 'Resident Networks', time: '18:26 UTC' },
    { label: 'Narrative Mutation', node: 'Infrastructure Failure', time: '18:44 UTC' },
    { label: 'Secondary Platform Relay', node: 'Telegram Channels', time: '19:02 UTC' },
  ];

  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-6 shadow-xs space-y-4 font-sans select-none ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-[#2F65F6]" />
          <h3 className="text-[17px] font-bold font-sans text-[#111727]">
            Propagation Pathway Summary
          </h3>
        </div>

        <Button
          variant="secondary"
          size="sm"
          rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
          onClick={() => navigate('/propagation')}
        >
          View Full Propagation Analysis
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
        {stages.map((st, i) => (
          <div key={i} className="p-3.5 rounded-[16px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] space-y-1 relative group hover:bg-white hover:border-[#2F65F6]/40 hover:shadow-xs transition-all">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#8591A5]">
              <span>{st.label.toUpperCase()}</span>
              <span>{st.time}</span>
            </div>
            <div className="text-[14px] font-bold text-[#111727] truncate">
              {st.node}
            </div>

            {i < stages.length - 1 && (
              <div className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white border border-[rgba(228,233,245,0.9)] items-center justify-center text-[#8591A5] shadow-xs">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
