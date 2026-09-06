import React from 'react';
import { NarrativeSummaryResponse } from '../../types/api';
import { NarrativeRow } from './NarrativeRow';
import { EmptyState } from '../feedback/EmptyState';
import { ErrorState } from '../feedback/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { BookOpen } from 'lucide-react';

export interface NarrativeTableProps {
  narratives: NarrativeSummaryResponse[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onResetFilters?: () => void;
}

export const NarrativeTable: React.FC<NarrativeTableProps> = ({
  narratives,
  isLoading = false,
  isError = false,
  onRetry,
  onResetFilters,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading narratives">
        {[1, 2, 3, 4, 5].map((idx) => (
          <div
            key={idx}
            className="p-5 rounded-[22px] border border-border bg-surface flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-44" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Narrative telemetry could not be loaded"
        message="A network or server error occurred while querying /api/v1/narratives."
        onRetry={onRetry}
      />
    );
  }

  if (narratives.length === 0) {
    return (
      <EmptyState
        title="No narrative candidates match the current criteria"
        description="Try adjusting your priority tier, coordination filter, or search query."
        icon={<BookOpen className="w-6 h-6 text-text-muted" />}
        actionLabel="Clear filters"
        onAction={onResetFilters}
      />
    );
  }

  return (
    <div className="space-y-3" role="feed" aria-label="Monitored Narrative Candidates">
      {narratives.map((narrative) => (
        <NarrativeRow key={narrative.narrative_id} narrative={narrative} />
      ))}
    </div>
  );
};
