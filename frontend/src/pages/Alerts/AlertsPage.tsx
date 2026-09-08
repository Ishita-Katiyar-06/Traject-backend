import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Bell,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { AlertRow } from '../../components/alerts/AlertRow';
import { AlertFilterBar } from '../../components/alerts/AlertFilterBar';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { alertService, ALERTS_CHANGED_EVENT } from '../../services/alertService';
import { telemetryApi } from '../../services/telemetryApi';
import { trendService } from '../../services/trendService';
import type { AlertItem, AlertFilterState, AlertStatus } from '../../types/alerts';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters: default to 'open' so analysts focus on action-required alerts first
  const [filterState, setFilterState] = useState<AlertFilterState>({
    status: 'open',
    severity: 'all',
    category: 'all',
    search: '',
  });

  const loadAlerts = useCallback(async (isManualSync = false) => {
    setIsRefreshing(true);
    try {
      const minDelay = isManualSync ? new Promise((resolve) => setTimeout(resolve, 600)) : Promise.resolve();
      const [data] = await Promise.all([
        alertService.getAlerts({ skipCache: isManualSync }),
        minDelay,
      ]);
      setAlerts(data);
    } catch (err) {
      console.error('Failed to load alert telemetry:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleSyncAlerts = async () => {
    telemetryApi.clearCache();
    trendService.clearCache();
    await loadAlerts(true);
  };

  useEffect(() => {
    loadAlerts();

    const handleSync = (e: Event) => {
      const customEvt = e as CustomEvent<AlertItem | undefined>;
      if (customEvt.detail && customEvt.detail.id) {
        setAlerts((prev) => {
          if (prev.some((a) => a.id === customEvt.detail!.id)) return prev;
          return [customEvt.detail!, ...prev];
        });
      } else {
        loadAlerts();
      }
    };

    window.addEventListener(ALERTS_CHANGED_EVENT, handleSync);
    return () => {
      window.removeEventListener(ALERTS_CHANGED_EVENT, handleSync);
    };
  }, [loadAlerts]);

  // Overall Stats
  const stats = useMemo(() => alertService.computeStats(alerts), [alerts]);

  // Filter updates
  const handleFilterChange = (updates: Partial<AlertFilterState>) => {
    setFilterState((prev) => ({ ...prev, ...updates }));
  };

  // Status toggle handler
  const handleStatusChange = (alertId: string, status: AlertStatus) => {
    alertService.setAlertStatus(alertId, status);
    // Optimistic local state update for snappy UI
    setAlerts((prev) =>
      prev.map((alt) =>
        alt.id === alertId
          ? {
              ...alt,
              status,
              acknowledged_at: status === 'acknowledged' ? new Date().toISOString() : alt.acknowledged_at,
              dismissed_at: status === 'dismissed' ? new Date().toISOString() : alt.dismissed_at,
            }
          : alt
      )
    );
  };

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alt) => {
      // Status filter
      if (filterState.status !== 'all' && alt.status !== filterState.status) {
        return false;
      }

      // Severity filter
      if (filterState.severity !== 'all' && alt.severity !== filterState.severity) {
        return false;
      }

      // Category filter
      if (filterState.category !== 'all' && alt.category !== filterState.category) {
        return false;
      }

      // Search keyword filter
      if (filterState.search.trim()) {
        const q = filterState.search.toLowerCase();
        const matchesClaim = alt.claim.toLowerCase().includes(q);
        const matchesId = alt.narrative_id.toLowerCase().includes(q);
        const matchesTopic = alt.topic_id.toLowerCase().includes(q);
        const matchesIndicators = alt.indicators.some((i) => i.toLowerCase().includes(q));

        if (!matchesClaim && !matchesId && !matchesTopic && !matchesIndicators) {
          return false;
        }
      }

      return true;
    });
  }, [alerts, filterState]);

  // Open count among filtered items for batch action
  const openInFilteredCount = useMemo(() => {
    return filteredAlerts.filter((a) => a.status === 'open').length;
  }, [filteredAlerts]);

  // Batch acknowledge handler
  const handleAcknowledgeAllFiltered = () => {
    const openIds = filteredAlerts.filter((a) => a.status === 'open').map((a) => a.id);
    if (openIds.length === 0) return;
    alertService.acknowledgeAll(openIds);
    loadAlerts();
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* 1. Page Header */}
      <PageHeader
        title="Alert Triage & Escalation"
        description="Real-time analytical attention queue driven by Priority Signal Scores, cross-domain anomalies, and potential coordination indicators."
        actions={
          <Button
            variant="secondary"
            size="md"
            className="rounded-full hover:border-amber-400/80 dark:hover:border-amber-500/50"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 text-[#8591A5] group-hover:text-amber-500 ${isRefreshing ? 'animate-spin' : ''}`} />}
            onClick={handleSyncAlerts}
            disabled={isRefreshing}
          >
            Sync Alerts
          </Button>
        }
      />

      {/* 2. Key Metrics Summary Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Alerts */}
        <div className="rounded-[26px] p-6 bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs hover:border-amber-400/70 dark:hover:border-amber-500/40 hover:shadow-xs transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8591A5] uppercase tracking-wider font-mono">
              Total Alerts
            </span>
            <div className="w-11 h-11 rounded-[16px] bg-slate-100 dark:bg-[#222832] border border-slate-200/80 dark:border-[#2F3746] flex items-center justify-center text-[#111727] dark:text-slate-200">
              <Bell className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-[28px] font-bold text-[#111727] dark:text-slate-100 font-mono tracking-tight leading-none">
              {isLoading ? '...' : <AnimatedNumber value={stats.total} />}
            </div>
            <span className="text-[11px] text-[#8591A5] dark:text-slate-400 font-medium mt-1.5 block">
              Synthesized active triggers
            </span>
          </div>
        </div>

        {/* Metric 2: Open Queue */}
        <div className="rounded-[26px] p-6 bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs hover:border-amber-400/70 dark:hover:border-amber-500/40 hover:shadow-xs transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8591A5] uppercase tracking-wider font-mono">
              Open Queue
            </span>
            <div className="w-11 h-11 rounded-[16px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-[28px] font-bold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight leading-none">
              {isLoading ? '...' : <AnimatedNumber value={stats.open} />}
            </div>
            <span className="text-[11px] text-[#8591A5] dark:text-slate-400 font-medium mt-1.5 block">
              Pending analyst attention
            </span>
          </div>
        </div>

        {/* Metric 3: Critical Breaches */}
        <div className="rounded-[26px] p-6 bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs hover:border-amber-400/70 dark:hover:border-amber-500/40 hover:shadow-xs transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8591A5] uppercase tracking-wider font-mono">
              Critical Breaches
            </span>
            <div className="w-11 h-11 rounded-[16px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-[28px] font-bold text-rose-600 dark:text-rose-400 font-mono tracking-tight leading-none">
              {isLoading ? '...' : <AnimatedNumber value={stats.critical} />}
            </div>
            <span className="text-[11px] text-[#8591A5] dark:text-slate-400 font-medium mt-1.5 block">
              Priority Score &ge; 0.750
            </span>
          </div>
        </div>

        {/* Metric 4: Acknowledged */}
        <div className="rounded-[26px] p-6 bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs hover:border-amber-400/70 dark:hover:border-amber-500/40 hover:shadow-xs transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8591A5] uppercase tracking-wider font-mono">
              Acknowledged
            </span>
            <div className="w-11 h-11 rounded-[16px] bg-purple-50 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-[28px] font-bold text-[#111727] dark:text-slate-100 font-mono tracking-tight leading-none">
              {isLoading ? '...' : <AnimatedNumber value={stats.acknowledged} />}
            </div>
            <span className="text-[11px] text-[#8591A5] dark:text-slate-400 font-medium mt-1.5 block">
              Reviewed by analysts
            </span>
          </div>
        </div>
      </section>

      {/* 3. Filter & Search Toolbar */}
      <AlertFilterBar
        filterState={filterState}
        onFilterChange={handleFilterChange}
        openCount={stats.open}
        acknowledgedCount={stats.acknowledged}
        dismissedCount={stats.dismissed}
        totalFilteredCount={filteredAlerts.length}
        openInFilteredCount={openInFilteredCount}
        onAcknowledgeAllFiltered={handleAcknowledgeAllFiltered}
      />

      {/* 4. Alert Rows List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-6 sm:p-7 rounded-[26px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs space-y-3"
            >
              <Skeleton className="h-5 w-48 rounded-full" />
              <Skeleton className="h-6 w-3/4 rounded-full" />
              <Skeleton className="h-4 w-1/2 rounded-full" />
            </div>
          ))}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="p-12 sm:p-16 rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100 tracking-tight">
            No alerts found
          </h3>
          <p className="text-[13px] text-[#64748B] dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            {filterState.status === 'open'
              ? 'All alerts have been triaged and acknowledged. No immediate analyst attention required.'
              : 'No alerts match your current filter and search criteria.'}
          </p>
          {(filterState.severity !== 'all' || filterState.category !== 'all' || filterState.search) && (
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full px-5 hover:border-amber-400/80 dark:hover:border-amber-500/50"
              onClick={() =>
                setFilterState({
                  status: 'all',
                  severity: 'all',
                  category: 'all',
                  search: '',
                })
              }
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};
