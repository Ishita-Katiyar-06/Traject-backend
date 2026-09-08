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
  Check,
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
        header: 'Post time',
        size: 110,
        enableSorting: true,
        cell: (info) => (
          <span className="text-[#8591A5] dark:text-[#94A3B8] font-medium whitespace-nowrap font-mono text-[12px]">
            {info.getValue() ? formatTimeOnly(info.getValue()) : '—'}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.channel_title || row.author_id, {
        id: 'platform',
        header: 'Platform & channel',
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
              {item.canonical_id.startsWith('msg-live-') && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 animate-pulse">
                  LIVE
                </span>
              )}
              <span
                className="font-semibold text-[#111727] dark:text-[#F8FAFC] text-[12px] truncate max-w-[140px]"
                title={item.channel_title || item.author_id}
              >
                {item.channel_title || item.author_id}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor('text_content', {
        id: 'text_content',
        header: 'Canonical text excerpt',
        enableSorting: false,
        cell: (info) => (
          <p className="text-[#111727] dark:text-[#CBD5E1] font-normal leading-relaxed line-clamp-2 max-w-lg">
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
            <div className="flex items-center gap-3 text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8]">
              {item.views_count !== null && item.views_count !== undefined && (
                <span className="inline-flex items-center gap-1" title="Observed Views">
                  <Eye className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span>{item.views_count.toLocaleString()}</span>
                </span>
              )}
              {item.forwards_count !== null && item.forwards_count !== undefined && (
                <span className="inline-flex items-center gap-1" title="Forwards">
                  <Share2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
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
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2F65F6] dark:text-[#93C5FD] group-hover:underline">
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
      <div className="space-y-3 font-sans" role="status" aria-label="Loading observations">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="p-5 rounded-[22px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md flex items-center justify-between shadow-xs"
          >
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-44 rounded-full" />
              <Skeleton className="h-4 w-3/4 rounded-full" />
            </div>
            <Skeleton className="h-6 w-20 shrink-0 ml-4 rounded-full" />
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
      <div className="p-12 sm:p-16 rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs text-center space-y-4 font-sans">
        <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center text-[#2F65F6] dark:text-[#93C5FD] mx-auto">
          <Database className="w-7 h-7" />
        </div>
        <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100 tracking-tight">
          No canonical messages match the current filter query
        </h3>
        <p className="text-[13px] text-[#64748B] dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          Try adjusting your platform, language, or search keyword terms.
        </p>
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-[12px] font-mono font-bold bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/80 dark:border-[#282F3A] hover:border-amber-400/80 dark:hover:border-amber-500/50 text-[#111727] dark:text-slate-200 transition-all cursor-pointer shadow-xs"
          >
            Reset Explorer filters
          </button>
        )}
      </div>
    );
  }

  const columnToggleItems = [
    {
      id: 'published_at',
      label: 'Post Time',
      icon: columnVisibility.published_at ? (
        <Check className="w-3.5 h-3.5 text-[#2F65F6] dark:text-[#93C5FD]" />
      ) : (
        <span className="w-3.5 h-3.5 inline-block" />
      ),
      closeOnClick: false,
      onClick: () =>
        setColumnVisibility((prev) => ({ ...prev, published_at: !prev.published_at })),
    },
    {
      id: 'platform',
      label: 'Platform / Channel',
      icon: columnVisibility.platform ? (
        <Check className="w-3.5 h-3.5 text-[#2F65F6] dark:text-[#93C5FD]" />
      ) : (
        <span className="w-3.5 h-3.5 inline-block" />
      ),
      closeOnClick: false,
      onClick: () =>
        setColumnVisibility((prev) => ({ ...prev, platform: !prev.platform })),
    },
    {
      id: 'text_content',
      label: 'Text Excerpt',
      icon: columnVisibility.text_content ? (
        <Check className="w-3.5 h-3.5 text-[#2F65F6] dark:text-[#93C5FD]" />
      ) : (
        <span className="w-3.5 h-3.5 inline-block" />
      ),
      closeOnClick: false,
      onClick: () =>
        setColumnVisibility((prev) => ({ ...prev, text_content: !prev.text_content })),
    },
    {
      id: 'interactions',
      label: 'Interactions',
      icon: columnVisibility.interactions ? (
        <Check className="w-3.5 h-3.5 text-[#2F65F6] dark:text-[#93C5FD]" />
      ) : (
        <span className="w-3.5 h-3.5 inline-block" />
      ),
      closeOnClick: false,
      onClick: () =>
        setColumnVisibility((prev) => ({ ...prev, interactions: !prev.interactions })),
    },
  ];

  return (
    <div className="space-y-3 font-sans">
      {/* Table Toolbar / Controls */}
      <div className="flex items-center justify-between px-1">
        <div className="text-[12px] font-mono text-[#8591A5] dark:text-slate-400">
          Showing <span className="font-bold text-[#111727] dark:text-slate-100">{table.getRowModel().rows.length}</span> operational records
        </div>
        <Dropdown
          align="right"
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/80 dark:border-[#282F3A] hover:border-amber-400/80 dark:hover:border-amber-500/50 text-[12px] font-mono font-semibold text-[#475569] dark:text-slate-300 shadow-2xs transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#8591A5] dark:text-slate-400" />
              <span>Columns</span>
            </button>
          }
          items={columnToggleItems}
        />
      </div>

      {/* TanStack Table Container */}
      <div className="rounded-[26px] sm:rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs overflow-hidden font-sans">
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead className="sticky top-0 z-10 bg-[#FAFBFD] dark:bg-[#12161C] border-b border-slate-200/80 dark:border-[#282F3A] text-[11px] font-mono uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const isSorted = header.column.getIsSorted();
                    const canSort = header.column.getCanSort();
                    return (
                      <th
                        key={header.id}
                        style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                        className={`py-3.5 px-4 select-none ${header.id === 'actions' ? 'text-right' : ''} ${
                          canSort ? 'cursor-pointer hover:text-[#111727] dark:hover:text-slate-100' : ''
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
                            <span className="text-[#8591A5] dark:text-slate-400">
                              {isSorted === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-[#2F65F6] dark:text-[#93C5FD]" />
                              ) : isSorted === 'desc' ? (
                                <ArrowDown className="w-3.5 h-3.5 text-[#2F65F6] dark:text-[#93C5FD]" />
                              ) : (
                                <ArrowUpDown className="w-3.5 h-3.5 opacity-30 group-hover:opacity-100" />
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
            <tbody className="divide-y divide-slate-100 dark:divide-[#252B32]">
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
                  className="hover:bg-slate-50/80 dark:hover:bg-[#1D232A]/80 transition-colors cursor-pointer group focus:bg-[#F1F4F9] dark:focus:bg-[#252B32] focus:outline-none"
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
        <div className="sm:hidden divide-y divide-slate-100 dark:divide-[#252B32]">
          {items.map((item) => (
            <div
              key={item.canonical_id}
              onClick={() => onSelectItem(item)}
              className="p-4 space-y-2 hover:bg-slate-50/80 dark:hover:bg-[#1D232A]/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Badge variant="neutral" size="sm" className="rounded-full font-mono text-[10px]">
                    {item.platform}
                  </Badge>
                  <span className="font-semibold text-[#111727] dark:text-slate-100">
                    {item.channel_title || item.author_id}
                  </span>
                </div>
                <span className="font-mono text-[#8591A5] dark:text-slate-400">
                  {item.published_at ? formatTimeOnly(item.published_at) : '—'}
                </span>
              </div>
              <p className="text-[13px] text-[#111727] dark:text-slate-200 line-clamp-2 leading-relaxed">
                {item.text_content || '<media attachment / no text>'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
