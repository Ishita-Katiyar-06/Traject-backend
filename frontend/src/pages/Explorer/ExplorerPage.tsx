import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Dropdown } from '../../components/ui/Dropdown';
import { ExplorerFilters, ExplorerApiFilterParams } from '../../components/explorer/ExplorerFilters';
import { ExplorerTable } from '../../components/explorer/ExplorerTable';
import { ExplorerPagination } from '../../components/explorer/ExplorerPagination';
import { ExplorerDetailModal } from '../../components/explorer/ExplorerDetailModal';
import { telemetryApi } from '../../services/telemetryApi';
import { exportService } from '../../services/exportService';
import { MessageSummaryResponse, MessageQueryParams } from '../../types/api';
import { RefreshCw, Download } from 'lucide-react';
import { useLiveStream } from '../../contexts/LiveStreamContext';

export const ExplorerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { liveMessages, totalCorpusCount, connectionStatus } = useLiveStream();
  const [autoStream, setAutoStream] = useState(true);

  // Parse filters from URL
  const initialQuery = searchParams.get('keyword') || searchParams.get('q') || '';
  const initialPlatform = (searchParams.get('platform') as any) || 'All';
  const initialLanguage = searchParams.get('lang') || undefined;
  const initialTopic = searchParams.get('topicId') || searchParams.get('topic_id') || undefined;
  const initialPage = parseInt(searchParams.get('page') || '1', 10);

  const [filters, setFilters] = useState<ExplorerApiFilterParams>({
    keyword: initialQuery,
    platform: initialPlatform,
    language: initialLanguage,
    topic_id: initialTopic,
    sort_by: 'published_at',
    order: 'desc',
    page: initialPage,
    page_size: 10,
  });

  const [observations, setObservations] = useState<MessageSummaryResponse[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedItem, setSelectedItem] = useState<MessageSummaryResponse | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isError, setIsError] = useState(false);

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    }
    setIsError(false);
    try {
      const apiParams: MessageQueryParams = {
        page: filters.page,
        page_size: filters.page_size,
        sort_by: filters.sort_by,
        order: filters.order,
      };
      if (filters.platform && filters.platform !== 'All') apiParams.platform = filters.platform;
      if (filters.language) apiParams.language = filters.language;
      if (filters.topic_id) apiParams.topic_id = filters.topic_id;

      const res = await telemetryApi.getMessages(apiParams, { skipCache: !isInitial });

      let items = res.data;
      if (filters.keyword && filters.keyword.trim()) {
        const q = filters.keyword.toLowerCase().trim();
        items = items.filter(
          (m) =>
            m.text_content.toLowerCase().includes(q) ||
            m.canonical_id.toLowerCase().includes(q) ||
            (m.channel_title && m.channel_title.toLowerCase().includes(q)) ||
            m.author_id.toLowerCase().includes(q)
        );
      }

      setObservations(items);
      setTotalItems(res.meta.total);
      setTotalPages(res.meta.total_pages);
    } catch (e) {
      console.error('Failed to load canonical messages:', e);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    telemetryApi.clearCache();
    const minDelay = new Promise((resolve) => setTimeout(resolve, 600));
    try {
      await Promise.all([loadData(false), minDelay]);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(true);

    // Sync filter state to URL query parameters
    const params: Record<string, string> = {};
    if (filters.keyword) params.keyword = filters.keyword;
    if (filters.platform && filters.platform !== 'All') params.platform = filters.platform;
    if (filters.language) params.lang = filters.language;
    if (filters.topic_id) params.topicId = filters.topic_id;
    if (filters.page && filters.page > 1) params.page = String(filters.page);
    setSearchParams(params, { replace: true });
  }, [filters, loadData, setSearchParams]);

  // Prepend live messages dynamically when on page 1 and autoStream is active
  useEffect(() => {
    if (!autoStream || filters.page !== 1 || liveMessages.length === 0) return;

    setObservations((prev) => {
      const existingIds = new Set(prev.map((m) => m.canonical_id));
      const newItems: MessageSummaryResponse[] = [];

      for (const lm of liveMessages) {
        if (!existingIds.has(lm.message_id)) {
          // Check keyword filter if present
          if (filters.keyword && filters.keyword.trim()) {
            const q = filters.keyword.toLowerCase().trim();
            const textMatch = lm.text.toLowerCase().includes(q);
            const idMatch = lm.message_id.toLowerCase().includes(q);
            const channelMatch =
              lm.channel_title.toLowerCase().includes(q) ||
              (lm.channel_username && lm.channel_username.toLowerCase().includes(q));
            if (!textMatch && !idMatch && !channelMatch) continue;
          }
          newItems.push({
            canonical_id: lm.message_id,
            platform: 'telegram',
            native_id: String(lm.native_id),
            author_id: lm.channel_username ? `@${lm.channel_username}` : lm.channel_title,
            channel_title: lm.channel_title,
            published_at: lm.timestamp,
            text_content: lm.text,
            language: 'en',
            views_count: lm.views,
            forwards_count: lm.forwards,
            has_media: lm.has_media,
            is_forward: false,
          });
        }
      }

      if (newItems.length === 0) return prev;
      return [...newItems, ...prev];
    });

    if (totalCorpusCount && totalCorpusCount > totalItems) {
      setTotalItems(totalCorpusCount);
    }
  }, [liveMessages, autoStream, filters.page, filters.keyword, totalCorpusCount, totalItems]);

  const handleResetFilters = () => {
    setFilters({
      keyword: '',
      platform: 'All',
      language: undefined,
      topic_id: undefined,
      sort_by: 'published_at',
      order: 'desc',
      page: 1,
      page_size: 10,
    });
  };

  const handleSelectItem = (item: MessageSummaryResponse) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  };

  const handleExportCsv = () => {
    const headers = [
      { key: 'canonical_id', label: 'Canonical ID' },
      { key: 'published_at', label: 'Published (UTC)' },
      { key: 'platform', label: 'Platform' },
      { key: 'author_id', label: 'Author ID' },
      { key: 'channel_title', label: 'Channel Title' },
      { key: 'views_count', label: 'Observed Views' },
      { key: 'forwards_count', label: 'Forwards' },
      { key: 'text_content', label: 'Canonical Text' },
    ];
    exportService.exportToCsv('tessera_canonical_observations', headers, observations as unknown as Record<string, unknown>[]);
  };

  const handleExportJson = () => {
    exportService.exportToJson('tessera_canonical_observations', observations);
  };

  const exportMenuItems = [
    { id: 'csv', label: 'Export Query as CSV', onClick: handleExportCsv },
    { id: 'json', label: 'Export Query as JSON', onClick: handleExportJson },
  ];

  const displayTotalCount = totalCorpusCount !== null && totalCorpusCount > totalItems
    ? totalCorpusCount
    : totalItems;

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Page Header */}
      <PageHeader
        title="Data Explorer"
        description="Search and inspect canonical ingested post observations across monitored platforms."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={autoStream ? 'primary' : 'secondary'}
              size="sm"
              leftIcon={
                <span className="relative flex h-2 w-2 mr-0.5">
                  {autoStream && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${autoStream ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                </span>
              }
              onClick={() => setAutoStream((prev) => !prev)}
            >
              {autoStream ? 'Auto-Stream: ON' : 'Auto-Stream: OFF'}
            </Button>

            <Dropdown
              trigger={
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Download className="w-3.5 h-3.5" />}
                >
                  Export
                </Button>
              }
              items={exportMenuItems}
              align="right"
            />

            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Live Stream Telemetry Banner */}
      {connectionStatus === 'connected' && liveMessages.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-[14px] bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 text-[13px] text-emerald-900 dark:text-emerald-200 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-semibold">
              Live MTProto Stream Active:
            </span>
            <span className="text-emerald-700 dark:text-emerald-300">
              {liveMessages.length} real-time messages captured in current session ({displayTotalCount.toLocaleString()} total corpus)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadData()}
              leftIcon={<RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Sync Server
            </Button>
          </div>
        </div>
      )}

      {/* 2. Compact Structured Search & Filter Bar */}
      <ExplorerFilters
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        totalCount={displayTotalCount}
      />

      {/* 3. Observational Results Table */}
      <ExplorerTable
        items={observations}
        onSelectItem={handleSelectItem}
        isLoading={isLoading}
        isError={isError}
        onRetry={loadData}
        onResetFilters={handleResetFilters}
      />

      {/* 4. Server-Style Pagination */}
      {!isLoading && !isError && displayTotalCount > 0 && (
        <ExplorerPagination
          page={filters.page || 1}
          totalPages={Math.max(totalPages, Math.ceil(displayTotalCount / (filters.page_size || 10)))}
          totalItems={displayTotalCount}
          pageSize={filters.page_size || 10}
          onPageChange={(newPage) => setFilters({ ...filters, page: newPage })}
        />
      )}

      {/* 5. Detail Modal */}
      <ExplorerDetailModal
        item={selectedItem}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </div>
  );
};
