import React from 'react';
import { Alert } from '../../data/mock/alerts';
import { AlertRow } from './AlertRow';
import { EmptyState } from '../feedback/EmptyState';
import { ErrorState } from '../feedback/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { Bell } from 'lucide-react';

export interface AlertTableProps {
  alerts: Alert[];
  onAcknowledge: (id: string, e: React.MouseEvent) => void;
  onReview: (id: string, e: React.MouseEvent) => void;
  onResolve: (id: string, e: React.MouseEvent) => void;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onResetFilters?: () => void;
}

export const AlertTable: React.FC<AlertTableProps> = ({
  alerts,
  onAcknowledge,
  onReview,
  onResolve,
  isLoading = false,
  isError = false,
  onRetry,
  onResetFilters,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-2.5" role="status" aria-label="Loading alerts">
        {[1, 2, 3, 4].map((idx) => (
          <div
            key={idx}
            className="p-4 rounded-sm border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-4 w-2/3" />
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
        title="Alerts could not be loaded"
        message="A failure occurred connecting to the operational alert stream."
        onRetry={onRetry}
      />
    );
  }

  if (alerts.length === 0) {
    return (
      <EmptyState
        title="No alerts match the current filters"
        description="Try adjusting your status, priority, or platform filter criteria."
        icon={<Bell className="w-5 h-5 text-text-muted" />}
        actionLabel="Clear filters"
        onAction={onResetFilters}
      />
    );
  }

  return (
    <div className="space-y-2" role="feed" aria-label="Operational Alerts">
      {alerts.map((alert) => (
        <AlertRow
          key={alert.id}
          alert={alert}
          onAcknowledge={onAcknowledge}
          onReview={onReview}
          onResolve={onResolve}
        />
      ))}
    </div>
  );
};
