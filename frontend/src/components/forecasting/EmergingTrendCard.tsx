import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Zap, ArrowRight, Layers } from 'lucide-react';
import type { EmergingTrendForecast } from '../../types/forecasting';
import {
  formatForecastScore,
  formatForecastTier,
  formatTrajectory,
  formatConfidence,
  formatTopicDisplayName,
} from '../../utils/forecastingFormatters';
import { AnimatedProgressBar } from '../ui/AnimatedProgressBar';

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

  // Clean identifier for trend dossier navigation
  const cleanId = forecast.topic_id.replace(/^topic_|^trend_/, '');
  const targetRoute = `/trends/${cleanId}`;

  return (
    <div
      id={`forecast-card-${forecast.topic_id}`}
      className="group card-interactive rounded-[26px] sm:rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] p-6 sm:p-7 shadow-xs hover:border-amber-400/80 dark:hover:border-amber-500/50 hover:shadow-md flex flex-col justify-between font-sans"
    >
      <div>
        {/* Top Header Row: Rank, Emergence Tier, and Trajectory/Confidence */}
        <div className="flex items-center justify-between gap-2 mb-3.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/80 dark:border-[#2B323D] text-[11px] font-mono font-bold text-[#111727] dark:text-slate-100 shadow-2xs">
              #{forecast.forecast_rank}
            </span>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-mono font-bold border shadow-2xs ${tierInfo.badgeClass}`}
            >
              {tierInfo.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border shadow-2xs ${trajectoryInfo.badgeClass}`}
              title={`Trajectory: ${trajectoryInfo.label}`}
            >
              <span className="font-bold">{trajectoryInfo.symbol}</span>
              <span>{trajectoryInfo.label}</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border shadow-2xs ${confidenceInfo.badgeClass}`}
              title={`Confidence: ${confidenceInfo.label}`}
            >
              <span>{confidenceInfo.label}</span>
            </span>
          </div>
        </div>

        {/* Topic Title & Meta Capsules */}
        <div className="mb-4">
          <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100 group-hover:text-[#2F65F6] dark:group-hover:text-[#93C5FD] transition-colors line-clamp-1 tracking-tight">
            {topicTitle}
          </h3>
          <div className="flex items-center gap-2 mt-2 text-[11px] flex-wrap">
            <span className="font-mono px-2.5 py-0.5 rounded-full bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] text-[#8591A5] dark:text-slate-400">
              ID: {forecast.topic_id}
            </span>
            <span className="font-mono px-2.5 py-0.5 rounded-full bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] text-[#8591A5] dark:text-slate-400">
              {forecast.horizon_hours}h Horizon
            </span>
          </div>
        </div>

        {/* Emerging Trend Score Metric & Progress Bar */}
        <div className="p-4 rounded-[20px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] mb-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-mono font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">
              Emerging Trend Score
            </span>
            <span className="text-[20px] font-bold font-mono text-[#2F65F6] dark:text-[#93C5FD]">
              {formatForecastScore(forecast.forecast_score)}
            </span>
          </div>
          {/* Animated Progress Bar */}
          <AnimatedProgressBar
            value={forecast.forecast_score}
            max={1.0}
            aria-label="Emerging Trend Score"
          />
        </div>

        {/* Component Signals: 24h Volume & 6h Velocity */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
          <div className="p-3.5 rounded-[18px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A]">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#8591A5] dark:text-slate-400 font-bold mb-1">
              <Activity className="w-3.5 h-3.5 text-[#2F65F6] dark:text-[#93C5FD]" />
              <span>24h Volume</span>
            </div>
            <div className="font-mono text-[#111727] dark:text-slate-100 font-bold text-[14px]">
              {forecast.messages_24h.toLocaleString()} <span className="text-[10px] font-normal text-[#8591A5]">msgs</span>
            </div>
            <div className="text-[10px] font-mono text-[#8591A5] dark:text-slate-400 mt-0.5">
              Historical: {forecast.historical_message_count.toLocaleString()}
            </div>
          </div>

          <div className="p-3.5 rounded-[18px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A]">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#8591A5] dark:text-slate-400 font-bold mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>6h Velocity</span>
            </div>
            <div className="font-mono text-[#111727] dark:text-slate-100 font-bold text-[14px]">
              {forecast.velocity_6h.toFixed(1)} <span className="text-[10px] font-normal text-[#8591A5]">/hr</span>
            </div>
            <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
              Growth: {forecast.growth_velocity.toFixed(2)}x
            </div>
          </div>
        </div>
      </div>

      {/* Footer Navigation Button */}
      <div className="pt-3.5 border-t border-slate-100 dark:border-[#252B32]">
        <Link
          to={targetRoute}
          className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-full border border-slate-200/80 dark:border-[#2B323D] bg-[#FAFBFD] dark:bg-[#151921] text-[12px] font-semibold text-[#111727] dark:text-slate-200 hover:border-amber-400/80 dark:hover:border-amber-500/50 hover:bg-white dark:hover:bg-[#181C22] transition-all group/btn shadow-xs"
          id={`explore-topic-${forecast.topic_id}`}
        >
          <Layers className="w-3.5 h-3.5 text-[#8591A5] dark:text-slate-400" />
          <span>Explore Trend Dossier</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#8591A5] group-hover/btn:translate-x-1 group-hover/btn:text-amber-500 transition-all" />
        </Link>
      </div>
    </div>
  );
};
