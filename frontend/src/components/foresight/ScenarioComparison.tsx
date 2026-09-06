import React from 'react';
import { ForesightScenario } from '../../data/mock/foresight';
import { Badge } from '../ui/Badge';

export interface ScenarioComparisonProps {
  scenarios: ForesightScenario[];
}

export const ScenarioComparison: React.FC<ScenarioComparisonProps> = ({ scenarios }) => {
  return (
    <div className="overflow-x-auto rounded-sm border border-border/70 font-sans text-small">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-bg border-b border-border/80 text-[11px] font-mono text-text-muted">
            <th className="py-2.5 px-3 uppercase">Scenario</th>
            <th className="py-2.5 px-3 uppercase">Likelihood</th>
            <th className="py-2.5 px-3 uppercase">Key Observable Trigger</th>
            <th className="py-2.5 px-3 uppercase">Supporting Telemetry</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40 text-[12px]">
          {scenarios.map((scen) => (
            <tr key={scen.id} className="hover:bg-surface-elevated/30 transition-colors">
              <td className="py-2.5 px-3 font-medium text-text-primary">
                {scen.title}
              </td>
              <td className="py-2.5 px-3">
                <Badge
                  variant={scen.assessment === 'Likely' ? 'signal' : 'data'}
                  size="sm"
                >
                  {scen.assessment}
                </Badge>
              </td>
              <td className="py-2.5 px-3 text-secondary-ui">
                {scen.potentialTrigger}
              </td>
              <td className="py-2.5 px-3 text-text-muted font-mono text-[11px]">
                {scen.supportingEvidence}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
