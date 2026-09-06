import React from 'react';
import { Button } from '../ui/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface ExplorerPaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
}

export const ExplorerPagination: React.FC<ExplorerPaginationProps> = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}) => {
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 rounded-[22px] border border-[rgba(228,233,245,0.85)] bg-white shadow-xs font-sans text-[13px] text-[#8591A5] select-none">
      <div>
        Showing <strong className="text-[#111727] font-semibold">{startItem}</strong>–
        <strong className="text-[#111727] font-semibold">{endItem}</strong> of{' '}
        <strong className="text-[#111727] font-semibold">{totalItems}</strong> observations
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

        <span className="px-3 py-1 text-[#111727] font-bold text-[12px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] rounded-full">
          Page {page} of {totalPages}
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
