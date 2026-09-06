import React from 'react';
import { CommunityDetail } from '../../data/mock/communities';
import { CommunityRow } from './CommunityRow';
import { EmptyState } from '../feedback/EmptyState';
import { ErrorState } from '../feedback/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { Users } from 'lucide-react';

export interface CommunityTableProps {
  communities: CommunityDetail[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onResetFilters?: () => void;
}

export const CommunityTable: React.FC<CommunityTableProps> = ({
  communities,
  isLoading = false,
  isError = false,
  onRetry,
  onResetFilters,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-2.5" role="status" aria-label="Loading communities">
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
        title="Communities could not be loaded"
        message="A failure occurred querying community cluster metadata."
        onRetry={onRetry}
      />
    );
  }

  if (communities.length === 0) {
    return (
      <EmptyState
        title="No communities match the current filters"
        description="Try adjusting your platform, language, activity, or trend criteria."
        icon={<Users className="w-5 h-5 text-text-muted" />}
        actionLabel="Clear filters"
        onAction={onResetFilters}
      />
    );
  }

  return (
    <div className="space-y-2" role="feed" aria-label="Monitored Communities">
      {communities.map((community) => (
        <CommunityRow key={community.id} community={community} />
      ))}
    </div>
  );
};
