import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { AlertFilters } from '../../components/alerts/AlertFilters';
import { AlertTable } from '../../components/alerts/AlertTable';
import { alertService, AlertFilterParams } from '../../services/alertService';
import { Alert } from '../../data/mock/alerts';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [timeRange, setTimeRange] = useState('24h');

  const [filters, setFilters] = useState<AlertFilterParams>({
    status: 'All',
    priority: 'All',
    platform: 'All',
    query: '',
  });

  const loadAlerts = async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const all = await alertService.getAlerts();
      setTotalCount(all.length);

      const filtered = await alertService.getAlerts(filters);
      setAlerts(filtered);
    } catch (e) {
      console.error('Failed to load alerts:', e);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [filters, timeRange]);

  const handleAcknowledge = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await alertService.acknowledgeAlert(id);
    loadAlerts();
  };

  const handleReview = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await alertService.startReview(id);
    loadAlerts();
  };

  const handleResolve = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await alertService.resolveAlert(id);
    loadAlerts();
  };

  const handleResetFilters = () => {
    setFilters({
      status: 'All',
      priority: 'All',
      platform: 'All',
      query: '',
    });
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Page Header with Refresh and Range */}
      <PageHeader
        title="Alerts"
        description="Review signals that require attention or follow-up."
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
              onClick={loadAlerts}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* 2. Practical Filters Toolbar */}
      <AlertFilters
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        totalCount={totalCount}
        filteredCount={alerts.length}
      />

      {/* 3. Alerts Table with State Transitions */}
      <AlertTable
        alerts={alerts}
        onAcknowledge={handleAcknowledge}
        onReview={handleReview}
        onResolve={handleResolve}
        isLoading={isLoading}
        isError={isError}
        onRetry={loadAlerts}
        onResetFilters={handleResetFilters}
      />
    </div>
  );
};
