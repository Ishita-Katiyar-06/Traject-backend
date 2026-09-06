import React from 'react';
import { MessageSummaryResponse } from '../../types/api';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../feedback/EmptyState';
import { ErrorState } from '../feedback/ErrorState';
import { Database, Eye, Share2, ArrowUpRight } from 'lucide-react';
import { formatTimeOnly } from '../../utils/time';

export interface ExplorerTableProps {
  items: MessageSummaryResponse[];
  onSelectItem: (item: MessageSummaryResponse) => void;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onResetFilters?: () => void;
}

export const ExplorerTable: React.FC<ExplorerTableProps> = ({
  items,
  onSelectItem,
  isLoading = false,
  isError = false,
  onRetry,
  onResetFilters,
}) => {
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

  return (
    <div className="rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white shadow-xs overflow-hidden font-sans">
      {/* Desktop / Tablet Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-[#F8FAFD] border-b border-[rgba(228,233,245,0.85)] text-[11px] font-bold text-[#8591A5] uppercase tracking-wider">
              <th className="py-3 px-4">Post Time</th>
              <th className="py-3 px-4">Platform / Channel</th>
              <th className="py-3 px-4">Canonical Text Excerpt</th>
              <th className="py-3 px-4">Interactions</th>
              <th className="py-3 px-4 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(228,233,245,0.6)]">
            {items.map((item) => (
              <tr
                key={item.canonical_id}
                onClick={() => onSelectItem(item)}
                className="hover:bg-[#F8FAFD] transition-colors cursor-pointer group"
              >
                {/* Time */}
                <td className="py-3.5 px-4 text-[#8591A5] font-medium whitespace-nowrap align-top font-mono text-[12px]">
                  {item.published_at ? formatTimeOnly(item.published_at) : '—'}
                </td>

                {/* Source & Platform */}
                <td className="py-3.5 px-4 align-top whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={item.platform === 'telegram' ? 'data' : 'neutral'}
                      size="sm"
                    >
                      {item.platform.toUpperCase()}
                    </Badge>
                    <span className="font-semibold text-[#111727] text-[12px] truncate max-w-[140px]">
                      {item.channel_title || item.author_id}
                    </span>
                  </div>
                </td>

                {/* Text Excerpt */}
                <td className="py-3.5 px-4 align-top">
                  <p className="text-[#111727] font-normal leading-relaxed line-clamp-2 max-w-lg">
                    {item.text_content || '<media attachment / no text>'}
                  </p>
                </td>

                {/* Interactions */}
                <td className="py-3.5 px-4 align-top whitespace-nowrap">
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
                </td>

                {/* Inspect Action */}
                <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2F65F6] group-hover:underline">
                    <span>Inspect</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </td>
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
  );
};
