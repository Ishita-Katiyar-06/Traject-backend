import React from 'react';
import { HistoricalComparisonRecord } from '../../data/mock/foresight';
import { History } from 'lucide-react';

export interface HistoricalComparisonProps {
  comparison: HistoricalComparisonRecord;
  className?: string;
}

export const HistoricalComparison: React.FC<HistoricalComparisonProps> = ({
  comparison,
  className = '',
}) => {
  return (
    <div className={`rounded-sm border border-border/80 bg-bg p-4 space-y-3 font-sans ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-signal" />
          <h4 className="text-[14px] font-semibold text-text-primary">
            Similar Past Pattern Comparison
          </h4>
        </div>

        <span className="font-mono text-[11px] text-text-muted">
          Event: {comparison.previousEventName} ({comparison.previousEventDate})
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[12px] pt-1">
        <div className="p-2.5 rounded-sm bg-surface border border-border/70">
          <span className="text-text-muted text-[10px] uppercase block">ACTIVITY GROWTH</span>
          <span className="text-text-primary mt-0.5 block">{comparison.activityGrowthComparison}</span>
        </div>

        <div className="p-2.5 rounded-sm bg-surface border border-border/70">
          <span className="text-text-muted text-[10px] uppercase block">BENCHMARK DURATION</span>
          <span className="text-text-primary mt-0.5 block">{comparison.durationComparison}</span>
        </div>

        <div className="p-2.5 rounded-sm bg-surface border border-border/70">
          <span className="text-text-muted text-[10px] uppercase block">PLATFORM RATIO</span>
          <span className="text-data mt-0.5 block">{comparison.platformDistributionComparison}</span>
        </div>
      </div>

      <div className="space-y-1.5 text-[12px] font-sans pt-1">
        <div className="text-secondary-ui">
          <span className="font-mono text-text-muted text-[11px] uppercase mr-1">TRAJECTORY SIMILARITY:</span>
          {comparison.narrativeProgressionSimilarity}
        </div>
        <div className="text-text-primary font-medium p-2.5 rounded-sm bg-surface border border-border/80">
          <span className="text-signal font-mono text-[11px] uppercase mr-1">KEY TAKEAWAY:</span>
          {comparison.keyTakeaway}
        </div>
      </div>
    </div>
  );
};
