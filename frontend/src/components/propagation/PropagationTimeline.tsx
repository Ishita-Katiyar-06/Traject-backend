import React from 'react';
import { PropagationEvent } from '../../data/mock/propagation';
import { PropagationEventRow } from './PropagationEventRow';
import { EmptyState } from '../feedback/EmptyState';
import { ErrorState } from '../feedback/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { GitCommit } from 'lucide-react';

export interface PropagationTimelineProps {
  events: PropagationEvent[];
  onSelectEvent: (event: PropagationEvent) => void;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export const PropagationTimeline: React.FC<PropagationTimelineProps> = ({
  events,
  onSelectEvent,
  isLoading = false,
  isError = false,
  onRetry,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-2.5" role="status" aria-label="Loading propagation events">
        {[1, 2, 3, 4].map((idx) => (
          <div key={idx} className="p-4 rounded-sm border border-border bg-surface space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Propagation events could not be loaded"
        message="A failure occurred connecting to the transmission timeline service."
        onRetry={onRetry}
      />
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        title="No propagation events match criteria"
        description="Try adjusting your platform, strength, topic, or search filters."
        icon={<GitCommit className="w-5 h-5 text-text-muted" />}
      />
    );
  }

  return (
    <div className="space-y-3" role="feed" aria-label="Propagation Timeline Events">
      {events.map((event) => (
        <PropagationEventRow key={event.id} event={event} onSelect={onSelectEvent} />
      ))}
    </div>
  );
};
