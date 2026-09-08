import React from 'react';
import { TrendSummaryResponse, TopicSummaryResponse } from '../../types/api';
import { TrendNarrativeTree } from './TrendNarrativeTree';
import { TrendWithNarratives, getCleanTrendId } from '../../services/trendService';
import { EmptyState } from '../feedback/EmptyState';
import { ErrorState } from '../feedback/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { Hash } from 'lucide-react';

export interface TrendTableProps {
  trends: (TrendWithNarratives | TrendSummaryResponse | TopicSummaryResponse)[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onResetFilters?: () => void;
}

export const TrendTable: React.FC<TrendTableProps> = ({
  trends,
  isLoading = false,
  isError = false,
  onRetry,
  onResetFilters,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading trends">
        {[1, 2, 3, 4, 5].map((idx) => (
          <div
            key={idx}
            className="p-5 rounded-[22px] border border-border bg-surface flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-2.5 flex-1">
              <Skeleton className="h-4 w-40" />
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
        title="Trend discovery telemetry could not be loaded"
        message="A network or server error occurred while querying /api/v1/trends."
        onRetry={onRetry}
      />
    );
  }

  if (trends.length === 0) {
    return (
      <EmptyState
        title="No trend clusters discovered"
        description="Try adjusting your keyword filter or running trend discovery in the ingestion pipeline."
        icon={<Hash className="w-6 h-6 text-text-muted" />}
        actionLabel="Clear filters"
        onAction={onResetFilters}
      />
    );
  }

  // Ensure all trends conform to TrendWithNarratives structure
  const normalizedTrends: TrendWithNarratives[] = trends.map((t) => {
    const trendId = 'trend_id' in t ? t.trend_id : t.topic_id;
    const cleanId =
      'cleanId' in t && (t as any).cleanId
        ? (t as any).cleanId
        : getCleanTrendId(trendId);
    const narratives =
      'narratives' in t && Array.isArray((t as any).narratives)
        ? (t as any).narratives
        : [];

    return {
      ...(t as TrendSummaryResponse),
      trend_id: trendId,
      topic_id: t.topic_id,
      cleanId,
      narratives,
    };
  });

  return <TrendNarrativeTree trends={normalizedTrends} />;
};
