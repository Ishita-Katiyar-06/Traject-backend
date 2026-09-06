import React, { useState } from 'react';
import { ForesightDetail } from '../../data/mock/foresight';
import { ScenarioCard } from './ScenarioCard';
import { ScenarioComparison } from './ScenarioComparison';
import { ForesightTimeline } from './ForesightTimeline';
import { HistoricalComparison } from './HistoricalComparison';
import { Compass } from 'lucide-react';

export interface ForesightSectionProps {
  foresight: ForesightDetail;
  className?: string;
}

export const ForesightSection: React.FC<ForesightSectionProps> = ({ foresight, className = '' }) => {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-6 shadow-xs space-y-6 font-sans select-none ${className}`}>
      {/* Foresight Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(228,233,245,0.85)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#9B72F4]" />
            <h3 className="text-[17px] font-bold font-sans text-[#111727]">
              Foresight & Trajectory Projections
            </h3>
          </div>
          <p className="text-[#8591A5] text-[13px] font-sans mt-0.5">
            Conditional near-term scenario analysis based on current telemetry velocity and historical baselines
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-[#F1F4F9] p-1 rounded-full border border-[rgba(228,233,245,0.85)] self-start sm:self-auto text-[12px] font-sans">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer select-none ${
              viewMode === 'cards'
                ? 'bg-[#2F65F6] text-white shadow-xs'
                : 'text-[#8591A5] hover:text-[#111727]'
            }`}
          >
            Scenario Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer select-none ${
              viewMode === 'table'
                ? 'bg-[#2F65F6] text-white shadow-xs'
                : 'text-[#8591A5] hover:text-[#111727]'
            }`}
          >
            Comparison Matrix
          </button>
        </div>
      </div>

      {/* Scenarios Display */}
      <div className="space-y-3">
        {viewMode === 'cards' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {foresight.scenarios.map((scen) => (
              <ScenarioCard key={scen.id} scenario={scen} />
            ))}
          </div>
        ) : (
          <ScenarioComparison scenarios={foresight.scenarios} />
        )}
      </div>

      {/* Near-Term Progression Timeline */}
      <ForesightTimeline steps={foresight.timeline} />

      {/* Historical Benchmarking */}
      <HistoricalComparison comparison={foresight.historicalComparison} />

      <p className="text-[11px] text-text-muted font-sans leading-relaxed pt-1 border-t border-border/40">
        Foresight projections represent conditional developmental branches rather than deterministic predictions. Indicators should be actively monitored for confirmation.
      </p>
    </div>
  );
};
