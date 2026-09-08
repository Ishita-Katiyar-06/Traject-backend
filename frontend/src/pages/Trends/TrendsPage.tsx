import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { TrendFilters, TrendApiFilterParams } from '../../components/trends/TrendFilters';
import { TrendTable } from '../../components/trends/TrendTable';
import { telemetryApi } from '../../services/telemetryApi';
import { trendService, TrendWithNarratives, matchesTrendSearch } from '../../services/trendService';

export const TrendsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [trends, setTrends] = useState<TrendWithNarratives[]>([]);
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

  // Pre-warm the trend catalog in the background so searching is instant
  useEffect(() => {
    trendService.getAllTrendsWithNarratives().catch((err) => {
      console.debug('Background cache pre-warming completed with notice:', err);
    });
  }, []);

  const loadTrends = async (showSkeleton = false) => {
    if (showSkeleton) {
      setIsLoading(true);
    }
    setIsError(false);
    try {
      const isSearchActive = Boolean(filters.keyword && filters.keyword.trim());

      if (isSearchActive) {
        // High-speed client-side search across all authentic trends
        const allTrends = await trendService.getAllTrendsWithNarratives({ skipCache: false });
        const filtered = allTrends.filter((t) => matchesTrendSearch(t, filters.keyword || ''));

        // Client-side sort respecting current sort_by and order
        const sortBy = filters.sort_by || 'message_count';
        const order = filters.order || 'desc';
        filtered.sort((a, b) => {
          let valA: any = (a as any)[sortBy] ?? 0;
          let valB: any = (b as any)[sortBy] ?? 0;
          if (sortBy === 'trend_id' || sortBy === 'topic_id') {
            valA = a._numericId ?? parseInt(a.cleanId, 10) ?? 0;
            valB = b._numericId ?? parseInt(b.cleanId, 10) ?? 0;
          }
          if (order === 'asc') return valA > valB ? 1 : valA < valB ? -1 : 0;
          return valA < valB ? 1 : valA > valB ? -1 : 0;
        });

        const pageSize = filters.page_size || 10;
        const page = filters.page || 1;
        const total = filtered.length;
        const computedPages = Math.max(1, Math.ceil(total / pageSize));
        const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

        setTrends(paginated);
        setTotalCount(total);
        setTotalPages(computedPages);
      } else {
        // Standard paginated fetch from backend
        const apiParams: any = {
          page: filters.page,
          page_size: filters.page_size,
          sort_by: filters.sort_by,
          order: filters.order,
        };

        const res = await trendService.getTrendsWithNarratives(apiParams, { skipCache: false });
        setTrends(res.trends);
        setTotalCount(res.meta.total);
        setTotalPages(res.meta.total_pages);
      }
    } catch (e) {
      console.error('Failed to load trends:', e);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    trendService.clearCache();
    telemetryApi.clearCache();
    const minDelay = new Promise((resolve) => setTimeout(resolve, 600));
    try {
      await Promise.all([loadTrends(false), minDelay]);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const isFirstLoad = trends.length === 0;
    loadTrends(isFirstLoad);

    const p: Record<string, string> = {};
    if (filters.keyword) p.keyword = filters.keyword;
    if (filters.page && filters.page > 1) p.page = String(filters.page);
    setSearchParams(p, { replace: true });
  }, [filters.page, filters.page_size, filters.keyword, filters.sort_by, filters.order]);

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
