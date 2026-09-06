import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { TopicFilters, TopicApiFilterParams } from '../../components/topics/TopicFilters';
import { TopicTable } from '../../components/topics/TopicTable';
import { telemetryApi } from '../../services/telemetryApi';
import { TopicSummaryResponse } from '../../types/api';

export const TopicsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [topics, setTopics] = useState<TopicSummaryResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const initialKeyword = searchParams.get('keyword') || '';

  const [filters, setFilters] = useState<TopicApiFilterParams>({
    keyword: initialKeyword,
    sort_by: 'message_count',
    order: 'desc',
    page: 1,
    page_size: 10,
  });

  const loadTopics = async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const apiParams: any = {
        page: filters.page,
        page_size: filters.page_size,
        sort_by: filters.sort_by,
        order: filters.order,
      };

      const res = await telemetryApi.getTopics(apiParams);

      let items = res.data;
      if (filters.keyword && filters.keyword.trim()) {
        const q = filters.keyword.toLowerCase().trim();
        items = items.filter(
          (t) =>
            t.topic_id.toLowerCase().includes(q) ||
            t.representative_keywords.some((k) => k.keyword.toLowerCase().includes(q))
        );
      }

      setTopics(items);
      setTotalCount(res.meta.total);
      setTotalPages(res.meta.total_pages);
    } catch (e) {
      console.error('Failed to load topics:', e);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTopics();

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
    <div className="space-y-6 font-sans">
      {/* 1. Page Header */}
      <PageHeader
        title="Topics"
        description="Explore semantic discussion clusters and keyword representations discovered across monitored sources."
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={loadTopics}
            disabled={isLoading}
          >
            Refresh
          </Button>
        }
      />

      {/* 2. Structured Filter Toolbar */}
      <TopicFilters
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        totalCount={totalCount}
        filteredCount={topics.length}
      />

      {/* 3. Topics List */}
      <TopicTable
        topics={topics}
        isLoading={isLoading}
        isError={isError}
        onRetry={loadTopics}
        onResetFilters={handleResetFilters}
      />

      {/* 4. Pagination Bar */}
      {!isLoading && !isError && totalPages > 1 && (
        <div className="flex items-center justify-between p-4 rounded-[20px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
          <div className="text-[13px] text-[#8591A5]">
            Page <strong className="text-[#111727]">{filters.page}</strong> of{' '}
            <strong className="text-[#111727]">{totalPages}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
              disabled={(filters.page || 1) <= 1}
              onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              disabled={(filters.page || 1) >= totalPages}
              onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
