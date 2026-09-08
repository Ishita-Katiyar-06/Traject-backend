import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { NarrativeFilters, NarrativeApiFilterParams } from '../../components/narratives/NarrativeFilters';
import { NarrativeTable } from '../../components/narratives/NarrativeTable';
import { telemetryApi } from '../../services/telemetryApi';
import { NarrativeSummaryResponse } from '../../types/api';

export const NarrativesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [narratives, setNarratives] = useState<NarrativeSummaryResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isError, setIsError] = useState(false);

  const initialTier = (searchParams.get('priority_tier') as any) || 'all';

  const [filters, setFilters] = useState<NarrativeApiFilterParams>({
    priority_tier: initialTier,
    has_coordination_signal: 'all',
    sort_by: 'priority_signal_score',
    order: 'desc',
    query: '',
    page: 1,
    page_size: 10,
  });

  const loadNarratives = async (isInitial = false) => {
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

      if (filters.priority_tier && filters.priority_tier !== 'all') {
        apiParams.priority_tier = filters.priority_tier;
      }
      if (filters.has_coordination_signal !== undefined && filters.has_coordination_signal !== 'all') {
        apiParams.has_coordination_signal = filters.has_coordination_signal;
      }

      const res = await telemetryApi.getNarratives(apiParams, { skipCache: !isInitial });

      let items = res.data;
      if (filters.query && filters.query.trim()) {
        const q = filters.query.toLowerCase().trim();
        items = items.filter(
          (n) =>
            n.headline_claim.toLowerCase().includes(q) ||
            n.narrative_id.toLowerCase().includes(q) ||
            n.promoted_from_topic_id.toLowerCase().includes(q)
        );
      }

      setNarratives(items);
      setTotalCount(res.meta.total);
      setTotalPages(res.meta.total_pages);
    } catch (e) {
      console.error('Failed to load narrative candidates:', e);
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
      await Promise.all([loadNarratives(false), minDelay]);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadNarratives(true);

    const p: Record<string, string> = {};
    if (filters.priority_tier && filters.priority_tier !== 'all') {
      p.priority_tier = filters.priority_tier;
    }
    if (filters.page && filters.page > 1) {
      p.page = String(filters.page);
    }
    setSearchParams(p, { replace: true });
  }, [filters.page, filters.priority_tier, filters.has_coordination_signal, filters.sort_by, filters.order]);

  const handleResetFilters = () => {
    setFilters({
      priority_tier: 'all',
      has_coordination_signal: 'all',
      sort_by: 'priority_signal_score',
      order: 'desc',
      query: '',
      page: 1,
      page_size: 10,
    });
  };

  return (
    <div className="space-y-6 font-sans pb-10">
      {/* 1. Page Header */}
      <PageHeader
        title="Narrative Candidates"
        description="Monitor narrative clusters, 4G priority signal scores, and potential coordination indicators across the information space."
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

      {/* 2. Structured Filters */}
      <NarrativeFilters
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        totalCount={totalCount}
        filteredCount={narratives.length}
      />

      {/* 3. Narrative Table */}
      <NarrativeTable
        narratives={narratives}
        isLoading={isLoading}
        isError={isError}
        onRetry={loadNarratives}
        onResetFilters={handleResetFilters}
      />

      {/* 4. Pagination Bar */}
      {!isLoading && !isError && totalPages > 1 && (
        <Pagination
          page={filters.page || 1}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={filters.page_size || 10}
          itemLabel="narratives"
          onPageChange={(newPage) => setFilters({ ...filters, page: newPage })}
        />
      )}
    </div>
  );
};
