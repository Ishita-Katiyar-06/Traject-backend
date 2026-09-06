import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading stream data...',
  className = '',
}) => {
  return (
    <div className={`space-y-4 py-8 px-2 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 border-2 border-signal border-t-transparent rounded-full animate-spin shrink-0" />
        <span className="text-secondary-ui text-body-ui font-sans">{message}</span>
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-3/4" />
      </div>
    </div>
  );
};
