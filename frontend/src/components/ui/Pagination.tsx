import React from 'react';
import { Button } from './Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  itemLabel?: string;
  onPageChange: (newPage: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  itemLabel = 'records',
  onPageChange,
  className = '',
}) => {
  const hasItemCounts = typeof totalItems === 'number' && typeof pageSize === 'number';
  const startItem = hasItemCounts ? (totalItems === 0 ? 0 : (page - 1) * (pageSize || 10) + 1) : null;
  const endItem = hasItemCounts ? Math.min(page * (pageSize || 10), totalItems || 0) : null;

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 rounded-[22px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-xs font-sans text-[13px] text-[#8591A5] dark:text-[#94A3B8] select-none ${className}`}
    >
      <div>
        {hasItemCounts ? (
          <span>
            Showing <strong className="text-[#111727] dark:text-[#F8FAFC] font-mono font-semibold">{startItem}</strong>–
            <strong className="text-[#111727] dark:text-[#F8FAFC] font-mono font-semibold">{endItem}</strong> of{' '}
            <strong className="text-[#111727] dark:text-[#F8FAFC] font-mono font-semibold">{totalItems}</strong> {itemLabel}
          </span>
        ) : (
          <span>
            Page <strong className="text-[#111727] dark:text-[#F8FAFC] font-mono font-semibold">{page}</strong> of{' '}
            <strong className="text-[#111727] dark:text-[#F8FAFC] font-mono font-semibold">{totalPages}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>

        <span className="px-3 py-1 text-[#111727] dark:text-[#F8FAFC] font-mono font-semibold text-[12px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] rounded-full">
          {page} / {totalPages}
        </span>

        <Button
          variant="secondary"
          size="sm"
          rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
};
