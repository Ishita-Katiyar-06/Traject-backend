import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  flexRender,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';
import { MessageSummaryResponse } from '../../types/api';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../feedback/EmptyState';
import { ErrorState } from '../feedback/ErrorState';
import { Dropdown } from '../ui/Dropdown';
import {
  Database,
  Eye,
  Share2,
  ArrowUpRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
} from 'lucide-react';
import { formatTimeOnly } from '../../utils/time';

export interface ExplorerTableProps {
  items: MessageSummaryResponse[];
  onSelectItem: (item: MessageSummaryResponse) => void;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onResetFilters?: () => void;
}

const columnHelper = createColumnHelper<MessageSummaryResponse>();

export const ExplorerTable: React.FC<ExplorerTableProps> = ({
  items,
  onSelectItem,
  isLoading = false,
  isError = false,
  onRetry,
  onResetFilters,
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    published_at: true,
    platform: true,
    text_content: true,
    interactions: true,
    actions: true,
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor('published_at', {
        id: 'published_at',
        header: 'Post Time',
        size: 110,
        enableSorting: true,
        cell: (info) => (
          <span className="text-[#8591A5] font-medium whitespace-nowrap font-mono text-[12px]">
            {info.getValue() ? formatTimeOnly(info.getValue()) : '—'}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.channel_title || row.author_id, {
        id: 'platform',
        header: 'Platform / Channel',
        size: 200,
        enableSorting: true,
        cell: (info) => {
          const item = info.row.original;
          return (
            <div className="flex items-center gap-2">
              <Badge
                variant={item.platform === 'telegram' ? 'data' : 'neutral'}
                size="sm"
              >
                {item.platform.toUpperCase()}
              </Badge>
              <span className="font-semibold text-[#111727] text-[12px] truncate max-w-[140px]" title={item.channel_title || item.author_id}>
                {item.channel_title || item.author_id}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor('text_content', {
        id: 'text_content',
        header: 'Canonical Text Excerpt',
        enableSorting: false,
        cell: (info) => (
          <p className="text-[#111727] font-normal leading-relaxed line-clamp-2 max-w-lg">
            {info.getValue() || '<media attachment / no text>'}
          </p>
        ),
      }),
      columnHelper.accessor((row) => (row.views_count ?? 0) + (row.forwards_count ?? 0), {
        id: 'interactions',
        header: 'Interactions',
        size: 130,
        enableSorting: true,
        cell: (info) => {
          const item = info.row.original;
          return (
            <div className="flex items-center gap-3 text-[11px] font-mono text-[#64748B]">
              {item.views_count !== null && item.views_count !== undefined && (
                <span className="inline-flex items-center gap-1" title="Observed Views">
                  <Eye className="w-3 h-3 text-slate-400" />
                  <span>{item.views_count.toLocaleString()}</span>
                </span>
              )}
              {item.forwards_count !== null && item.forwards_count !== undefined && (
                <span className="inline-flex items-center gap-1" title="Forwards">
                  <Share2 className="w-3 h-3 text-slate-400" />
                  <span>{item.forwards_count}</span>
                </span>
              )}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Inspect',
        size: 80,
        cell: () => (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2F65F6] group-hover:underline">
            <span>Inspect</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: items,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) {
    return (
      <div className="space-y-2 font-sans" role="status" aria-label="Loading observations">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="p-4 rounded-[18px] border border-border bg-surface flex items-center justify-between"
          >
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <Skeleton className="h-6 w-20 shrink-0 ml-4" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Observations could not be retrieved"
        message="A network or server error occurred while querying /api/v1/messages."
        onRetry={onRetry}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No canonical messages match the current filter query"
        description="Try adjusting your platform, language, or search keyword terms."
        icon={<Database className="w-6 h-6 text-text-muted" />}
        actionLabel="Reset Explorer filters"
        onAction={onResetFilters}
      />
    );
  }

  const columnToggleItems = [
    {
      id: 'published_at',
      label: `${columnVisibility.published_at ? '✓ ' : ''}Post Time`,
      onClick: () =>
        setColumnVisibility((prev) => ({ ...prev, published_at: !prev.published_at })),
    },
    {
      id: 'platform',
      label: `${columnVisibility.platform ? '✓ ' : ''}Platform / Channel`,
      onClick: () =>
        setColumnVisibility((prev) => ({ ...prev, platform: !prev.platform })),
    },
    {
      id: 'text_content',
      label: `${columnVisibility.text_content ? '✓ ' : ''}Text Excerpt`,
      onClick: () =>
        setColumnVisibility((prev) => ({ ...prev, text_content: !prev.text_content })),
    },
    {
      id: 'interactions',
      label: `${columnVisibility.interactions ? '✓ ' : ''}Interactions`,
      onClick: () =>
        setColumnVisibility((prev) => ({ ...prev, interactions: !prev.interactions })),
    },
  ];

  return (
    <div className="space-y-2">
      {/* Table Toolbar / Controls */}
      <div className="flex items-center justify-between px-1">
        <div className="text-[12px] font-mono text-[#8591A5]">
          Showing {table.getRowModel().rows.length} operational records
        </div>
        <Dropdown
          align="right"
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white border border-[rgba(228,233,245,0.85)] hover:bg-[#F8FAFD] text-[12px] font-medium text-[#475569] shadow-2xs transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#8591A5]" />
              <span>Columns</span>
            </button>
          }
          items={columnToggleItems}
        />
      </div>

      {/* TanStack Table Container */}
      <div className="rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white shadow-xs overflow-hidden font-sans">
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead className="sticky top-0 z-10 bg-[#F8FAFD] border-b border-[rgba(228,233,245,0.85)] text-[11px] font-bold text-[#8591A5] uppercase tracking-wider">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const isSorted = header.column.getIsSorted();
                    const canSort = header.column.getCanSort();
                    return (
                      <th
                        key={header.id}
                        style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                        className={`py-3 px-4 select-none ${header.id === 'actions' ? 'text-right' : ''} ${
                          canSort ? 'cursor-pointer hover:text-[#111727]' : ''
                        }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div
                          className={`inline-flex items-center gap-1.5 ${
                            header.id === 'actions' ? 'justify-end w-full' : ''
                          }`}
                        >
                          <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          {canSort && (
                            <span className="text-[#8591A5]">
                              {isSorted === 'asc' ? (
                                <ArrowUp className="w-3 h-3 text-[#2F65F6]" />
                              ) : isSorted === 'desc' ? (
                                <ArrowDown className="w-3 h-3 text-[#2F65F6]" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[rgba(228,233,245,0.6)]">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onSelectItem(row.original)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectItem(row.original);
                    }
                  }}
                  tabIndex={0}
                  className="hover:bg-[#F8FAFD] transition-colors cursor-pointer group focus:bg-[#F1F4F9] focus:outline-none"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`py-3.5 px-4 align-top ${cell.column.id === 'actions' ? 'text-right whitespace-nowrap' : ''}`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List View */}
        <div className="sm:hidden divide-y divide-[rgba(228,233,245,0.85)]">
          {items.map((item) => (
            <div
              key={item.canonical_id}
              onClick={() => onSelectItem(item)}
              className="p-4 space-y-2 hover:bg-[#F8FAFD] transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Badge variant="neutral" size="sm">
                    {item.platform}
                  </Badge>
                  <span className="font-semibold text-[#111727]">{item.channel_title || item.author_id}</span>
                </div>
                <span className="font-mono text-[#8591A5]">{item.published_at}</span>
              </div>
              <p className="text-[13px] text-[#111727] line-clamp-2">
                {item.text_content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
