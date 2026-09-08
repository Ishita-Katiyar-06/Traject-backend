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

export const ExplorerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

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

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Page Header */}
      <PageHeader
        title="Data Explorer"
        description="Search and inspect canonical ingested post observations across monitored platforms."
        actions={
          <div className="flex items-center gap-2">
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

      {/* 2. Compact Structured Search & Filter Bar */}
      <ExplorerFilters
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        totalCount={totalItems}
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
      {!isLoading && !isError && totalItems > 0 && (
        <ExplorerPagination
          page={filters.page || 1}
          totalPages={totalPages}
          totalItems={totalItems}
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
