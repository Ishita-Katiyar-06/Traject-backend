import React from 'react';
import { ForesightScenario } from '../../data/mock/foresight';
import { Compass, CheckCircle2 } from 'lucide-react';
import { Badge } from '../ui/Badge';

export interface ScenarioCardProps {
  scenario: ForesightScenario;
}

export const ScenarioCard: React.FC<ScenarioCardProps> = ({ scenario }) => {
  return (
    <div className="p-4 rounded-[18px] border border-[rgba(228,233,245,0.85)] bg-[#F8FAFD] space-y-3 font-sans hover:border-[#2F65F6]/30 transition-all shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#2F65F6] shrink-0" />
          <h4 className="text-[14px] font-bold text-[#111727]">
            {scenario.title}
          </h4>
        </div>

        <Badge
          variant={
            scenario.assessment === 'Likely'
              ? 'signal'
              : scenario.assessment === 'Possible'
              ? 'data'
              : 'neutral'
          }
          size="sm"
        >
          {scenario.assessment}
        </Badge>
      </div>

      <p className="text-[13px] text-[#475569] leading-relaxed">
        {scenario.description}
      </p>

      {/* Observable Indicators List */}
      <div className="space-y-1.5 pt-1">
        <span className="text-[10px] font-mono text-[#8591A5] uppercase tracking-wider block">
          Observable Condition Indicators:
        </span>
        <ul className="space-y-1 text-[12px] text-[#475569]">
          {scenario.indicators.map((ind, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2F65F6] shrink-0 mt-0.5" />
              <span>{ind}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Potential Trigger */}
      <div className="pt-2 border-t border-[rgba(228,233,245,0.8)] text-[11px] font-mono text-[#8591A5]">
        <span className="font-semibold text-[#8591A5]">TRIGGER: </span>
        <span className="text-[#111727] font-medium">{scenario.potentialTrigger}</span>
      </div>
    </div>
  );
};
