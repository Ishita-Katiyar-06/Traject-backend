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

      {/* 4. Results Count Summary */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <div>
          Showing{' '}
          <span className="font-semibold text-slate-200">{forecasts.length}</span>{' '}
          of{' '}
          <span className="font-semibold text-slate-200">{totalAvailable}</span>{' '}
          evaluated topics
          {horizon === '24h' ? (
            <span className="ml-2 text-emerald-400/90 font-medium">(Primary 24h Horizon)</span>
          ) : (
            <span className="ml-2 text-amber-400/90 font-medium">(Auxiliary 6h Horizon)</span>
          )}
        </div>
        {tier !== 'ALL' && (
          <div className="text-[11px] text-slate-400">
            Filtered by Tier: <span className="text-slate-200 font-semibold">{tier}</span>
          </div>
        )}
      </div>

      {/* 5. Content Area */}
      {isLoading ? (
        <EmergingTrendsSkeleton />
      ) : isError ? (
        <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <h3 className="text-sm font-semibold text-red-200">
            Failed to Load Forecast Data
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {errorMessage || 'The forecasting service could not be reached. Check that the backend server is running and accessible.'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadData(true)}
            className="mt-2"
          >
            Retry Request
          </Button>
        </div>
      ) : forecasts.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-10 text-center space-y-3">
          <TrendingUp className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">
            No Emerging Topics Found
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            No topics matched the selected criteria (Tier: {tier}, Min Score: {minScore.toFixed(2)}).
            Try adjusting your filters or resetting to view all emerging trends.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setTier('ALL');
              setMinScore(0);
            }}
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
