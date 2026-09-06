import React from 'react';
import { TopicSummaryResponse } from '../../types/api';
import { TopicRow } from './TopicRow';
import { EmptyState } from '../feedback/EmptyState';
import { ErrorState } from '../feedback/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { Hash } from 'lucide-react';

export interface TopicTableProps {
  topics: TopicSummaryResponse[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onResetFilters?: () => void;
}

export const TopicTable: React.FC<TopicTableProps> = ({
  topics,
  isLoading = false,
  isError = false,
  onRetry,
  onResetFilters,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading topics">
        {[1, 2, 3, 4, 5].map((idx) => (
          <div
            key={idx}
            className="p-5 rounded-[22px] border border-border bg-surface flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Topic discovery telemetry could not be loaded"
        message="A network or server error occurred while querying /api/v1/topics."
        onRetry={onRetry}
      />
    );
  }

  if (topics.length === 0) {
    return (
      <EmptyState
        title="No topic clusters discovered"
        description="Try adjusting your keyword filter or running topic discovery in the 4F pipeline."
        icon={<Hash className="w-6 h-6 text-text-muted" />}
        actionLabel="Clear filters"
        onAction={onResetFilters}
      />
    );
  }

  return (
    <div className="space-y-3" role="feed" aria-label="Discovered Topics">
      {topics.map((topic) => (
        <TopicRow key={topic.topic_id} topic={topic} />
      ))}
    </div>
  );
};
