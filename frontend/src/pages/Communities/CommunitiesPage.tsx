import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Info,
} from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { CommunityCard } from '../../components/communities/CommunityCard';
import { CommunityMetricsHeader } from '../../components/communities/CommunityMetricsHeader';
import { communityService } from '../../services/communityService';
import type {
  CommunityCluster,
  CommunitySummaryKPIs,
  CommunityGroupingMode,
} from '../../types/communities';

export const CommunitiesPage: React.FC = () => {
  const [communities, setCommunities] = useState<CommunityCluster[]>([]);
  const [kpis, setKpis] = useState<CommunitySummaryKPIs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [groupingMode, setGroupingMode] = useState<CommunityGroupingMode>('domain');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [commData, kpiData] = await Promise.all([
        communityService.getCommunities(groupingMode),
        communityService.getSummaryKPIs(),
      ]);
      setCommunities(commData);
      setKpis(kpiData);
    } catch (err) {
      console.error('Failed to load communities:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [groupingMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Extract unique domains for filter tabs
  const availableDomains = useMemo(() => {
    const domains = new Set<string>();
    communities.forEach((c) => domains.add(c.domain));
    return Array.from(domains);
  }, [communities]);

  // Filter communities by domain & search query
  const filteredCommunities = useMemo(() => {
    return communities.filter((c) => {
      const matchesDomain = selectedDomain === 'all' || c.domain === selectedDomain;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.domain_display.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.sources.some((s) => s.username.toLowerCase().includes(q) || s.display_name.toLowerCase().includes(q));
      return matchesDomain && matchesSearch;
    });
  }, [communities, selectedDomain, searchQuery]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 font-sans">
      {/* 1. Page Header */}
      <PageHeader
        title="Community & Source Networks"
        description="Dynamic clustering of monitored channels and author nodes based on strategic domains and verifiable cross-source narrative co-occurrence."
        actions={
          <div className="flex items-center gap-2.5">
            {/* Mode Toggle */}
            <div className="hidden sm:inline-flex p-1 rounded-xl bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-2xs">
              <button
                type="button"
                onClick={() => setGroupingMode('domain')}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-mono font-medium transition-all ${
                  groupingMode === 'domain'
                    ? 'bg-[#2F65F6] text-white shadow-xs'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#111727]'
                }`}
              >
                Domain Clusters
              </button>
              <button
                type="button"
                onClick={() => setGroupingMode('co_occurrence')}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-mono font-medium transition-all ${
                  groupingMode === 'co_occurrence'
                    ? 'bg-[#2F65F6] text-white shadow-xs'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#111727]'
                }`}
              >
                Co-Occurrence Density
              </button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={loadData}
              disabled={isRefreshing}
              className="gap-2 text-[12px] font-mono"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        }
      />

      {/* 2. Analytical Guardrail Callout */}
      <div className="px-4 py-3 rounded-[16px] bg-[#2F65F6]/5 dark:bg-[#2F65F6]/10 border border-[#2F65F6]/20 flex items-start gap-3">
        <Info className="w-4 h-4 text-[#2F65F6] shrink-0 mt-0.5" />
        <div className="text-[12px] text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
          <strong className="text-[#111727] dark:text-[#F8FAFC]">Observational Source Topology:</strong>{' '}
          Communities are computed from explicit domain categories and empirical narrative co-occurrence across the canonical corpus. These clusters indicate topical resonance and information flow, not coordinated inauthentic collusion.
        </div>
      </div>

      {/* 3. Summary KPIs Header */}
      <CommunityMetricsHeader kpis={kpis} isLoading={isLoading} />

      {/* 4. Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Domain Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedDomain('all')}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-mono transition-all shrink-0 ${
              selectedDomain === 'all'
                ? 'bg-[#111727] dark:bg-white text-white dark:text-[#111727] font-bold shadow-xs'
                : 'bg-white dark:bg-[#171C22] text-[#64748B] dark:text-[#94A3B8] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] hover:text-[#111727]'
            }`}
          >
            All Clusters ({communities.length})
          </button>
          {availableDomains.map((dom) => (
            <button
              key={dom}
              type="button"
              onClick={() => setSelectedDomain(dom)}
              className={`px-3 py-1.5 rounded-xl text-[12px] font-mono transition-all shrink-0 ${
                selectedDomain === dom
                  ? 'bg-[#111727] dark:bg-white text-white dark:text-[#111727] font-bold shadow-xs'
                  : 'bg-white dark:bg-[#171C22] text-[#64748B] dark:text-[#94A3B8] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] hover:text-[#111727]'
              }`}
            >
              {dom.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Channel / Keyword Search Input */}
        <div className="relative sm:w-72 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8591A5] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search channels, keywords..."
            className="w-full h-9 pl-8 pr-3 rounded-xl bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] text-[12px] font-sans text-[#111727] dark:text-[#F8FAFC] placeholder:text-[#8591A5] focus:outline-none focus:ring-2 focus:ring-[#2F65F6]/40 transition-all"
          />
        </div>
      </div>

      {/* 5. Communities Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-6 rounded-[24px] bg-white dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] space-y-4"
            >
              <Skeleton className="h-5 w-32 rounded-md" />
              <Skeleton className="h-4 w-48 rounded-md" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          ))}
        </div>
      ) : filteredCommunities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredCommunities.map((cluster) => (
            <CommunityCard key={cluster.id} community={cluster} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-4 rounded-[24px] bg-white dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] space-y-3">
          <Users className="w-10 h-10 mx-auto text-[#8591A5]" />
          <h4 className="text-[15px] font-bold text-[#111727] dark:text-[#F8FAFC]">
            No Matching Community Clusters
          </h4>
          <p className="text-[13px] text-[#8591A5] max-w-sm mx-auto">
            Try adjusting your search criteria or resetting the domain filter.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSelectedDomain('all');
              setSearchQuery('');
            }}
          >
            Reset Filters
          </Button>
        </div>
      )}
    </div>
  );
};
