import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { SignalFilters } from '../../components/signals/SignalFilters';
import { SignalTable } from '../../components/signals/SignalTable';
import { signalService, SignalFilterParams } from '../../services/signalService';
import { Signal } from '../../data/mock/signals';

export const SignalsPage: React.FC = () => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [timeRange, setTimeRange] = useState('24h');

  const [filters, setFilters] = useState<SignalFilterParams>({
    status: 'All',
    strength: 'All',
    source: 'All',
    language: 'All',
    query: '',
    sortBy: 'recent',
  });

  const loadSignals = async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      // Get full list for total count baseline
      const all = await signalService.getSignals();
      setTotalCount(all.length);

      // Get filtered list
      const data = await signalService.getSignals(filters);
      setSignals(data);
    } catch (e) {
      console.error('Failed to load signals:', e);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSignals();
  }, [filters, timeRange]);

  const handleResetFilters = () => {
    setFilters({
      status: 'All',
      strength: 'All',
      source: 'All',
      language: 'All',
      query: '',
      sortBy: 'recent',
    });
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Page Header with Time Range and Refresh */}
      <PageHeader
        title="Signals"
        description="Review unusual changes detected across monitored sources."
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
              onClick={loadSignals}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* 2. Compact Filter Toolbar */}
      <SignalFilters
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        totalCount={totalCount}
        filteredCount={signals.length}
      />

      {/* 3. Signal Table / List */}
      <SignalTable
        signals={signals}
        isLoading={isLoading}
        isError={isError}
        onRetry={loadSignals}
        onResetFilters={handleResetFilters}
      />
    </div>
  );
};
