import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Layers, Activity, Zap } from 'lucide-react';
import type { EmergingTrendForecast } from '../../types/forecasting';
import {
  formatForecastScore,
  formatForecastTier,
  formatTrajectory,
  formatConfidence,
  formatTopicDisplayName,
} from '../../utils/forecastingFormatters';

interface EmergingTrendCardProps {
  forecast: EmergingTrendForecast;
}

export const EmergingTrendCard: React.FC<EmergingTrendCardProps> = ({ forecast }) => {
  const tierInfo = formatForecastTier(forecast.forecast_tier);
  const trajectoryInfo = formatTrajectory(forecast.trajectory_phase);
  const confidenceInfo = formatConfidence(forecast.confidence_tier);
  const topicTitle = formatTopicDisplayName(
    forecast.topic_id,
    forecast.topic_name,
    forecast.topic_keywords
  );

  return (
    <div
      id={`forecast-card-${forecast.topic_id}`}
      className="bg-[#12161f]/90 border border-slate-800/80 hover:border-slate-700/90 rounded-xl p-5 backdrop-blur-sm shadow-lg transition-all duration-200 flex flex-col justify-between group hover:shadow-slate-900/50"
    >
      <div>
        {/* Top Header: Rank & Tier Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800 text-xs font-bold text-slate-200 border border-slate-700">
              #{forecast.forecast_rank}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${tierInfo.badgeClass}`}
            >
              {tierInfo.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${trajectoryInfo.badgeClass}`}
              title={`Trajectory: ${trajectoryInfo.label}`}
            >
              <span className="font-bold">{trajectoryInfo.symbol}</span>
              <span>{trajectoryInfo.label}</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${confidenceInfo.badgeClass}`}
              title={`Confidence: ${confidenceInfo.label}`}
            >
              <span>{confidenceInfo.label}</span>
            </span>
          </div>
        </div>

        {/* Topic Title & ID */}
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors line-clamp-1">
            {topicTitle}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
            <span className="font-mono bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
              ID: {forecast.topic_id}
            </span>
            <span>•</span>
            <span>{forecast.horizon_hours}h Horizon</span>
          </div>
        </div>

        {/* Emerging Trend Score Metric Display */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-3.5 mb-4">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Emerging Trend Score
            </span>
            <span className="text-xl font-bold font-mono text-emerald-400">
              {formatForecastScore(forecast.forecast_score)}
            </span>
          </div>
          {/* Progress Bar (Visual representation of 0.00 to 1.00) */}
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(Math.max(forecast.forecast_score * 100, 0), 100)}%` }}
            />
          </div>
        </div>

        {/* Component Signals: 24h Volume & 6h Velocity */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
          <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-800/60">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              <Activity className="w-3 h-3 text-slate-400" />
              <span>24h Volume</span>
            </div>
            <div className="font-mono text-slate-200 font-semibold text-sm">
              {forecast.messages_24h.toLocaleString()} msgs
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Historical: {forecast.historical_message_count.toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-800/60">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              <Zap className="w-3 h-3 text-slate-400" />
              <span>6h Velocity</span>
            </div>
            <div className="font-mono text-slate-200 font-semibold text-sm">
              {forecast.velocity_6h.toFixed(1)}/hr
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Growth: {forecast.growth_velocity.toFixed(2)}x
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Navigation Action */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span>Topic Intelligence</span>
        </span>
        <Link
          to={`/topics/${forecast.topic_id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors py-1 px-2.5 rounded-md hover:bg-emerald-950/30"
          id={`explore-topic-${forecast.topic_id}`}
        >
          <span>Explore Topic</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
