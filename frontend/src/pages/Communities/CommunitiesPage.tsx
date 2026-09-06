import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { CommunityFilters } from '../../components/communities/CommunityFilters';
import { CommunityTable } from '../../components/communities/CommunityTable';
import { communityService, CommunityFilterParams } from '../../services/communityService';
import { CommunityDetail } from '../../data/mock/communities';

export const CommunitiesPage: React.FC = () => {
  const [communities, setCommunities] = useState<CommunityDetail[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [timeRange, setTimeRange] = useState('24h');

  const [filters, setFilters] = useState<CommunityFilterParams>({
    platform: 'All',
    language: 'All',
    activity: 'All',
    trend: 'All',
    query: '',
    sortBy: 'volume',
  });

  const loadCommunities = async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const all = await communityService.getCommunities();
      setTotalCount(all.length);

      const filtered = await communityService.getCommunities(filters);
      setCommunities(filtered);
    } catch (e) {
      console.error('Failed to load communities:', e);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCommunities();
  }, [filters, timeRange]);

  const handleResetFilters = () => {
    setFilters({
      platform: 'All',
      language: 'All',
      activity: 'All',
      trend: 'All',
      query: '',
      sortBy: 'volume',
    });
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Page Header with Time Range and Refresh */}
      <PageHeader
        title="Communities"
        description="Explore discussion clusters and their role in monitored conversations."
        actions={
          <div className="flex items-center gap-3">
            <div className="w-[146px]">
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                options={[
                  { value: '6h', label: 'Last 6 Hours' },
                  { value: '12h', label: 'Last 12 Hours' },
                  { value: '24h', label: 'Last 24 Hours' },
                  { value: '7d', label: 'Last 7 Days' },
                ]}
                align="right"
                aria-label="Filter timeline range"
              />
            </div>

            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={loadCommunities}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* 2. Practical Community Filters */}
      <CommunityFilters
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        totalCount={totalCount}
        filteredCount={communities.length}
      />

      {/* 3. Community Table */}
      <CommunityTable
        communities={communities}
        isLoading={isLoading}
        isError={isError}
        onRetry={loadCommunities}
        onResetFilters={handleResetFilters}
      />
    </div>
  );
};
