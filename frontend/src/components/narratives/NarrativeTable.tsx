import React from 'react';
import { NarrativeSummaryResponse } from '../../types/api';
import { NarrativeRow } from './NarrativeRow';
import { EmptyState } from '../feedback/EmptyState';
import { ErrorState } from '../feedback/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { BookOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { staggerContainer } from '../../utils/motion';

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
            className="p-5 sm:p-6 rounded-[24px] sm:rounded-[26px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="space-y-2.5 flex-1">
              <Skeleton className="h-4 w-44 rounded-full" />
              <Skeleton className="h-6 w-2/3 rounded-full" />
              <Skeleton className="h-4 w-1/2 rounded-full" />
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <Skeleton className="h-10 w-24 rounded-full" />
              <Skeleton className="h-10 w-44 rounded-[16px]" />
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
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-3"
      role="feed"
      aria-label="Monitored Narrative Candidates"
    >
      {narratives.map((narrative) => (
        <NarrativeRow key={narrative.narrative_id} narrative={narrative} />
      ))}
    </motion.div>
  );
};
