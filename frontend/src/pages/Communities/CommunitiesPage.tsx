import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
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
import { telemetryApi } from '../../services/telemetryApi';
import { staggerContainer } from '../../utils/motion';
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

  const loadData = useCallback(async (isManualRefresh = false) => {
    setIsRefreshing(true);
    try {
      const minDelay = isManualRefresh ? new Promise((resolve) => setTimeout(resolve, 600)) : Promise.resolve();
      const [commData, kpiData] = await Promise.all([
        communityService.getCommunities(groupingMode),
        communityService.getSummaryKPIs(),
        minDelay,
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

  const handleRefresh = async () => {
    telemetryApi.clearCache();
    await loadData(true);
  };

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
    <div className="space-y-6 sm:space-y-8 font-sans pb-10">
      {/* 1. Page Header */}
      <PageHeader
        title="Community & Source Networks"
        description="Dynamic clustering of monitored channels and author nodes based on strategic domains and verifiable cross-source narrative co-occurrence."
        actions={
          <div className="flex items-center gap-2.5">
            {/* Mode Toggle */}
            <div className="hidden sm:inline-flex p-1 rounded-xl bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-xs">
              <button
                type="button"
                onClick={() => setGroupingMode('domain')}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-mono font-medium transition-all ${
                  groupingMode === 'domain'
                    ? 'bg-[#2F65F6] text-white shadow-xs'
                    : 'text-[#64748B] dark:text-slate-400 hover:text-[#111727] dark:hover:text-white'
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
                    : 'text-[#64748B] dark:text-slate-400 hover:text-[#111727] dark:hover:text-white'
                }`}
              >
                Co-Occurrence Density
              </button>
            </div>

            <Button
              variant="secondary"
              size="md"
              onClick={handleRefresh}
              disabled={isRefreshing}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* 2. Analytical Guardrail Callout */}
      <div className="px-5 py-3.5 rounded-[20px] bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 flex items-start gap-3 shadow-xs">
        <Info className="w-4 h-4 text-[#2F65F6] dark:text-[#5878C7] shrink-0 mt-0.5" />
        <div className="text-[12px] text-[#475569] dark:text-slate-300 leading-relaxed">
          <strong className="text-[#111727] dark:text-slate-100 font-bold">Observational Source Topology:</strong>{' '}
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
            className={`px-3.5 py-1.5 rounded-xl text-[12px] font-mono transition-all shrink-0 cursor-pointer ${
              selectedDomain === 'all'
                ? 'bg-[#111727] dark:bg-white text-white dark:text-[#111727] font-bold shadow-xs'
                : 'bg-white dark:bg-[#171C22] text-[#64748B] dark:text-slate-400 border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] hover:text-[#111727] dark:hover:text-white'
            }`}
          >
            All Clusters ({communities.length})
          </button>
          {availableDomains.map((dom) => (
            <button
              key={dom}
              type="button"
              onClick={() => setSelectedDomain(dom)}
              className={`px-3.5 py-1.5 rounded-xl text-[12px] font-mono transition-all shrink-0 cursor-pointer ${
                selectedDomain === dom
                  ? 'bg-[#111727] dark:bg-white text-white dark:text-[#111727] font-bold shadow-xs'
                  : 'bg-white dark:bg-[#171C22] text-[#64748B] dark:text-slate-400 border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] hover:text-[#111727] dark:hover:text-white'
              }`}
            >
              {dom.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Channel / Keyword Search Input */}
        <div className="relative sm:w-72 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8591A5] dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search channels, keywords..."
            className="w-full h-9 pl-8 pr-3 rounded-xl bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] text-[12px] font-sans text-[#111727] dark:text-slate-100 placeholder:text-[#8591A5] dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2F65F6]/30 transition-all shadow-xs"
          />
        </div>
      </div>

      {/* 5. Communities Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-6 rounded-[24px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] space-y-4"
            >
              <Skeleton className="h-5 w-32 rounded-md" />
              <Skeleton className="h-4 w-48 rounded-md" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          ))}
        </div>
      ) : filteredCommunities.length > 0 ? (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
        >
          {filteredCommunities.map((cluster) => (
            <CommunityCard key={cluster.id} community={cluster} />
          ))}
        </motion.div>
      ) : (
        <div className="text-center py-16 px-4 rounded-[24px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] space-y-3 shadow-dashboard">
          <Users className="w-10 h-10 mx-auto text-[#8591A5] dark:text-slate-500" />
          <h4 className="text-[16px] font-bold text-[#111727] dark:text-slate-100">
            No Matching Community Clusters
          </h4>
          <p className="text-[13px] text-[#8591A5] dark:text-slate-400 max-w-sm mx-auto">
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
