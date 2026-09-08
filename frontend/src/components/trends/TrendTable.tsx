import React from 'react';
import { TrendSummaryResponse, TopicSummaryResponse } from '../../types/api';
import { TrendRow } from './TrendRow';
import { EmptyState } from '../feedback/EmptyState';
import { ErrorState } from '../feedback/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { Hash } from 'lucide-react';
import { motion } from 'motion/react';
import { staggerContainer } from '../../utils/motion';

export interface TrendTableProps {
  trends: (TrendSummaryResponse | TopicSummaryResponse)[];
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
      <div className="space-y-3" role="status" aria-label="Loading trends">
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

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-3"
      role="feed"
      aria-label="Discovered Trends"
    >
      {trends.map((trend) => {
        const id = 'trend_id' in trend ? trend.trend_id : trend.topic_id;
        return <TrendRow key={id} trend={trend} />;
      })}
    </motion.div>
  );
};
