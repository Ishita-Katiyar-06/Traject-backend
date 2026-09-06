import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ArrowUpRight } from 'lucide-react';
import { Badge } from '../ui/Badge';

export interface AssociatedNarrativeItem {
  id: string;
  title: string;
  currentFraming: string;
  status: string;
}

export interface CommunityNarrativesProps {
  narratives: AssociatedNarrativeItem[];
  className?: string;
}

export const CommunityNarratives: React.FC<CommunityNarrativesProps> = ({
  narratives,
  className = '',
}) => {
  const navigate = useNavigate();

  if (!narratives || narratives.length === 0) return null;

  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-5 sm:p-6 shadow-xs space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-[#2F65F6]" />
        <h4 className="text-[16px] font-bold text-[#111727]">
          Associated Narratives
        </h4>
      </div>

      <div className="space-y-2.5 pt-1">
        {narratives.map((nar) => (
          <button
            key={nar.id}
            type="button"
            onClick={() => navigate(`/narratives/${nar.id}`)}
            className="w-full group flex items-start justify-between p-3.5 rounded-[16px] border border-[rgba(228,233,245,0.85)] bg-[#F8FAFD] hover:bg-white hover:border-[#2F65F6]/40 hover:shadow-xs text-left transition-all duration-150 select-none"
          >
            <div className="min-w-0 pr-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[10px] text-[#8591A5] uppercase tracking-wider">
                  {nar.id.toUpperCase()}
                </span>
                <Badge variant={nar.status === 'Developing' ? 'signal' : 'data'} size="sm">
                  {nar.status}
                </Badge>
              </div>
              <div className="text-[14px] font-bold text-[#111727] group-hover:text-[#2F65F6] transition-colors leading-snug">
                {nar.title}
              </div>
              <div className="text-[12px] text-[#475569] mt-1">
                <span className="text-[#8591A5] font-mono text-[10px] uppercase mr-1">Framing:</span>
                {nar.currentFraming}
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#8591A5] group-hover:text-[#2F65F6] transition-colors shrink-0 mt-1" />
          </button>
        ))}
      </div>
    </div>
  );
};
