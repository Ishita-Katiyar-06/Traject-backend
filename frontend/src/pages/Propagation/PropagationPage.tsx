import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, RotateCcw } from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { PropagationFlow } from '../../components/propagation/PropagationFlow';
import { PropagationTimeline } from '../../components/propagation/PropagationTimeline';
import { PlatformMigrationCard } from '../../components/propagation/PlatformMigrationCard';
import { CommunityMovementCard } from '../../components/propagation/CommunityMovementCard';
import { PropagationDetailModal } from '../../components/propagation/PropagationDetailModal';
import { propagationService, PropagationFilterParams } from '../../services/propagationService';
import {
  PropagationEvent,
  PropagationFlowStep,
  PlatformMigrationSummary,
  CommunityMovementRecord,
  PropagationStrength,
} from '../../data/mock/propagation';

export const PropagationPage: React.FC = () => {
  const [events, setEvents] = useState<PropagationEvent[]>([]);
  const [flowSteps, setFlowSteps] = useState<PropagationFlowStep[]>([]);
  const [migrationSummary, setMigrationSummary] = useState<PlatformMigrationSummary | null>(null);
  const [communityMovements, setCommunityMovements] = useState<CommunityMovementRecord[]>([]);

  const [selectedEvent, setSelectedEvent] = useState<PropagationEvent | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [timeRange, setTimeRange] = useState('24h');

  const [filters, setFilters] = useState<PropagationFilterParams>({
    platform: 'All',
    strength: 'All',
    topicId: 'All',
    narrativeId: 'All',
    query: '',
  });

  const loadData = async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const [evts, flow, mig, movs] = await Promise.all([
        propagationService.getEvents(filters),
        propagationService.getFlow(),
        propagationService.getPlatformMigration(),
        propagationService.getCommunityMovements(),
      ]);
      setEvents(evts);
      setFlowSteps(flow);
      setMigrationSummary(mig);
      setCommunityMovements(movs);
    } catch (e) {
      console.error('Failed to load propagation data:', e);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters, timeRange]);

  const handleSelectEvent = (evt: PropagationEvent) => {
    setSelectedEvent(evt);
    setIsDetailOpen(true);
  };

  const handleResetFilters = () => {
    setFilters({
      platform: 'All',
      strength: 'All',
      topicId: 'All',
      narrativeId: 'All',
      query: '',
    });
  };

  const isFiltered =
    (filters.platform && filters.platform !== 'All') ||
    (filters.strength && filters.strength !== 'All') ||
    (filters.topicId && filters.topicId !== 'All') ||
    (filters.query && filters.query.trim() !== '');

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Page Header with Refresh and Time Range */}
      <PageHeader
        title="Propagation"
        description="Trace how discussions and narratives moved across sources and communities."
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
              onClick={loadData}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* 2. Diffusion Pathway Flow Diagram */}
      <section>
        <PropagationFlow steps={flowSteps} />
      </section>

      {/* 3. Platform & Community Movement Dual Profile */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {migrationSummary && <PlatformMigrationCard migration={migrationSummary} />}
        <CommunityMovementCard movements={communityMovements} />
      </section>

      {/* 4. Filters Toolbar */}
      <section className="p-4 sm:p-5 rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#8591A5] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filters.query || ''}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              placeholder="Search propagation events, communities, topics..."
              className="w-full h-10 pl-10 pr-4 bg-[#EEF1F8] border border-transparent rounded-full text-[13px] text-[#111727] placeholder:text-[#8591A5] focus:outline-none focus:border-[#2F65F6] transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 text-[12px] text-[#8591A5] font-sans self-end sm:self-center">
            <span>
              Showing <strong className="text-[#111727] font-semibold">{events.length}</strong> events
            </span>
            {isFiltered && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-[#2F65F6] hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 border-t border-[rgba(228,233,245,0.85)]">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1">PLATFORM</label>
            <Select
              value={filters.platform || 'All'}
              onChange={(e) =>
                setFilters({ ...filters, platform: e.target.value as 'All' | 'X' | 'Telegram' })
              }
              options={[
                { value: 'All', label: 'All Platforms' },
                { value: 'X', label: 'X (Twitter)' },
                { value: 'Telegram', label: 'Telegram' },
              ]}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1">EVIDENCE STRENGTH</label>
            <Select
              value={filters.strength || 'All'}
              onChange={(e) =>
                setFilters({ ...filters, strength: e.target.value as 'All' | PropagationStrength })
              }
              options={[
                { value: 'All', label: 'All Strengths' },
                { value: 'Observed', label: 'Observed Only' },
                { value: 'Likely', label: 'Likely' },
                { value: 'Unclear', label: 'Unclear' },
              ]}
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8591A5] mb-1">TOPIC FILTER</label>
            <Select
              value={filters.topicId || 'All'}
              onChange={(e) => setFilters({ ...filters, topicId: e.target.value })}
              options={[
                { value: 'All', label: 'All Associated Topics' },
                { value: 'top-101', label: 'Regional power supply disruption' },
                { value: 'top-104', label: 'Fuel distribution quotas' },
              ]}
            />
          </div>
        </div>
      </section>

      {/* 5. Chronological Propagation Timeline */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-section-title font-sans text-text-primary">
            Propagation Chronology
          </h3>
          <span className="text-[12px] font-mono text-text-muted">
            Chronological multi-hop sequence
          </span>
        </div>

        <PropagationTimeline
          events={events}
          onSelectEvent={handleSelectEvent}
          isLoading={isLoading}
          isError={isError}
          onRetry={loadData}
        />
      </section>

      {/* 6. Contextual Event Detail Modal */}
      <PropagationDetailModal
        event={selectedEvent}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </div>
  );
};
