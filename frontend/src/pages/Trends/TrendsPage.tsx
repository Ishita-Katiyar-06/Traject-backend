import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { TrendFilters, TrendApiFilterParams } from '../../components/trends/TrendFilters';
import { TrendTable } from '../../components/trends/TrendTable';
import { telemetryApi } from '../../services/telemetryApi';
import { TrendSummaryResponse, TopicSummaryResponse } from '../../types/api';

export const TrendsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [trends, setTrends] = useState<(TrendSummaryResponse | TopicSummaryResponse)[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isError, setIsError] = useState(false);

  const initialKeyword = searchParams.get('keyword') || '';

  const [filters, setFilters] = useState<TrendApiFilterParams>({
    keyword: initialKeyword,
    sort_by: 'message_count',
    order: 'desc',
    page: 1,
    page_size: 10,
  });

  const loadTrends = async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    }
    setIsError(false);
    try {
      const apiParams: any = {
        page: filters.page,
        page_size: filters.page_size,
        sort_by: filters.sort_by,
        order: filters.order,
      };

      const res = await telemetryApi.getTrends(apiParams, { skipCache: !isInitial });

      let items = res.data;
      if (filters.keyword && filters.keyword.trim()) {
        const q = filters.keyword.toLowerCase().trim();
        items = items.filter(
          (t) =>
            t.topic_id.toLowerCase().includes(q) ||
            ('trend_id' in t && (t as any).trend_id.toLowerCase().includes(q)) ||
            t.representative_keywords.some((k) => k.keyword.toLowerCase().includes(q))
        );
      }

      setTrends(items);
      setTotalCount(res.meta.total);
      setTotalPages(res.meta.total_pages);
    } catch (e) {
      console.error('Failed to load trends:', e);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    telemetryApi.clearCache();
    const minDelay = new Promise((resolve) => setTimeout(resolve, 600));
    try {
      await Promise.all([loadTrends(false), minDelay]);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadTrends(true);

    const p: Record<string, string> = {};
    if (filters.keyword) p.keyword = filters.keyword;
    if (filters.page && filters.page > 1) p.page = String(filters.page);
    setSearchParams(p, { replace: true });
  }, [filters.page, filters.keyword, filters.sort_by, filters.order]);

  const handleResetFilters = () => {
    setFilters({
      keyword: '',
      sort_by: 'message_count',
      order: 'desc',
      page: 1,
      page_size: 10,
    });
  };

  return (
    <div className="space-y-6 font-sans pb-10">
      {/* 1. Page Header */}
      <PageHeader
        title="Trends"
        description="Algorithmic trend clusters discovered via multilingual sentence embeddings and HDBSCAN density clustering."
        actions={
          <Button
            variant="secondary"
            size="md"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
          >
            Refresh
          </Button>
        }
      />

      {/* 2. Structured Filter Toolbar */}
      <TrendFilters
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        totalCount={totalCount}
        filteredCount={trends.length}
      />

      {/* 3. Trends List */}
      <TrendTable
        trends={trends}
        isLoading={isLoading}
        isError={isError}
        onRetry={loadTrends}
        onResetFilters={handleResetFilters}
      />

      {/* 4. Pagination Bar */}
      {!isLoading && !isError && totalPages > 1 && (
        <Pagination
          page={filters.page || 1}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={filters.page_size || 10}
          itemLabel="trends"
          onPageChange={(newPage) => setFilters({ ...filters, page: newPage })}
        />
      )}
    </div>
  );
};
