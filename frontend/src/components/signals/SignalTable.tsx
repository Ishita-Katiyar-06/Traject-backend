import React from 'react';
import { Signal } from '../../data/mock/signals';
import { SignalRow } from './SignalRow';
import { EmptyState } from '../feedback/EmptyState';
import { ErrorState } from '../feedback/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { Radio } from 'lucide-react';

export interface SignalTableProps {
  signals: Signal[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onResetFilters?: () => void;
  showDetails?: boolean;
}

export const SignalTable: React.FC<SignalTableProps> = ({
  signals,
  isLoading = false,
  isError = false,
  onRetry,
  onResetFilters,
  showDetails = true,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-2.5" role="status" aria-label="Loading signals telemetry">
        {[1, 2, 3, 4, 5].map((idx) => (
          <div
            key={idx}
            className="p-4 rounded-sm border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Signals could not be loaded"
        message="A telemetry retrieval issue occurred while connecting to the signal detection stream."
        onRetry={onRetry}
      />
    );
  }

  if (signals.length === 0) {
    return (
      <EmptyState
        title="No signals match the current filters"
        description="Try adjusting your status, priority, source, or language filter criteria."
        icon={<Radio className="w-5 h-5 text-text-muted" />}
        actionLabel="Clear filters"
        onAction={onResetFilters}
      />
    );
  }

  return (
    <div className="space-y-2" role="feed" aria-label="Detected Signals">
      {signals.map((signal) => (
        <SignalRow key={signal.id} signal={signal} showDetails={showDetails} />
      ))}
    </div>
  );
};
