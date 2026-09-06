import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (item: T, index: number) => React.ReactNode;
}

export type SortDirection = 'asc' | 'desc' | null;

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  sortColumn?: string;
  sortDirection?: SortDirection;
  onSort?: (columnKey: string) => void;
  selectedIds?: string[];
  onSelectRow?: (id: string, item: T) => void;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'No data available',
  sortColumn,
  sortDirection = null,
  onSort,
  selectedIds = [],
  onRowClick,
  className = '',
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full border border-[rgba(228,233,245,0.85)] bg-white shadow-dashboard overflow-hidden rounded-[26px]">
        <div className="p-4 border-b border-[rgba(228,233,245,0.85)] bg-[#F8FAFD] flex gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full overflow-x-auto border border-[rgba(228,233,245,0.85)] bg-white shadow-dashboard rounded-[26px] ${className}`}>
      <table className="w-full text-left border-collapse font-sans text-body-ui">
        <thead>
          <tr className="border-b border-[rgba(228,233,245,0.85)] bg-[#F8FAFD]">
            {columns.map((col) => {
              const isSorted = sortColumn === col.key;
              return (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && onSort?.(col.key)}
                  className={`px-4 py-3.5 text-[#8591A5] font-semibold text-[12px] select-none tracking-wide ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                  } ${col.sortable ? 'cursor-pointer hover:text-[#111727]' : ''}`}
                >
                  <div
                    className={`inline-flex items-center gap-1.5 ${
                      col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'
                    }`}
                  >
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="text-[#8591A5]">
                        {isSorted && sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#2F65F6]" />
                        ) : isSorted && sortDirection === 'desc' ? (
                          <ArrowDown className="w-3.5 h-3.5 text-[#2F65F6]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgba(228,233,245,0.85)]">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-[#8591A5]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, index) => {
              const id = keyExtractor(item, index);
              const isSelected = selectedIds.includes(id);

              return (
                <tr
                  key={id}
                  onClick={() => onRowClick?.(item)}
                  className={`transition-colors duration-150 ${
                    onRowClick ? 'cursor-pointer' : ''
                  } ${
                    isSelected
                      ? 'bg-blue-50/60 border-l-4 border-l-[#2F65F6]'
                      : 'hover:bg-[#F8FAFD]'
                  }`}
                >
                  {columns.map((col) => {
                    const value = (item as Record<string, unknown>)[col.key];
                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-3.5 text-[13px] text-[#111727] ${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        }`}
                      >
                        {col.render ? col.render(item, index) : String(value ?? '')}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
