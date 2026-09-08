import React from 'react';
import { Pagination } from '../ui/Pagination';

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
  return (
    <Pagination
      page={page}
      totalPages={totalPages}
      totalItems={totalItems}
      pageSize={pageSize}
      itemLabel="observations"
      onPageChange={onPageChange}
    />
  );
};
