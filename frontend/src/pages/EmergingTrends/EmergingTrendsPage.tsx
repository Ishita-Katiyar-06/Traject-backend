import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { ForecastingStatusBanner } from '../../components/forecasting/ForecastingStatusBanner';
import { EmergingTrendsFilters } from '../../components/forecasting/EmergingTrendsFilters';
import { EmergingTrendCard } from '../../components/forecasting/EmergingTrendCard';
import { EmergingTrendsSkeleton } from '../../components/forecasting/EmergingTrendsSkeleton';
import { forecastService } from '../../services/forecastService';
import { trendService } from '../../services/trendService';
import type {
  EmergingTrendForecast,
  ForecastingStatusResponse,
  ForecastTier,
  EmergingTrendsQueryParams,
} from '../../types/forecasting';

export const EmergingTrendsPage: React.FC = () => {
  const [horizon, setHorizon] = useState<'24h' | '6h'>('24h');
  const [tier, setTier] = useState<ForecastTier | 'ALL'>('ALL');
  const [minScore, setMinScore] = useState<number>(0);
  const [limit, setLimit] = useState<number>(50);

  const [forecasts, setForecasts] = useState<EmergingTrendForecast[]>([]);
  const [totalAvailable, setTotalAvailable] = useState<number>(0);
  const [statusData, setStatusData] = useState<ForecastingStatusResponse | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const loadData = useCallback(async (skipCache = false) => {
    setIsError(false);
    setErrorMessage('');
    try {
      // 1. Load Status
      const statusRes = await forecastService.getForecastingStatus({ skipCache });
      setStatusData(statusRes);

      // 2. Load Forecasts
      const queryParams: EmergingTrendsQueryParams = {
        horizon_hours: horizon === '24h' ? 24 : 6,
        tier: tier !== 'ALL' ? (tier as ForecastTier) : undefined,
        min_score: minScore > 0 ? minScore : undefined,
        limit,
      };

      const forecastRes = await forecastService.getEmergingTrends(queryParams, { skipCache });

      // 3. Fallback: Join with catalog titles if any forecast topic_name is missing
      let resolvedForecasts = forecastRes.forecasts;
      try {
        const needsTitles = forecastRes.forecasts.some((fc) => !fc.topic_name);
        if (needsTitles) {
          const trendsCatalog = await trendService.getAllTrendsWithNarratives();
          const trendNameMap = new Map<string, string>();
          for (const tr of trendsCatalog) {
            const cid = tr.cleanId || tr.trend_id?.replace(/^trend_/, '') || '';
            if (cid) {
              trendNameMap.set(cid, tr.trend_name || tr.label || '');
            }
          }
          resolvedForecasts = forecastRes.forecasts.map((fc) => {
            if (fc.topic_name) return fc;
            const match = fc.topic_id.match(/(\d+)$/);
            const name = match ? trendNameMap.get(match[1]) : undefined;
            return name ? { ...fc, topic_name: name } : fc;
          });
        }
      } catch (trendErr) {
        console.debug('Trend catalog title join skipped:', trendErr);
      }

      setForecasts(resolvedForecasts);
      setTotalAvailable(forecastRes.artifact.total_candidate_topics);
    } catch (err: unknown) {
      console.error('Failed to load emerging trend forecasts:', err);
      setIsError(true);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to communicate with the forecasting engine backend.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [horizon, tier, minScore, limit]);

  useEffect(() => {
    setIsLoading(true);
    loadData(false);
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    forecastService.clearCache();
    const minDelay = new Promise((resolve) => setTimeout(resolve, 500));
    try {
      await Promise.all([loadData(true), minDelay]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Emerging Trend Forecasting"
        description="Forward-looking algorithmic identification of emerging topics showing early momentum and rising 24-hour prominence potential."
        actions={
          <Button
            variant="secondary"
            size="md"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            id="refresh-forecasting-btn"
            className="rounded-full shadow-xs hover:border-amber-400/80 dark:hover:border-amber-500/50"
          >
            Refresh Forecasts
          </Button>
        }
      />

      {/* 2. Operational Status Banner */}
      <ForecastingStatusBanner status={statusData} />

      {/* 3. Filter Controls */}
      <EmergingTrendsFilters
        horizon={horizon}
        onHorizonChange={setHorizon}
        tier={tier}
        onTierChange={setTier}
        minScore={minScore}
        onMinScoreChange={setMinScore}
        limit={limit}
        onLimitChange={setLimit}
        isLoading={isLoading || isRefreshing}
      />

      {/* 4. Results Count Summary Bar */}
      <div className="rounded-[20px] sm:rounded-full p-3.5 px-5 bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs font-mono text-[12px] text-[#8591A5] dark:text-slate-400">
        <div className="flex items-center gap-2 flex-wrap">
          <span>
            Showing <strong className="text-[#111727] dark:text-slate-100 font-bold">{forecasts.length}</strong> of{' '}
            <strong className="text-[#111727] dark:text-slate-100 font-bold">{totalAvailable}</strong> evaluated trends
          </span>
          {horizon === '24h' ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Primary 24h Horizon
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              Auxiliary 6h Horizon
            </span>
          )}
        </div>
        {tier !== 'ALL' && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <span>Filtered by Tier:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] text-[#111727] dark:text-slate-200 font-bold">
              {tier}
            </span>
          </div>
        )}
      </div>

      {/* 5. Content Area */}
      {isLoading ? (
        <EmergingTrendsSkeleton />
      ) : isError ? (
        <div className="rounded-[26px] sm:rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-red-200 dark:border-red-900/50 p-8 sm:p-10 text-center space-y-3 shadow-xs">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <h3 className="text-[16px] font-bold text-[#111727] dark:text-slate-100">
            Failed to Load Forecast Data
          </h3>
          <p className="text-[13px] text-[#8591A5] dark:text-slate-400 max-w-md mx-auto">
            {errorMessage || 'The forecasting service could not be reached. Check that the backend server is running and accessible.'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadData(true)}
            className="mt-2 rounded-full"
          >
            Retry Request
          </Button>
        </div>
      ) : forecasts.length === 0 ? (
        <div className="rounded-[26px] sm:rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] p-10 sm:p-14 text-center space-y-3 shadow-xs">
          <TrendingUp className="w-10 h-10 text-[#8591A5] dark:text-slate-500 mx-auto" />
          <h3 className="text-[16px] font-bold text-[#111727] dark:text-slate-100">
            No Emerging Trends Found
          </h3>
          <p className="text-[13px] text-[#8591A5] dark:text-slate-400 max-w-md mx-auto">
            No trends matched the selected criteria (Tier: {tier}, Min Score: {minScore.toFixed(2)}).
            Try adjusting your filters or resetting to view all emerging trends.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setTier('ALL');
              setMinScore(0);
            }}
            className="rounded-full shadow-xs hover:border-amber-400/80 dark:hover:border-amber-500/50"
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {forecasts.map((forecast) => (
            <EmergingTrendCard key={forecast.topic_id} forecast={forecast} />
          ))}
        </div>
      )}
    </div>
  );
};
