import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  isNumeric?: boolean;
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
      <div className={`w-full border border-slate-200/80 dark:border-[#2B323D] bg-white/90 dark:bg-[#181C22]/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden rounded-[22px] ${className}`}>
        <div className="p-4 border-b border-slate-100 dark:border-[#252B32] bg-slate-50/70 dark:bg-[#13171C] flex gap-4">
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-4 w-40 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
        <div className="p-6 space-y-3.5">
          <Skeleton className="h-8 w-full rounded-full" />
          <Skeleton className="h-8 w-full rounded-full" />
          <Skeleton className="h-8 w-full rounded-full" />
          <Skeleton className="h-8 w-full rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full overflow-x-auto border border-slate-200/80 dark:border-[#2B323D] bg-white/90 dark:bg-[#181C22]/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-[22px] ${className}`}>
      <table className="w-full text-left border-collapse font-sans text-body-ui">
        <thead>
          <tr className="border-b border-slate-100 dark:border-[#2B323D] bg-slate-50/70 dark:bg-[#13171C]">
            {columns.map((col) => {
              const isSorted = sortColumn === col.key;
              return (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && onSort?.(col.key)}
                  className={`px-5 py-3.5 text-[12px] font-medium select-none tracking-normal ${
                    isSorted
                      ? 'text-slate-900 dark:text-white font-semibold'
                      : 'text-slate-500 dark:text-slate-400'
                  } ${
                    col.align === 'right' || col.isNumeric
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                  } ${col.sortable ? 'cursor-pointer hover:text-[#111727] dark:hover:text-[#F8FAFC]' : ''}`}
                >
                  <div
                    className={`inline-flex items-center gap-1.5 ${
                      col.align === 'right' || col.isNumeric
                        ? 'justify-end'
                        : col.align === 'center'
                        ? 'justify-center'
                        : 'justify-start'
                    }`}
                  >
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="text-[#8591A5] dark:text-[#94A3B8]">
                        {isSorted && sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#2F65F6] dark:text-[#93C5FD]" />
                        ) : isSorted && sortDirection === 'desc' ? (
                          <ArrowDown className="w-3.5 h-3.5 text-[#2F65F6] dark:text-[#93C5FD]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-35 hover:opacity-100" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-[#222830]">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center text-[#8591A5] dark:text-[#94A3B8]">
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
                  className={`transition-colors duration-150 group/row ${
                    onRowClick ? 'cursor-pointer' : ''
                  } ${
                    isSelected
                      ? 'bg-blue-50/60 dark:bg-[#2F65F6]/10 border-l-4 border-l-[#2F65F6]'
                      : 'hover:bg-slate-50/80 dark:hover:bg-[#1D232A]/80'
                  }`}
                >
                  {columns.map((col) => {
                    const value = (item as Record<string, unknown>)[col.key];
                    const isNum = col.align === 'right' || col.isNumeric;
                    return (
                      <td
                        key={col.key}
                        className={`px-5 py-3.5 text-[13px] text-[#111727] dark:text-[#CBD5E1] ${
                          isNum
                            ? 'text-right font-mono'
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
